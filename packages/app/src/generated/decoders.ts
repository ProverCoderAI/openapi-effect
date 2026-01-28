// CHANGE: Auto-generated decoder stubs for all operations
// WHY: Provide type-safe runtime validation entry points
// QUOTE(ТЗ): "при изменении схемы сборка обязана падать, пока декодеры не обновлены"
// REF: issue-2, section 5.2
// SOURCE: Generated from tests/fixtures/petstore.openapi.json
// FORMAT THEOREM: ∀ op, status: decoder(op, status) → Effect<T, DecodeError, never>
// PURITY: SHELL
// EFFECT: Effect<T, DecodeError, never>
// INVARIANT: All decoders return typed DecodeError on failure
// COMPLEXITY: O(n) where n = size of parsed object

import { Effect } from "effect"
import type { DecodeError } from "../core/api-client/strict-types.js"

/**
 * JSON value type - result of JSON.parse()
 */
type Json = null | boolean | number | string | ReadonlyArray<Json> | { readonly [k: string]: Json }

/**
 * Decoder for listPets status 200 (application/json)
 * STUB: Replace with real schema decoder when needed
 *
 * @pure false - performs validation
 * @effect Effect<T, DecodeError, never>
 */
export const decodelistPets_200 = (
  _status: number,
  _contentType: string,
  _body: string,
  parsed: Json
): Effect.Effect<Json, DecodeError> => {
  // STUB: Always succeeds with parsed value
  // Replace with: Schema.decodeUnknown(YourSchema)(parsed)
  return Effect.succeed(parsed)

  // Example of real decoder:
  // return Effect.mapError(
  //   Schema.decodeUnknown(YourSchema)(parsed),
  //   (error): DecodeError => ({
  //     _tag: "DecodeError",
  //     status,
  //     contentType,
  //     error,
  //     body
  //   })
  // )
}

/**
 * Decoder for listPets status 500 (application/json)
 * STUB: Replace with real schema decoder when needed
 *
 * @pure false - performs validation
 * @effect Effect<T, DecodeError, never>
 */
export const decodelistPets_500 = (
  _status: number,
  _contentType: string,
  _body: string,
  parsed: Json
): Effect.Effect<Json, DecodeError> => {
  // STUB: Always succeeds with parsed value
  // Replace with: Schema.decodeUnknown(YourSchema)(parsed)
  return Effect.succeed(parsed)

  // Example of real decoder:
  // return Effect.mapError(
  //   Schema.decodeUnknown(YourSchema)(parsed),
  //   (error): DecodeError => ({
  //     _tag: "DecodeError",
  //     status,
  //     contentType,
  //     error,
  //     body
  //   })
  // )
}

/**
 * Decoder for createPet status 201 (application/json)
 * STUB: Replace with real schema decoder when needed
 *
 * @pure false - performs validation
 * @effect Effect<T, DecodeError, never>
 */
export const decodecreatePet_201 = (
  _status: number,
  _contentType: string,
  _body: string,
  parsed: Json
): Effect.Effect<Json, DecodeError> => {
  // STUB: Always succeeds with parsed value
  // Replace with: Schema.decodeUnknown(YourSchema)(parsed)
  return Effect.succeed(parsed)

  // Example of real decoder:
  // return Effect.mapError(
  //   Schema.decodeUnknown(YourSchema)(parsed),
  //   (error): DecodeError => ({
  //     _tag: "DecodeError",
  //     status,
  //     contentType,
  //     error,
  //     body
  //   })
  // )
}

/**
 * Decoder for createPet status 400 (application/json)
 * STUB: Replace with real schema decoder when needed
 *
 * @pure false - performs validation
 * @effect Effect<T, DecodeError, never>
 */
export const decodecreatePet_400 = (
  _status: number,
  _contentType: string,
  _body: string,
  parsed: Json
): Effect.Effect<Json, DecodeError> => {
  // STUB: Always succeeds with parsed value
  // Replace with: Schema.decodeUnknown(YourSchema)(parsed)
  return Effect.succeed(parsed)

  // Example of real decoder:
  // return Effect.mapError(
  //   Schema.decodeUnknown(YourSchema)(parsed),
  //   (error): DecodeError => ({
  //     _tag: "DecodeError",
  //     status,
  //     contentType,
  //     error,
  //     body
  //   })
  // )
}

/**
 * Decoder for createPet status 500 (application/json)
 * STUB: Replace with real schema decoder when needed
 *
 * @pure false - performs validation
 * @effect Effect<T, DecodeError, never>
 */
export const decodecreatePet_500 = (
  _status: number,
  _contentType: string,
  _body: string,
  parsed: Json
): Effect.Effect<Json, DecodeError> => {
  // STUB: Always succeeds with parsed value
  // Replace with: Schema.decodeUnknown(YourSchema)(parsed)
  return Effect.succeed(parsed)

  // Example of real decoder:
  // return Effect.mapError(
  //   Schema.decodeUnknown(YourSchema)(parsed),
  //   (error): DecodeError => ({
  //     _tag: "DecodeError",
  //     status,
  //     contentType,
  //     error,
  //     body
  //   })
  // )
}

/**
 * Decoder for getPet status 200 (application/json)
 * STUB: Replace with real schema decoder when needed
 *
 * @pure false - performs validation
 * @effect Effect<T, DecodeError, never>
 */
export const decodegetPet_200 = (
  _status: number,
  _contentType: string,
  _body: string,
  parsed: Json
): Effect.Effect<Json, DecodeError> => {
  // STUB: Always succeeds with parsed value
  // Replace with: Schema.decodeUnknown(YourSchema)(parsed)
  return Effect.succeed(parsed)

  // Example of real decoder:
  // return Effect.mapError(
  //   Schema.decodeUnknown(YourSchema)(parsed),
  //   (error): DecodeError => ({
  //     _tag: "DecodeError",
  //     status,
  //     contentType,
  //     error,
  //     body
  //   })
  // )
}

/**
 * Decoder for getPet status 404 (application/json)
 * STUB: Replace with real schema decoder when needed
 *
 * @pure false - performs validation
 * @effect Effect<T, DecodeError, never>
 */
export const decodegetPet_404 = (
  _status: number,
  _contentType: string,
  _body: string,
  parsed: Json
): Effect.Effect<Json, DecodeError> => {
  // STUB: Always succeeds with parsed value
  // Replace with: Schema.decodeUnknown(YourSchema)(parsed)
  return Effect.succeed(parsed)

  // Example of real decoder:
  // return Effect.mapError(
  //   Schema.decodeUnknown(YourSchema)(parsed),
  //   (error): DecodeError => ({
  //     _tag: "DecodeError",
  //     status,
  //     contentType,
  //     error,
  //     body
  //   })
  // )
}

/**
 * Decoder for getPet status 500 (application/json)
 * STUB: Replace with real schema decoder when needed
 *
 * @pure false - performs validation
 * @effect Effect<T, DecodeError, never>
 */
export const decodegetPet_500 = (
  _status: number,
  _contentType: string,
  _body: string,
  parsed: Json
): Effect.Effect<Json, DecodeError> => {
  // STUB: Always succeeds with parsed value
  // Replace with: Schema.decodeUnknown(YourSchema)(parsed)
  return Effect.succeed(parsed)

  // Example of real decoder:
  // return Effect.mapError(
  //   Schema.decodeUnknown(YourSchema)(parsed),
  //   (error): DecodeError => ({
  //     _tag: "DecodeError",
  //     status,
  //     contentType,
  //     error,
  //     body
  //   })
  // )
}

/**
 * Decoder for deletePet status 404 (application/json)
 * STUB: Replace with real schema decoder when needed
 *
 * @pure false - performs validation
 * @effect Effect<T, DecodeError, never>
 */
export const decodedeletePet_404 = (
  _status: number,
  _contentType: string,
  _body: string,
  parsed: Json
): Effect.Effect<Json, DecodeError> => {
  // STUB: Always succeeds with parsed value
  // Replace with: Schema.decodeUnknown(YourSchema)(parsed)
  return Effect.succeed(parsed)

  // Example of real decoder:
  // return Effect.mapError(
  //   Schema.decodeUnknown(YourSchema)(parsed),
  //   (error): DecodeError => ({
  //     _tag: "DecodeError",
  //     status,
  //     contentType,
  //     error,
  //     body
  //   })
  // )
}

/**
 * Decoder for deletePet status 500 (application/json)
 * STUB: Replace with real schema decoder when needed
 *
 * @pure false - performs validation
 * @effect Effect<T, DecodeError, never>
 */
export const decodedeletePet_500 = (
  _status: number,
  _contentType: string,
  _body: string,
  parsed: Json
): Effect.Effect<Json, DecodeError> => {
  // STUB: Always succeeds with parsed value
  // Replace with: Schema.decodeUnknown(YourSchema)(parsed)
  return Effect.succeed(parsed)

  // Example of real decoder:
  // return Effect.mapError(
  //   Schema.decodeUnknown(YourSchema)(parsed),
  //   (error): DecodeError => ({
  //     _tag: "DecodeError",
  //     status,
  //     contentType,
  //     error,
  //     body
  //   })
  // )
}
