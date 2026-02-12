// CHANGE: Integration test verifying the exact user DSL snippet from issue #5
// WHY: Ensure the import/usage pattern requested by the user compiles and works end-to-end
// QUOTE(ТЗ): "import { createClientEffect, type ClientOptions } from 'openapi-effect' ... apiClientEffect.POST('/api/auth/login', { body: credentials })"
// REF: issue-5, PR#6 comment from skulidropek
// SOURCE: n/a
// FORMAT THEOREM: ∀ Paths, options: createClientEffect<Paths>(options).POST(path, { body }) → Effect<ApiSuccess, ApiFailure, HttpClient>
// PURITY: SHELL
// EFFECT: Effect<void, never, never>
// INVARIANT: The exact user snippet compiles and produces correct runtime behavior
// COMPLEXITY: O(1) per test

import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Effect, Either, Layer } from "effect"
import { describe, expect, it } from "vitest"

// CHANGE: Import via the package's main entry point (src/index.ts)
// WHY: Verify the user's import pattern `from "openapi-effect"` resolves correctly
// REF: issue-5
import { createClientEffect } from "../../src/index.js"
import type { ClientOptions } from "../../src/index.js"

// CHANGE: Import paths from the auth OpenAPI schema
// WHY: Match the user's pattern `import type { paths } from "./openapi.d.ts"`
// REF: issue-5
import type { paths } from "../../src/core/api/openapi.js"

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

/**
 * Test fixtures for integration tests
 *
 * @pure true - immutable test data factories
 */
const fixtures = {
  loginBody: () => ({ email: "user@example.com", password: `test-${Date.now()}` }),
  wrongLoginBody: () => ({ email: "user@example.com", password: `wrong-${Date.now()}` })
} as const

// =============================================================================
// SECTION: Exact user snippet integration test (CI/CD check)
// =============================================================================

describe("CI/CD: exact user snippet from issue #5", () => {
  // --- The exact code from the user's PR comment ---
  const clientOptions: ClientOptions = {
    baseUrl: "https://petstore.example.com",
    credentials: "include"
  }
  const apiClientEffect = createClientEffect<paths>(clientOptions)

  it("should compile and execute: apiClientEffect.POST('/api/auth/login', { body: credentials })", () =>
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

      // Type-safe — path, method, and body all enforced at compile time
      const result = yield* Effect.either(
        apiClientEffect.POST("/api/auth/login", {
          body: credentials
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
        const body = result.right.body as { id: string; email: string }
        expect(body.email).toBe("user@example.com")
      }
    }).pipe(Effect.runPromise))

  it("should compile and execute: yield* apiClientEffect.POST (inside Effect.gen)", () =>
    Effect.gen(function*() {
      const credentials = fixtures.loginBody()
      const successBody = JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "user@example.com"
      })

      // This verifies the `yield*` pattern from the user's snippet
      const result = yield* apiClientEffect.POST("/api/auth/login", {
        body: credentials
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer(200, { "content-type": "application/json" }, successBody)
        )
      )

      expect(result.status).toBe(200)
      expect(result.contentType).toBe("application/json")
      const body = result.body as { email: string }
      expect(body.email).toBe("user@example.com")
    }).pipe(Effect.runPromise))

  it("should handle error responses via Effect error channel", () =>
    Effect.gen(function*() {
      const credentials = fixtures.wrongLoginBody()
      const errorBody = JSON.stringify({ error: "invalid_credentials" })

      const result = yield* Effect.either(
        apiClientEffect.POST("/api/auth/login", {
          body: credentials
        }).pipe(
          Effect.provide(
            createMockHttpClientLayer(401, { "content-type": "application/json" }, errorBody)
          )
        )
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "HttpError",
          status: 401
        })
      }
    }).pipe(Effect.runPromise))

  it("should work with GET requests (no body required)", () =>
    Effect.gen(function*() {
      const profileBody = JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "user@example.com"
      })

      const result = yield* apiClientEffect.GET("/api/auth/me").pipe(
        Effect.provide(
          createMockHttpClientLayer(200, { "content-type": "application/json" }, profileBody)
        )
      )

      expect(result.status).toBe(200)
      const body = result.body as { email: string }
      expect(body.email).toBe("user@example.com")
    }).pipe(Effect.runPromise))

  it("should handle 204 no-content responses", () =>
    Effect.gen(function*() {
      const result = yield* apiClientEffect.POST("/api/auth/logout").pipe(
        Effect.provide(
          createMockHttpClientLayer(204, {}, "")
        )
      )

      expect(result.status).toBe(204)
      expect(result.contentType).toBe("none")
      expect(result.body).toBeUndefined()
    }).pipe(Effect.runPromise))
})
