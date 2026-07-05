// CHANGE: Runtime tests for createClientEffect with openapi-fetch-compatible inputs and strict Effect output
// WHY: Ensure non-2xx is represented in the Effect error channel without per-call output schema
// QUOTE(ТЗ): "openapi-effect должен почти 1 в 1 заменяться с openapi-fetch"
// REF: user-msg-2026-02-12
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Effect<void, never, never>
// INVARIANT: 2xx -> success channel; non-2xx/boundary errors -> error channel
// COMPLEXITY: O(1) per test

import { Effect, Either } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { paths } from "../../src/core/api/openapi.js"
import type { ClientOptions } from "../../src/shell/api-client/create-client-types.js"
import { createClientEffect } from "../../src/shell/api-client/create-client.js"

type AuthPaths = paths & object

const createMockFetch = (
  status: number,
  headers: Record<string, string>,
  body: string
) =>
(_request: Request) =>
  Effect.runPromise(
    Effect.succeed(
      status === 204 || status === 304
        ? new Response(null, { status, headers: new Headers(headers) })
        : new Response(body, { status, headers: new Headers(headers) })
    )
  )

const createFailingFetch = (message: string) => (_request: Request) =>
  Effect.runPromise(Effect.fail(new Error(message)))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("createClientEffect", () => {
  it("returns success envelope for login 200", () =>
    Effect.gen(function*() {
      const successBody = JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "user@example.com"
      })

      const clientOptions: ClientOptions = {
        baseUrl: "https://petstore.example.com",
        credentials: "include",
        fetch: createMockFetch(200, { "content-type": "application/json" }, successBody)
      }
      const apiClientEffect = createClientEffect<AuthPaths>(clientOptions)

      const generatedPassword = `ok-${Date.now()}`
      const result = yield* apiClientEffect.POST("/api/auth/login", {
        body: { email: "user@example.com", password: generatedPassword }
      })

      expect(result.status).toBe(200)
      expect(result.contentType).toBe("application/json")
      expect(result.body).toMatchObject({ email: "user@example.com" })
    }).pipe(Effect.runPromise))

  it("returns error envelope for login 401", () =>
    Effect.gen(function*() {
      const errorBody = JSON.stringify({ error: "invalid_credentials" })

      const clientOptions: ClientOptions = {
        baseUrl: "https://petstore.example.com",
        credentials: "include",
        fetch: createMockFetch(401, { "content-type": "application/json" }, errorBody)
      }
      const apiClientEffect = createClientEffect<AuthPaths>(clientOptions)

      const generatedPassword = `bad-${Date.now()}`
      const result = yield* Effect.either(
        apiClientEffect.POST("/api/auth/login", {
          body: { email: "user@example.com", password: generatedPassword }
        })
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "HttpError",
          status: 401,
          contentType: "application/json",
          body: { error: "invalid_credentials" }
        })
      }
    }).pipe(Effect.runPromise))

  it("returns undefined data for 204", () =>
    Effect.gen(function*() {
      const clientOptions: ClientOptions = {
        baseUrl: "https://petstore.example.com",
        credentials: "include",
        fetch: createMockFetch(204, {}, "")
      }
      const apiClientEffect = createClientEffect<AuthPaths>(clientOptions)

      const result = yield* apiClientEffect.POST("/api/auth/logout")

      expect(result.status).toBe(204)
      expect(result.contentType).toBe("none")
      expect(result.body).toBeUndefined()
    }).pipe(Effect.runPromise))

  it("returns success envelope for register 201", () =>
    Effect.gen(function*() {
      const successBody = JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440001",
        email: "new@example.com"
      })

      const clientOptions: ClientOptions = {
        baseUrl: "https://petstore.example.com",
        credentials: "include",
        fetch: createMockFetch(201, { "content-type": "application/json" }, successBody)
      }
      const apiClientEffect = createClientEffect<AuthPaths>(clientOptions)

      const generatedPassword = `new-${Date.now()}`
      const result = yield* apiClientEffect.POST("/api/register", {
        body: { token: "invite-token", password: generatedPassword }
      })

      expect(result.status).toBe(201)
      expect(result.contentType).toBe("application/json")
      expect(result.body).toMatchObject({ email: "new@example.com" })
    }).pipe(Effect.runPromise))

  it("keeps transport failures in Effect error channel", () =>
    Effect.gen(function*() {
      const clientOptions: ClientOptions = {
        baseUrl: "https://petstore.example.com",
        credentials: "include",
        fetch: createFailingFetch("network down")
      }
      const apiClientEffect = createClientEffect<AuthPaths>(clientOptions)

      const outcome = yield* Effect.either(apiClientEffect.GET("/api/auth/me"))

      expect(Either.isLeft(outcome)).toBe(true)
      if (Either.isLeft(outcome)) {
        expect(outcome.left).toMatchObject({ _tag: "TransportError" })
        if (outcome.left._tag === "TransportError") {
          expect(outcome.left.error.message).toContain("network down")
        }
      }
    }).pipe(Effect.runPromise))

  it("uses getRandomValues when randomUUID is unavailable", () =>
    Effect.gen(function*() {
      const capturedIds: Array<string> = []
      vi.stubGlobal("crypto", {
        getRandomValues: (values: Uint8Array): Uint8Array => {
          values.set([0x10, 0x32, 0x54, 0x76, 0x98])
          return values
        }
      })

      const apiClientEffect = createClientEffect<AuthPaths>({
        baseUrl: "https://petstore.example.com",
        credentials: "include",
        fetch: createMockFetch(200, { "content-type": "application/json" }, JSON.stringify({ ok: true }))
      })

      apiClientEffect.use({
        onRequest: ({ id }) => {
          capturedIds.push(id)
        }
      })

      const result = yield* apiClientEffect.GET("/api/auth/me")

      expect(result.status).toBe(200)
      expect(capturedIds).toEqual(["103254769"])
    }).pipe(Effect.runPromise))

  it("falls back to a clock-based request id when Web Crypto is missing", () =>
    Effect.gen(function*() {
      const capturedIds: Array<string> = []
      vi.stubGlobal("crypto", undefined)
      vi.spyOn(Date, "now").mockReturnValue(0x1234567)

      const apiClientEffect = createClientEffect<AuthPaths>({
        baseUrl: "https://petstore.example.com",
        credentials: "include",
        fetch: createMockFetch(200, { "content-type": "application/json" }, JSON.stringify({ ok: true }))
      })

      apiClientEffect.use({
        onRequest: ({ id }) => {
          capturedIds.push(id)
        }
      })

      const result = yield* apiClientEffect.GET("/api/auth/me")

      expect(result.status).toBe(200)
      expect(capturedIds).toEqual(["123456700"])
    }).pipe(Effect.runPromise))
})
