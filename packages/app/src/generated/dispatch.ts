// CHANGE: Auto-generated dispatchers for all operations with Effect-native error handling
// WHY: Maintain compile-time correlation between status codes and body types
// QUOTE(ТЗ): "реализует switch(status) по всем статусам схемы; Failure включает все инварианты протокола и схемы"
// REF: issue-2, section 5.2, 4.1-4.3
// SOURCE: Generated from tests/fixtures/petstore.openapi.json
// FORMAT THEOREM: ∀ op ∈ Operations: dispatcher(op) → Effect<ApiSuccess, HttpError | BoundaryError>
// PURITY: SHELL
// EFFECT: Effect<ApiSuccess<Responses>, HttpError<Responses> | BoundaryError, never>
// INVARIANT: 2xx → success channel, non-2xx → error channel (forced handling)
// COMPLEXITY: O(1) per dispatch (Match lookup)

import { Effect, Match } from "effect"
import type { Operations } from "../../tests/fixtures/petstore.openapi.js"
import type { DecodeError, ResponsesFor } from "../core/api-client/strict-types.js"
import { asConst, type Json } from "../core/axioms.js"
import {
  createDispatcher,
  parseJSON,
  unexpectedContentType,
  unexpectedStatus
} from "../shell/api-client/strict-client.js"
import * as Decoders from "./decoders.js"

// Response types for each operation - used for type inference
type ListPetsResponses = ResponsesFor<Operations["listPets"]>
type CreatePetResponses = ResponsesFor<Operations["createPet"]>
type GetPetResponses = ResponsesFor<Operations["getPet"]>
type DeletePetResponses = ResponsesFor<Operations["deletePet"]>

/**
 * Helper: process JSON content type for a given status - returns SUCCESS variant
 * Used for 2xx responses that go to the success channel
 */
const processJsonContentSuccess = <S extends number, D>(
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
 * Helper: process JSON content type for a given status - returns HTTP ERROR variant
 * Used for non-2xx responses (4xx, 5xx) that go to the error channel.
 *
 * Adds `_tag: "HttpError"` discriminator to distinguish from BoundaryError.
 */
const processJsonContentError = <S extends number, D>(
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
      // Non-2xx: Return as FAILURE with _tag discriminator (goes to error channel)
      return yield* Effect.fail(asConst({
        _tag: "HttpError" as const,
        status,
        contentType: "application/json" as const,
        body: decoded
      }))
    })
    : Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))

/**
 * Dispatcher for listPets
 * Handles statuses: 200 (success), 500 (error)
 *
 * Effect channel mapping:
 * - 200: success channel → ApiSuccess
 * - 500: error channel → HttpError (forces explicit handling)
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatcherlistPets = createDispatcher<ListPetsResponses>((status, contentType, text) =>
  Match.value(status).pipe(
    Match.when(200, () => processJsonContentSuccess(200, contentType, text, Decoders.decodelistPets_200)),
    Match.when(500, () => processJsonContentError(500, contentType, text, Decoders.decodelistPets_500)),
    Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
  )
)

/**
 * Dispatcher for createPet
 * Handles statuses: 201 (success), 400 (error), 500 (error)
 *
 * Effect channel mapping:
 * - 201: success channel → ApiSuccess
 * - 400, 500: error channel → HttpError (forces explicit handling)
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatchercreatePet = createDispatcher<CreatePetResponses>((status, contentType, text) =>
  Match.value(status).pipe(
    Match.when(201, () => processJsonContentSuccess(201, contentType, text, Decoders.decodecreatePet_201)),
    Match.when(400, () => processJsonContentError(400, contentType, text, Decoders.decodecreatePet_400)),
    Match.when(500, () => processJsonContentError(500, contentType, text, Decoders.decodecreatePet_500)),
    Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
  )
)

/**
 * Dispatcher for getPet
 * Handles statuses: 200 (success), 404 (error), 500 (error)
 *
 * Effect channel mapping:
 * - 200: success channel → ApiSuccess
 * - 404, 500: error channel → HttpError (forces explicit handling)
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatchergetPet = createDispatcher<GetPetResponses>((status, contentType, text) =>
  Match.value(status).pipe(
    Match.when(200, () => processJsonContentSuccess(200, contentType, text, Decoders.decodegetPet_200)),
    Match.when(404, () => processJsonContentError(404, contentType, text, Decoders.decodegetPet_404)),
    Match.when(500, () => processJsonContentError(500, contentType, text, Decoders.decodegetPet_500)),
    Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
  )
)

/**
 * Dispatcher for deletePet
 * Handles statuses: 204 (success), 404 (error), 500 (error)
 *
 * Effect channel mapping:
 * - 204: success channel → ApiSuccess (no content)
 * - 404, 500: error channel → HttpError (forces explicit handling)
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatcherdeletePet = createDispatcher<DeletePetResponses>((status, contentType, text) =>
  Match.value(status).pipe(
    Match.when(204, () =>
      Effect.succeed(
        asConst({
          status: 204,
          contentType: "none" as const,
          body: undefined
        })
      )),
    Match.when(404, () => processJsonContentError(404, contentType, text, Decoders.decodedeletePet_404)),
    Match.when(500, () => processJsonContentError(500, contentType, text, Decoders.decodedeletePet_500)),
    Match.orElse(() => Effect.fail(unexpectedStatus(status, text)))
  )
)
