// CHANGE: Auto-generated dispatchers for all operations
// WHY: Maintain compile-time correlation between status codes and body types
// QUOTE(ТЗ): "реализует switch(status) по всем статусам схемы"
// REF: issue-2, section 5.2
// SOURCE: Generated from tests/fixtures/petstore.openapi.json
// FORMAT THEOREM: ∀ op ∈ Operations: dispatcher(op) handles all statuses in schema
// PURITY: SHELL
// EFFECT: Effect<Success | HttpError, BoundaryError, never>
// INVARIANT: Exhaustive coverage of all schema statuses and content-types
// COMPLEXITY: O(1) per dispatch (Match lookup)

import { Effect, Match } from "effect"
import type { DecodeError } from "../core/api-client/strict-types.js"
import { asConst, type Json } from "../core/axioms.js"
import {
  createDispatcher,
  parseJSON,
  unexpectedContentType,
  unexpectedStatus
} from "../shell/api-client/strict-client.js"
import * as Decoders from "./decoders.js"

/**
 * Helper: process JSON content type for a given status
 */
const processJsonContent = <S extends number, D>(
  status: S,
  contentType: string | undefined,
  text: string,
  decoder: (
    s: number,
    ct: string,
    body: string,
    parsed: Json
  ) => Effect.Effect<D, DecodeError>
) =>
  contentType?.includes("application/json")
    ? Effect.gen(function*() {
      const parsed = yield* parseJSON(status, "application/json", text)
      const decoded = yield* decoder(status, "application/json", text, parsed)
      return asConst({
        status,
        contentType: "application/json" as const,
        body: decoded
      })
    })
    : Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))

/**
 * Dispatcher for listPets
 * Handles statuses: 200, 500
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatcherlistPets = createDispatcher((status, contentType, text) =>
  Match.value(status).pipe(
    Match.when(200, () => processJsonContent(200, contentType, text, Decoders.decodelistPets_200)),
    Match.when(500, () => processJsonContent(500, contentType, text, Decoders.decodelistPets_500)),
    Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
  )
)

/**
 * Dispatcher for createPet
 * Handles statuses: 201, 400, 500
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatchercreatePet = createDispatcher((status, contentType, text) =>
  Match.value(status).pipe(
    Match.when(201, () => processJsonContent(201, contentType, text, Decoders.decodecreatePet_201)),
    Match.when(400, () => processJsonContent(400, contentType, text, Decoders.decodecreatePet_400)),
    Match.when(500, () => processJsonContent(500, contentType, text, Decoders.decodecreatePet_500)),
    Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
  )
)

/**
 * Dispatcher for getPet
 * Handles statuses: 200, 404, 500
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatchergetPet = createDispatcher((status, contentType, text) =>
  Match.value(status).pipe(
    Match.when(200, () => processJsonContent(200, contentType, text, Decoders.decodegetPet_200)),
    Match.when(404, () => processJsonContent(404, contentType, text, Decoders.decodegetPet_404)),
    Match.when(500, () => processJsonContent(500, contentType, text, Decoders.decodegetPet_500)),
    Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
  )
)

/**
 * Dispatcher for deletePet
 * Handles statuses: 204, 404, 500
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatcherdeletePet = createDispatcher((status, contentType, text) =>
  Match.value(status).pipe(
    Match.when(204, () =>
      Effect.succeed(
        asConst({
          status: 204,
          contentType: "none" as const,
          body: undefined
        })
      )),
    Match.when(404, () => processJsonContent(404, contentType, text, Decoders.decodedeletePet_404)),
    Match.when(500, () => processJsonContent(500, contentType, text, Decoders.decodedeletePet_500)),
    Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
  )
)
