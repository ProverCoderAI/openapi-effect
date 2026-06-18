// CHANGE: Type-level contract tests for createClientEffect input inference
// WHY: Prove openapi-fetch-style inputs work while output is inferred as Effect channels
// QUOTE(ТЗ): "input должен быть 1 в 1"
// REF: user-msg-openapi-effect-input-compat
// SOURCE: n/a
// PURITY: CORE - compile-time tests only
// EFFECT: none - type assertions at compile time
// INVARIANT: method input types are derived from Paths; output types are derived from operation responses

import type { Effect } from "effect"
import { describe, expectTypeOf, it } from "vitest"

import type { ApiFailure, ApiSuccess } from "../../src/core/api-client/strict-types.js"
import { createClientEffect } from "../../src/index.js"
import type { Operations, Paths } from "../fixtures/petstore.openapi.js"

type PetstorePaths = Paths & object
type ListPetsResponses = Operations["listPets"]["responses"]
type CreatePetResponses = Operations["createPet"]["responses"]
type GetPetResponses = Operations["getPet"]["responses"]

describe("createClientEffect: openapi-fetch input shape", () => {
  const client = createClientEffect<PetstorePaths>()

  it("accepts GET query params and infers listPets response channels", () => {
    const _result = client.GET("/pets", {
      params: { query: { limit: 10 } }
    })

    expectTypeOf<typeof _result>().toEqualTypeOf<
      Effect.Effect<ApiSuccess<ListPetsResponses>, ApiFailure<ListPetsResponses>>
    >()
  })

  it("accepts path params and infers getPet response channels", () => {
    const _result = client.GET("/pets/{petId}", {
      params: { path: { petId: "42" } }
    })

    expectTypeOf<typeof _result>().toEqualTypeOf<
      Effect.Effect<ApiSuccess<GetPetResponses>, ApiFailure<GetPetResponses>>
    >()
  })

  it("accepts POST body and infers createPet response channels", () => {
    const _result = client.POST("/pets", {
      body: { name: "Rex" }
    })

    expectTypeOf<typeof _result>().toEqualTypeOf<
      Effect.Effect<ApiSuccess<CreatePetResponses>, ApiFailure<CreatePetResponses>>
    >()
  })

  it("accepts request(method, path, init) with the same nested params", () => {
    const _result = client.request("get", "/pets", {
      params: { query: { limit: 10 } }
    })

    expectTypeOf<typeof _result>().toEqualTypeOf<
      Effect.Effect<ApiSuccess<ListPetsResponses>, ApiFailure<ListPetsResponses>>
    >()
  })

  it("rejects missing path params", () => {
    // @ts-expect-error /pets/{petId} requires params.path.petId
    client.GET("/pets/{petId}")
    expectTypeOf<true>().toEqualTypeOf<true>()
  })

  it("rejects wrong nested path param shape", () => {
    // @ts-expect-error petId is required inside params.path
    client.GET("/pets/{petId}", { params: { path: {} } })
    expectTypeOf<true>().toEqualTypeOf<true>()
  })

  it("rejects missing POST body", () => {
    // @ts-expect-error /pets POST requires request body
    client.POST("/pets")
    expectTypeOf<true>().toEqualTypeOf<true>()
  })

  it("rejects invalid method/path combinations", () => {
    // @ts-expect-error /pets/{petId} does not define POST
    client.POST("/pets/{petId}", { body: { name: "Rex" } })
    expectTypeOf<true>().toEqualTypeOf<true>()
  })
})
