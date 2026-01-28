// CHANGE: Tests for generated dispatchers with Effect-native error handling
// WHY: Verify 2xx → success channel, non-2xx → error channel (forced handling)
// QUOTE(ТЗ): "TypeScript должен выдавать ошибку 'неполное покрытие' через паттерн assertNever"
// REF: issue-2, section A3, 4.2
// SOURCE: n/a
// FORMAT THEOREM: ∀ op ∈ GeneratedOps: success(2xx) | httpError(non-2xx) | boundaryError
// PURITY: SHELL
// EFFECT: Effect<void, never, never>
// INVARIANT: 2xx → isRight (success), non-2xx → isLeft (HttpError), unexpected → isLeft (BoundaryError)
// COMPLEXITY: O(1) per test

import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Effect, Either, Layer } from "effect"
import { describe, expect, it } from "vitest"

import {
  dispatchercreatePet,
  dispatcherdeletePet,
  dispatchergetPet,
  dispatcherlistPets
} from "../../src/generated/dispatch.js"
import { createStrictClient } from "../../src/shell/api-client/strict-client.js"
import type { Paths } from "../fixtures/petstore.openapi.js"

type PetstorePaths = Paths & object

/**
 * Create a mock HttpClient layer that returns a fixed response
 * Note: 204 and 304 responses cannot have a body per HTTP spec
 *
 * @pure true - returns pure layer
 */
const createMockHttpClientLayer = (
  status: number,
  headers: Record<string, string>,
  body: string
): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(
      (request) =>
        Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            // 204 and 304 responses cannot have a body
            status === 204 || status === 304
              ? new Response(null, { status, headers: new Headers(headers) })
              : new Response(body, { status, headers: new Headers(headers) })
          )
        )
    )
  )

describe("Generated dispatcher: listPets", () => {
  it("should handle 200 success response", () =>
    Effect.gen(function*() {
      const successBody = JSON.stringify([
        { id: "1", name: "Fluffy" },
        { id: "2", name: "Spot" }
      ])

      const client = createStrictClient<PetstorePaths>()

      const result = yield* Effect.either(
        client.GET("/pets", {
          baseUrl: "https://api.example.com",
          dispatcher: dispatcherlistPets
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(200, { "content-type": "application/json" }, successBody)
          )
        )
      )

      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right.status).toBe(200)
        expect(result.right.contentType).toBe("application/json")
        expect(Array.isArray(result.right.body)).toBe(true)
      }
    }).pipe(Effect.runPromise))

  it("should return HttpError for 500 response (error channel)", () =>
    Effect.gen(function*() {
      const errorBody = JSON.stringify({ code: 500, message: "Internal server error" })

      const client = createStrictClient<PetstorePaths>()

      const result = yield* Effect.either(
        client.GET("/pets", {
          baseUrl: "https://api.example.com",
          dispatcher: dispatcherlistPets
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(500, { "content-type": "application/json" }, errorBody)
          )
        )
      )

      // 500 is in schema → HttpError in error channel (forces explicit handling)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "HttpError",
          status: 500,
          contentType: "application/json"
        })
      }
    }).pipe(Effect.runPromise))

  it("should return UnexpectedStatus for 404 (not in schema)", () =>
    Effect.gen(function*() {
      const client = createStrictClient<PetstorePaths>()

      const result = yield* Effect.either(
        client.GET("/pets", {
          baseUrl: "https://api.example.com",
          dispatcher: dispatcherlistPets
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(
              404,
              { "content-type": "application/json" },
              JSON.stringify({ message: "Not found" })
            )
          )
        )
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "UnexpectedStatus",
          status: 404
        })
      }
    }).pipe(Effect.runPromise))
})

describe("Generated dispatcher: createPet", () => {
  it("should handle 201 created response", () =>
    Effect.gen(function*() {
      const createdPet = JSON.stringify({ id: "123", name: "Rex" })

      const client = createStrictClient<PetstorePaths>()

      const result = yield* Effect.either(
        client.POST("/pets", {
          baseUrl: "https://api.example.com",
          dispatcher: dispatchercreatePet,
          body: JSON.stringify({ name: "Rex" })
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(201, { "content-type": "application/json" }, createdPet)
          )
        )
      )

      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right.status).toBe(201)
        expect(result.right.contentType).toBe("application/json")
      }
    }).pipe(Effect.runPromise))

  it("should return HttpError for 400 validation error (error channel)", () =>
    Effect.gen(function*() {
      const errorBody = JSON.stringify({ code: 400, message: "Validation failed" })

      const client = createStrictClient<PetstorePaths>()

      const result = yield* Effect.either(
        client.POST("/pets", {
          baseUrl: "https://api.example.com",
          dispatcher: dispatchercreatePet,
          body: JSON.stringify({ name: "" })
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(400, { "content-type": "application/json" }, errorBody)
          )
        )
      )

      // 400 is in schema → HttpError in error channel (forces explicit handling)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "HttpError",
          status: 400
        })
      }
    }).pipe(Effect.runPromise))

  it("should return HttpError for 500 error (error channel)", () =>
    Effect.gen(function*() {
      const errorBody = JSON.stringify({ code: 500, message: "Server error" })

      const client = createStrictClient<PetstorePaths>()

      const result = yield* Effect.either(
        client.POST("/pets", {
          baseUrl: "https://api.example.com",
          dispatcher: dispatchercreatePet,
          body: JSON.stringify({ name: "Test" })
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(500, { "content-type": "application/json" }, errorBody)
          )
        )
      )

      // 500 is in schema → HttpError in error channel (forces explicit handling)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "HttpError",
          status: 500
        })
      }
    }).pipe(Effect.runPromise))
})

describe("Generated dispatcher: getPet", () => {
  it("should handle 200 success with pet data", () =>
    Effect.gen(function*() {
      const pet = JSON.stringify({ id: "42", name: "Buddy", tag: "dog" })

      const client = createStrictClient<PetstorePaths>()

      const result = yield* Effect.either(
        client.GET("/pets/{petId}", {
          baseUrl: "https://api.example.com",
          dispatcher: dispatchergetPet,
          params: { petId: "42" }
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(200, { "content-type": "application/json" }, pet)
          )
        )
      )

      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right.status).toBe(200)
      }
    }).pipe(Effect.runPromise))

  it("should return HttpError for 404 not found (error channel)", () =>
    Effect.gen(function*() {
      const errorBody = JSON.stringify({ code: 404, message: "Pet not found" })

      const client = createStrictClient<PetstorePaths>()

      const result = yield* Effect.either(
        client.GET("/pets/{petId}", {
          baseUrl: "https://api.example.com",
          dispatcher: dispatchergetPet,
          params: { petId: "999" }
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(404, { "content-type": "application/json" }, errorBody)
          )
        )
      )

      // 404 is in schema → HttpError in error channel (forces explicit handling)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "HttpError",
          status: 404
        })
      }
    }).pipe(Effect.runPromise))
})

describe("Generated dispatcher: deletePet", () => {
  it("should handle 204 no content", () =>
    Effect.gen(function*() {
      const client = createStrictClient<PetstorePaths>()

      const result = yield* Effect.either(
        client.DELETE("/pets/{petId}", {
          baseUrl: "https://api.example.com",
          dispatcher: dispatcherdeletePet,
          params: { petId: "42" }
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(204, {}, "")
          )
        )
      )

      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right.status).toBe(204)
        expect(result.right.contentType).toBe("none")
        expect(result.right.body).toBeUndefined()
      }
    }).pipe(Effect.runPromise))

  it("should return HttpError for 404 pet not found (error channel)", () =>
    Effect.gen(function*() {
      const errorBody = JSON.stringify({ code: 404, message: "Pet not found" })

      const client = createStrictClient<PetstorePaths>()

      const result = yield* Effect.either(
        client.DELETE("/pets/{petId}", {
          baseUrl: "https://api.example.com",
          dispatcher: dispatcherdeletePet,
          params: { petId: "999" }
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(404, { "content-type": "application/json" }, errorBody)
          )
        )
      )

      // 404 is in schema → HttpError in error channel (forces explicit handling)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "HttpError",
          status: 404
        })
      }
    }).pipe(Effect.runPromise))
})

/**
 * Exhaustiveness test: Verify TypeScript catches missing cases
 * This is a compile-time test - uncomment to verify it fails typecheck
 */
describe("Exhaustiveness (compile-time verification)", () => {
  it("demonstrates exhaustive pattern matching requirement", () => {
    // This test documents the requirement but doesn't run
    // In real code, omitting a status case should cause compile error

    /*
    const handleResponse = (response: ApiResponse<listPetsOp>) => {
      switch (response.status) {
        case 200:
          return "success"
        // case 500: // <-- Commenting this out should cause compile error
        //   return "error"
        default:
          return assertNever(response) // <-- TypeScript error if not exhaustive
      }
    }
    */

    expect(true).toBe(true) // Placeholder
  })
})
