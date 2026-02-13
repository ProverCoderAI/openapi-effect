// CHANGE: Integration test for createClientEffect using openapi-fetch response envelope
// WHY: Validate drop-in input contract with Effect output channel
// QUOTE(ТЗ): "input 1 в 1 ... output Effect<,,>"
// REF: user-msg-2026-02-12
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Effect<void, never, never>
// INVARIANT: HTTP non-2xx stays in `error` field, transport failures stay in Effect error channel
// COMPLEXITY: O(1) per test

import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import type { paths } from "../../src/core/api/openapi.js"
import { createClientEffect } from "../../src/index.js"
import type { ClientOptions } from "../../src/index.js"

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

describe("createClientEffect integration", () => {
  it("returns { data, response } for 200 login", () =>
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
      const apiClientEffect = createClientEffect<paths>(clientOptions)

      const generatedPassword = `pw-${Date.now()}`
      const result = yield* apiClientEffect.POST("/api/auth/login", {
        body: { email: "user@example.com", password: generatedPassword }
      })

      expect(result.response.status).toBe(200)
      expect(result.error).toBeUndefined()
      expect(result.data).toMatchObject({ email: "user@example.com" })
    }).pipe(Effect.runPromise))

  it("returns { error, response } for 401 login", () =>
    Effect.gen(function*() {
      const errorBody = JSON.stringify({ error: "invalid_credentials" })

      const clientOptions: ClientOptions = {
        baseUrl: "https://petstore.example.com",
        credentials: "include",
        fetch: createMockFetch(401, { "content-type": "application/json" }, errorBody)
      }
      const apiClientEffect = createClientEffect<paths>(clientOptions)

      const generatedPassword = `bad-${Date.now()}`
      const result = yield* apiClientEffect.POST("/api/auth/login", {
        body: { email: "user@example.com", password: generatedPassword }
      })

      expect(result.response.status).toBe(401)
      expect(result.data).toBeUndefined()
      expect(result.error).toMatchObject({ error: "invalid_credentials" })
    }).pipe(Effect.runPromise))

  it("handles GET without body", () =>
    Effect.gen(function*() {
      const profileBody = JSON.stringify({
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "user@example.com"
      })

      const clientOptions: ClientOptions = {
        baseUrl: "https://petstore.example.com",
        credentials: "include",
        fetch: createMockFetch(200, { "content-type": "application/json" }, profileBody)
      }
      const apiClientEffect = createClientEffect<paths>(clientOptions)

      const result = yield* apiClientEffect.GET("/api/auth/me")

      expect(result.response.status).toBe(200)
      expect(result.data).toMatchObject({ email: "user@example.com" })
    }).pipe(Effect.runPromise))

  it("handles 204 no-content", () =>
    Effect.gen(function*() {
      const clientOptions: ClientOptions = {
        baseUrl: "https://petstore.example.com",
        credentials: "include",
        fetch: createMockFetch(204, {}, "")
      }
      const apiClientEffect = createClientEffect<paths>(clientOptions)

      const result = yield* apiClientEffect.POST("/api/auth/logout")

      expect(result.response.status).toBe(204)
      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    }).pipe(Effect.runPromise))
})
