// CHANGE: Add tests for createClientEffect with auth OpenAPI schema
// WHY: Verify the zero-boilerplate DSL works end-to-end with real-world auth schema
// QUOTE(ТЗ): "apiClientEffect.POST('/api/auth/login', { body: credentials }) — Что бы это работало"
// REF: issue-5
// SOURCE: n/a
// FORMAT THEOREM: ∀ op ∈ AuthOperations: createClientEffect<paths>(options).METHOD(path, opts) → Effect<ApiSuccess | HttpError, BoundaryError, HttpClient>
// PURITY: SHELL
// EFFECT: Effect<void, never, never>
// INVARIANT: HTTP statuses are returned as values, boundary failures stay in error channel
// COMPLEXITY: O(1) per test

import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Effect, Layer } from "effect"
import { describe, expect, it } from "vitest"

import type { paths } from "../../src/core/api/openapi.js"
import type { ClientOptions } from "../../src/shell/api-client/create-client-types.js"
import { createClientEffect } from "../../src/shell/api-client/create-client.js"

type AuthPaths = paths & object

/**
 * Test fixtures for auth API testing
 *
 * @pure true - immutable test data
 */
const fixtures = {
  loginBody: () => ({ email: "user@example.com", password: `test-${Date.now()}` }),
  wrongLoginBody: () => ({ email: "user@example.com", password: `wrong-${Date.now()}` }),
  registerBody: () => ({ token: "invite-token-123", password: `Pass-${Date.now()}!` })
} as const

/**
 * Create a mock HttpClient layer that returns a fixed response
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
            status === 204 || status === 304
              ? new Response(null, { status, headers: new Headers(headers) })
              : new Response(body, { status, headers: new Headers(headers) })
          )
        )
    )
  )

describe("createClientEffect (zero-boilerplate, auth schema)", () => {
  const clientOptions: ClientOptions = {
    baseUrl: "https://petstore.example.com",
    credentials: "include"
  }
  const apiClientEffect = createClientEffect<AuthPaths>(clientOptions)

  it("should POST /api/auth/login with body and return 200 success", () =>
    Effect.gen(function*() {
      const credentials = fixtures.loginBody()
      const successBody = JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
        profileImageUrl: null,
        emailVerified: true,
        phoneVerified: false
      })

      const result = yield* apiClientEffect.POST("/api/auth/login", { body: credentials }).pipe(
        Effect.provide(
          createMockHttpClientLayer(200, { "content-type": "application/json" }, successBody)
        )
      )

      expect("_tag" in result).toBe(false)
      expect(result.status).toBe(200)
      expect(result.contentType).toBe("application/json")
      const body = result.body as { id: string; email: string }
      expect(body.id).toBe("550e8400-e29b-41d4-a716-446655440000")
      expect(body.email).toBe("user@example.com")
    }).pipe(Effect.runPromise))

  it("should return HttpError value for 401 invalid_credentials", () =>
    Effect.gen(function*() {
      const credentials = fixtures.wrongLoginBody()
      const errorBody = JSON.stringify({ error: "invalid_credentials" })

      const result = yield* apiClientEffect.POST("/api/auth/login", { body: credentials }).pipe(
        Effect.provide(
          createMockHttpClientLayer(401, { "content-type": "application/json" }, errorBody)
        )
      )

      expect("_tag" in result).toBe(true)
      if ("_tag" in result) {
        expect(result).toMatchObject({
          _tag: "HttpError",
          status: 401
        })
        const body = result.body as { error: string }
        expect(body.error).toBe("invalid_credentials")
      }
    }).pipe(Effect.runPromise))

  it("should return HttpError value for 400 bad request", () =>
    Effect.gen(function*() {
      const credentials = fixtures.loginBody()
      const errorBody = JSON.stringify({ error: "invalid_payload" })

      const result = yield* apiClientEffect.POST("/api/auth/login", { body: credentials }).pipe(
        Effect.provide(
          createMockHttpClientLayer(400, { "content-type": "application/json" }, errorBody)
        )
      )

      expect("_tag" in result).toBe(true)
      if ("_tag" in result) {
        expect(result).toMatchObject({
          _tag: "HttpError",
          status: 400
        })
      }
    }).pipe(Effect.runPromise))

  it("should return HttpError value for 500 internal_error", () =>
    Effect.gen(function*() {
      const credentials = fixtures.loginBody()
      const errorBody = JSON.stringify({ error: "internal_error" })

      const result = yield* apiClientEffect.POST("/api/auth/login", { body: credentials }).pipe(
        Effect.provide(
          createMockHttpClientLayer(500, { "content-type": "application/json" }, errorBody)
        )
      )

      expect("_tag" in result).toBe(true)
      if ("_tag" in result) {
        expect(result).toMatchObject({
          _tag: "HttpError",
          status: 500
        })
      }
    }).pipe(Effect.runPromise))

  it("should POST /api/auth/logout and return 204 no-content success", () =>
    Effect.gen(function*() {
      const result = yield* apiClientEffect.POST("/api/auth/logout").pipe(
        Effect.provide(
          createMockHttpClientLayer(204, {}, "")
        )
      )

      expect("_tag" in result).toBe(false)
      expect(result.status).toBe(204)
      expect(result.contentType).toBe("none")
      expect(result.body).toBeUndefined()
    }).pipe(Effect.runPromise))

  it("should GET /api/auth/me and return 200 with user profile", () =>
    Effect.gen(function*() {
      const profileBody = JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
        profileImageUrl: null,
        emailVerified: true,
        phoneVerified: false,
        birthDate: null,
        about: null,
        messengers: [],
        memberships: [],
        adminProjectIds: [],
        workEmail: null,
        workPhone: null
      })

      const result = yield* apiClientEffect.GET("/api/auth/me").pipe(
        Effect.provide(
          createMockHttpClientLayer(200, { "content-type": "application/json" }, profileBody)
        )
      )

      expect("_tag" in result).toBe(false)
      expect(result.status).toBe(200)
      const body = result.body as { email: string; firstName: string }
      expect(body.email).toBe("user@example.com")
      expect(body.firstName).toBe("John")
    }).pipe(Effect.runPromise))

  it("should GET /api/auth/me and return HttpError value for 401 unauthorized", () =>
    Effect.gen(function*() {
      const errorBody = JSON.stringify({ error: "unauthorized" })

      const result = yield* apiClientEffect.GET("/api/auth/me").pipe(
        Effect.provide(
          createMockHttpClientLayer(401, { "content-type": "application/json" }, errorBody)
        )
      )

      expect("_tag" in result).toBe(true)
      if ("_tag" in result) {
        expect(result).toMatchObject({
          _tag: "HttpError",
          status: 401
        })
      }
    }).pipe(Effect.runPromise))

  it("should POST /api/register with body and return 201 success", () =>
    Effect.gen(function*() {
      const registerBody = fixtures.registerBody()
      const successBody = JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440001",
        email: "new@example.com",
        firstName: "Jane",
        lastName: "Doe",
        profileImageUrl: null
      })

      const result = yield* apiClientEffect.POST("/api/register", { body: registerBody }).pipe(
        Effect.provide(
          createMockHttpClientLayer(201, { "content-type": "application/json" }, successBody)
        )
      )

      expect("_tag" in result).toBe(false)
      expect(result.status).toBe(201)
      const body = result.body as { id: string; email: string }
      expect(body.email).toBe("new@example.com")
    }).pipe(Effect.runPromise))

  it("should POST /api/register and return HttpError value for 409 user_exists", () =>
    Effect.gen(function*() {
      const registerBody = fixtures.registerBody()
      const errorBody = JSON.stringify({ error: "user_exists" })

      const result = yield* apiClientEffect.POST("/api/register", { body: registerBody }).pipe(
        Effect.provide(
          createMockHttpClientLayer(409, { "content-type": "application/json" }, errorBody)
        )
      )

      expect("_tag" in result).toBe(true)
      if ("_tag" in result) {
        expect(result).toMatchObject({
          _tag: "HttpError",
          status: 409
        })
        const body = result.body as { error: string }
        expect(body.error).toBe("user_exists")
      }
    }).pipe(Effect.runPromise))

  it("should return UnexpectedContentType for non-JSON response", () =>
    Effect.gen(function*() {
      const credentials = fixtures.loginBody()

      const result = yield* apiClientEffect.POST("/api/auth/login", { body: credentials }).pipe(
        Effect.provide(
          createMockHttpClientLayer(200, { "content-type": "text/html" }, "<html>error</html>")
        ),
        Effect.catchTag("UnexpectedContentType", (error) => Effect.succeed(error))
      )

      expect("_tag" in result).toBe(true)
      if ("_tag" in result) {
        expect(result).toMatchObject({
          _tag: "UnexpectedContentType",
          status: 200
        })
      }
    }).pipe(Effect.runPromise))
})
