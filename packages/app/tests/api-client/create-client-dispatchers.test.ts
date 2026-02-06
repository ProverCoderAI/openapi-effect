// CHANGE: Add tests for auto-dispatching createClient
// WHY: Verify dispatcher map removes per-call dispatcher parameters while preserving error handling
// QUOTE(ТЗ): "ApiClient и так знает текущие типы. Зачем передавать что либо в GET"
// REF: user-msg-1
// SOURCE: n/a
// FORMAT THEOREM: ∀ op ∈ Operations: dispatchersByPath[path][method] = dispatcher(op)
// PURITY: SHELL
// EFFECT: Effect<void, never, never>
// INVARIANT: 2xx → isRight (success), non-2xx → isLeft (HttpError)
// COMPLEXITY: O(1) per test

import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Effect, Either, Layer } from "effect"
import { describe, expect, it } from "vitest"

import "../../src/generated/dispatchers-by-path.js"
import { createClient } from "../../src/shell/api-client/create-client.js"
import type { Paths } from "../fixtures/petstore.openapi.js"

type PetstorePaths = Paths & object

// CHANGE: Define dispatcher map for auto-dispatching client tests
// WHY: Verify createClient can infer dispatcher from path+method
// QUOTE(ТЗ): "Зачем передавать что либо в GET"
// REF: user-msg-1
// SOURCE: n/a
// FORMAT THEOREM: ∀ op ∈ Operations: dispatchersByPath[path][method] = dispatcher(op)
// PURITY: SHELL
// EFFECT: none
// INVARIANT: dispatcher map is total for all operations in Paths
// COMPLEXITY: O(1)
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

describe("createClient (auto-dispatching)", () => {
  it("should handle 200 success without passing dispatcher", () =>
    Effect.gen(function*() {
      const successBody = JSON.stringify([
        { id: "1", name: "Fluffy" },
        { id: "2", name: "Spot" }
      ])

      const client = createClient<PetstorePaths>({ baseUrl: "https://api.example.com" })

      const result = yield* Effect.either(
        client.GET("/pets", { query: { limit: 10 } }).pipe(
          Effect.provide(
            createMockHttpClientLayer(200, { "content-type": "application/json" }, successBody)
          )
        )
      )

      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right.status).toBe(200)
        expect(Array.isArray(result.right.body)).toBe(true)
      }
    }).pipe(Effect.runPromise))

  it("should return HttpError for schema 404 without passing dispatcher", () =>
    Effect.gen(function*() {
      const errorBody = JSON.stringify({ code: 404, message: "Pet not found" })

      const client = createClient<PetstorePaths>({ baseUrl: "https://api.example.com" })

      const result = yield* Effect.either(
        client.GET("/pets/{petId}", { params: { petId: "999" } }).pipe(
          Effect.provide(
            createMockHttpClientLayer(404, { "content-type": "application/json" }, errorBody)
          )
        )
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "HttpError",
          status: 404
        })
      }
    }).pipe(Effect.runPromise))
})
