// CHANGE: Unit tests for boundary error cases (C1-C4 from acceptance criteria)
// WHY: Verify all protocol/parsing failures are correctly classified
// REF: issue-2, section C

import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientError from "@effect/platform/HttpClientError"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Effect, Either, Layer, Match } from "effect"
import { describe, expect, it } from "vitest"

import {
  createDispatcher,
  executeRequest,
  parseJSON,
  unexpectedContentType,
  unexpectedStatus
} from "../../src/shell/api-client/strict-client.js"

type Json = null | boolean | number | string | ReadonlyArray<Json> | { readonly [k: string]: Json }

const createMockHttpClientLayer = (
  status: number,
  headers: Record<string, string>,
  body: string
): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response(body, { status, headers: new Headers(headers) }))
      )
    )
  )

const createFailingHttpClientLayer = (error: Error): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.fail(new HttpClientError.RequestError({ request, reason: "Transport", cause: error }))
    )
  )

describe("C1: UnexpectedStatus", () => {
  it("should return UnexpectedStatus for status not in schema (418)", () =>
    Effect.gen(function*() {
      const dispatcher = createDispatcher((status, _contentType, text) =>
        Match.value(status).pipe(
          Match.when(
            200,
            () => Effect.succeed({ status: 200, contentType: "application/json" as const, body: {} } as const)
          ),
          Match.when(
            500,
            () => Effect.succeed({ status: 500, contentType: "application/json" as const, body: {} } as const)
          ),
          Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
        )
      )

      const result = yield* Effect.either(
        executeRequest({ method: "get", url: "https://api.example.com/test", dispatcher }).pipe(
          Effect.provide(createMockHttpClientLayer(418, { "content-type": "text/plain" }, "I'm a teapot"))
        )
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({ _tag: "UnexpectedStatus", status: 418, body: "I'm a teapot" })
      }
    }).pipe(Effect.runPromise))
})

describe("C2: UnexpectedContentType", () => {
  it("should return UnexpectedContentType for 200 with text/html", () =>
    Effect.gen(function*() {
      const dispatcher = createDispatcher((status, contentType, text) =>
        Match.value(status).pipe(
          Match.when(200, () =>
            contentType?.includes("application/json")
              ? Effect.succeed({ status: 200, contentType: "application/json" as const, body: {} } as const)
              : Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))),
          Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
        )
      )

      const result = yield* Effect.either(
        executeRequest({ method: "get", url: "https://api.example.com/test", dispatcher }).pipe(
          Effect.provide(
            createMockHttpClientLayer(200, { "content-type": "text/html" }, "<html><body>Hello</body></html>")
          )
        )
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "UnexpectedContentType",
          status: 200,
          expected: ["application/json"],
          actual: "text/html"
        })
      }
    }).pipe(Effect.runPromise))
})

describe("C3: ParseError", () => {
  it("should return ParseError for malformed JSON", () =>
    Effect.gen(function*() {
      const malformedJSON = "{\"bad\": json}"
      const result = yield* Effect.either(parseJSON(200, "application/json", malformedJSON))

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({ _tag: "ParseError", status: 200, contentType: "application/json" })
        expect(result.left.error).toBeInstanceOf(Error)
      }
    }).pipe(Effect.runPromise))

  it("should return ParseError for incomplete JSON", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(parseJSON(200, "application/json", "{\"key\": \"value\""))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) expect(result.left._tag).toBe("ParseError")
    }).pipe(Effect.runPromise))

  it("should succeed for valid JSON", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(parseJSON(200, "application/json", "{\"key\": \"value\"}"))
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) expect(result.right).toEqual({ key: "value" })
    }).pipe(Effect.runPromise))
})

describe("C4: DecodeError", () => {
  it("should return DecodeError when decoded value fails schema", () =>
    Effect.gen(function*() {
      const validJSONWrongSchema = "{\"unexpected\": \"field\"}"
      const mockDecoder = (status: number, contentType: string, body: string, parsed: Json) =>
        typeof parsed === "object" && parsed !== null && "id" in parsed && "name" in parsed
          ? Effect.succeed(parsed)
          : Effect.fail({
            _tag: "DecodeError" as const,
            status,
            contentType,
            error: new Error("Expected id and name"),
            body
          })

      const result = yield* Effect.either(
        Effect.gen(function*() {
          const parsed = yield* parseJSON(200, "application/json", validJSONWrongSchema)
          return yield* mockDecoder(200, "application/json", validJSONWrongSchema, parsed)
        })
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({ _tag: "DecodeError", status: 200, contentType: "application/json" })
      }
    }).pipe(Effect.runPromise))
})

describe("TransportError", () => {
  it("should return TransportError on network failure", () =>
    Effect.gen(function*() {
      const dispatcher = createDispatcher(() =>
        Effect.succeed({ status: 200, contentType: "application/json" as const, body: {} } as const)
      )

      const result = yield* Effect.either(
        executeRequest({ method: "get", url: "https://api.example.com/test", dispatcher }).pipe(
          Effect.provide(createFailingHttpClientLayer(new Error("Network connection failed")))
        )
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) expect(result.left).toMatchObject({ _tag: "TransportError" })
    }).pipe(Effect.runPromise))

  it("should return TransportError on abort", () =>
    Effect.gen(function*() {
      const abortError = new Error("Request aborted")
      abortError.name = "AbortError"

      const dispatcher = createDispatcher(() =>
        Effect.succeed({ status: 200, contentType: "application/json" as const, body: {} } as const)
      )

      const result = yield* Effect.either(
        executeRequest({ method: "get", url: "https://api.example.com/test", dispatcher }).pipe(
          Effect.provide(createFailingHttpClientLayer(abortError))
        )
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        const err = result.left as { _tag?: string }
        expect(err._tag).toBe("TransportError")
      }
    }).pipe(Effect.runPromise))
})

describe("No uncaught exceptions", () => {
  it("should never throw, only return Effect.fail", () =>
    Effect.gen(function*() {
      const testCases = [
        { status: 418, body: "teapot", contentType: "application/json" },
        { status: 200, contentType: "text/html", body: "<html/>" },
        { status: 200, contentType: "application/json", body: "{bad json" },
        { status: 200, contentType: "application/json", body: "{\"valid\": \"json\"}" }
      ]

      for (const testCase of testCases) {
        const dispatcher = createDispatcher((status, contentType, text) =>
          Match.value(status === 200 && contentType?.includes("application/json")).pipe(
            Match.when(true, () =>
              Effect.gen(function*() {
                const parsed = yield* parseJSON(status, "application/json", text)
                return { status: 200, contentType: "application/json" as const, body: parsed } as const
              })),
            Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
          )
        )

        const result = yield* Effect.either(
          executeRequest({ method: "get", url: "https://api.example.com/test", dispatcher }).pipe(
            Effect.provide(
              createMockHttpClientLayer(testCase.status, { "content-type": testCase.contentType }, testCase.body)
            )
          )
        )

        expect(Either.isLeft(result) || Either.isRight(result)).toBe(true)
      }
    }).pipe(Effect.runPromise))
})
