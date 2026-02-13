// CHANGE: Add tests for createClient dispatcher-less usage with openapi-fetch envelope
// WHY: Verify createClient can be used without per-call dispatcher and keeps openapi-fetch response shape
// QUOTE(ТЗ): "openapi-effect должен почти 1 в 1 заменяться с openapi-fetch"
// REF: user-msg-2026-02-12
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Effect<void, never, never>
// INVARIANT: 2xx -> data, non-2xx -> error in success channel
// COMPLEXITY: O(1) per test

import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import "../../src/generated/dispatchers-by-path.js"
import { createClient } from "../../src/shell/api-client/create-client.js"
import type { Paths } from "../fixtures/petstore.openapi.js"

type PetstorePaths = Paths & object

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

describe("createClient (auto-dispatching)", () => {
  it("should handle 200 success without passing dispatcher", () =>
    Effect.gen(function*() {
      const successBody = JSON.stringify([
        { id: "1", name: "Fluffy" },
        { id: "2", name: "Spot" }
      ])

      const client = createClient<PetstorePaths>({
        baseUrl: "https://api.example.com",
        fetch: createMockFetch(200, { "content-type": "application/json" }, successBody)
      })

      const result = yield* client.GET("/pets", {
        params: {
          query: { limit: 10 }
        }
      })

      expect(result.response.status).toBe(200)
      expect(Array.isArray(result.data)).toBe(true)
    }).pipe(Effect.runPromise))

  it("should keep schema 404 inside response envelope", () =>
    Effect.gen(function*() {
      const errorBody = JSON.stringify({ code: 404, message: "Pet not found" })

      const client = createClient<PetstorePaths>({
        baseUrl: "https://api.example.com",
        fetch: createMockFetch(404, { "content-type": "application/json" }, errorBody)
      })

      const result = yield* client.GET("/pets/{petId}", {
        params: {
          path: { petId: "999" }
        }
      })

      expect(result.response.status).toBe(404)
      expect(result.error).toMatchObject({ code: 404, message: "Pet not found" })
    }).pipe(Effect.runPromise))
})
