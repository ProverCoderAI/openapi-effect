// CHANGE: Strict example demonstrating forced E=never error handling
// WHY: Prove that after catchTags with Match.exhaustive, the error channel becomes 'never'
// QUOTE(ТЗ): "Приёмка по смыслу: после catchTags(...) тип ошибки становится never"
// REF: PR#3 blocking review from skulidropek
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Effect<void, never, HttpClient> - all errors handled

import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import type * as HttpClient from "@effect/platform/HttpClient"
import { Console, Effect, Exit, Match } from "effect"
import { createClient, type ClientOptions } from "../src/shell/api-client/create-client.js"
import { dispatchercreatePet, dispatchergetPet, dispatcherlistPets } from "../src/generated/dispatch.js"
import type { Paths } from "../tests/fixtures/petstore.openapi.js"

/**
 * Client configuration
 */
const clientOptions: ClientOptions = {
  baseUrl: "https://petstore.example.com",
  credentials: "include"
}

const apiClient = createClient<Paths>(clientOptions)

// =============================================================================
// STRICT EXAMPLE 1: getPet - handles 404, 500 + all boundary errors
// =============================================================================

/**
 * CRITICAL: This program has E=never - all errors are explicitly handled!
 *
 * The reviewer requires:
 * 1. Only Match.exhaustive (no Match.orElse)
 * 2. All _tag variants handled via catchTags
 * 3. After catchTags, type becomes Effect<void, never, HttpClient>
 *
 * Schema: getPet has responses 200 (success), 404 (error), 500 (error)
 * Error channel: HttpError<404 | 500> | BoundaryError
 *
 * @invariant After catchTags, E = never
 * @effect Effect<void, never, HttpClient>
 */
export const getPetStrictProgram: Effect.Effect<void, never, HttpClient.HttpClient> = Effect.gen(function*() {
  yield* Console.log("=== getPet: Strict Error Handling ===")

  // Execute request - yields only on 200
  const result = yield* apiClient.GET(
    "/pets/{petId}",
    dispatchergetPet,
    { params: { petId: "123" } }
  )

  // Success! TypeScript knows status is 200
  yield* Console.log(`Got pet: ${result.body.name}`)
}).pipe(
  // Handle HttpError with EXHAUSTIVE matching (no orElse!)
  Effect.catchTag("HttpError", (error) =>
    Match.value(error.status).pipe(
      Match.when(404, () => Console.log(`Not found: ${JSON.stringify(error.body)}`)),
      Match.when(500, () => Console.log(`Server error: ${JSON.stringify(error.body)}`)),
      // CRITICAL: Match.exhaustive - forces handling ALL schema statuses
      // If a new status (e.g., 401) is added to schema, this will fail typecheck
      Match.exhaustive
    )),
  // Handle ALL boundary errors
  Effect.catchTag("TransportError", (e) => Console.log(`Transport error: ${e.error.message}`)),
  Effect.catchTag("UnexpectedStatus", (e) => Console.log(`Unexpected status: ${e.status}`)),
  Effect.catchTag("UnexpectedContentType", (e) => Console.log(`Unexpected content-type: ${e.actual}`)),
  Effect.catchTag("ParseError", (e) => Console.log(`Parse error: ${e.error.message}`)),
  Effect.catchTag("DecodeError", (e) => Console.log(`Decode error: ${e.error.message}`))
)

// =============================================================================
// STRICT EXAMPLE 2: createPet - handles 400, 500 + all boundary errors
// =============================================================================

/**
 * createPet strict handler
 *
 * Schema: createPet has responses 201 (success), 400 (error), 500 (error)
 * Error channel: HttpError<400 | 500> | BoundaryError
 *
 * @invariant After catchTags, E = never
 * @effect Effect<void, never, HttpClient>
 */
export const createPetStrictProgram: Effect.Effect<void, never, HttpClient.HttpClient> = Effect.gen(function*() {
  yield* Console.log("=== createPet: Strict Error Handling ===")

  const result = yield* apiClient.POST(
    "/pets",
    dispatchercreatePet,
    {
      body: JSON.stringify({ name: "Fluffy", tag: "cat" }),
      headers: { "Content-Type": "application/json" }
    }
  )

  // Success! TypeScript knows status is 201
  yield* Console.log(`Created pet: ${result.body.id}`)
}).pipe(
  // Handle HttpError with EXHAUSTIVE matching
  Effect.catchTag("HttpError", (error) =>
    Match.value(error.status).pipe(
      Match.when(400, () => Console.log(`Validation error: ${JSON.stringify(error.body)}`)),
      Match.when(500, () => Console.log(`Server error: ${JSON.stringify(error.body)}`)),
      // Match.exhaustive forces handling 400 AND 500
      Match.exhaustive
    )),
  // Handle ALL boundary errors
  Effect.catchTag("TransportError", (e) => Console.log(`Transport error: ${e.error.message}`)),
  Effect.catchTag("UnexpectedStatus", (e) => Console.log(`Unexpected status: ${e.status}`)),
  Effect.catchTag("UnexpectedContentType", (e) => Console.log(`Unexpected content-type: ${e.actual}`)),
  Effect.catchTag("ParseError", (e) => Console.log(`Parse error: ${e.error.message}`)),
  Effect.catchTag("DecodeError", (e) => Console.log(`Decode error: ${e.error.message}`))
)

// =============================================================================
// STRICT EXAMPLE 3: listPets - handles 500 + all boundary errors
// =============================================================================

/**
 * listPets strict handler
 *
 * Schema: listPets has responses 200 (success), 500 (error)
 * Error channel: HttpError<500> | BoundaryError
 *
 * @invariant After catchTags, E = never
 * @effect Effect<void, never, HttpClient>
 */
export const listPetsStrictProgram: Effect.Effect<void, never, HttpClient.HttpClient> = Effect.gen(function*() {
  yield* Console.log("=== listPets: Strict Error Handling ===")

  const result = yield* apiClient.GET(
    "/pets",
    dispatcherlistPets,
    { query: { limit: 10 } }
  )

  // Success! TypeScript knows status is 200
  yield* Console.log(`Got ${result.body.length} pets`)
}).pipe(
  // Handle HttpError with EXHAUSTIVE matching
  Effect.catchTag("HttpError", (error) =>
    Match.value(error.status).pipe(
      Match.when(500, () => Console.log(`Server error: ${JSON.stringify(error.body)}`)),
      // Match.exhaustive - only 500 needs handling for listPets
      Match.exhaustive
    )),
  // Handle ALL boundary errors
  Effect.catchTag("TransportError", (e) => Console.log(`Transport error: ${e.error.message}`)),
  Effect.catchTag("UnexpectedStatus", (e) => Console.log(`Unexpected status: ${e.status}`)),
  Effect.catchTag("UnexpectedContentType", (e) => Console.log(`Unexpected content-type: ${e.actual}`)),
  Effect.catchTag("ParseError", (e) => Console.log(`Parse error: ${e.error.message}`)),
  Effect.catchTag("DecodeError", (e) => Console.log(`Decode error: ${e.error.message}`))
)

// =============================================================================
// MAIN: Run all strict programs
// =============================================================================

/**
 * Main program combines all strict examples
 * Type annotation proves E=never: Effect<void, never, HttpClient>
 */
const mainProgram: Effect.Effect<void, never, HttpClient.HttpClient> = Effect.gen(function*() {
  yield* Console.log("========================================")
  yield* Console.log("  Strict Error Handling Examples")
  yield* Console.log("  (All have E=never)")
  yield* Console.log("========================================\n")

  // All these programs have E=never - errors fully handled
  yield* getPetStrictProgram
  yield* Console.log("")

  yield* createPetStrictProgram
  yield* Console.log("")

  yield* listPetsStrictProgram

  yield* Console.log("\n========================================")
  yield* Console.log("  All errors handled - E=never verified!")
  yield* Console.log("========================================")
})

/**
 * Execute the program
 *
 * CRITICAL: Since mainProgram has E=never, Effect.runPromiseExit
 * will never fail with a typed error - only defects are possible.
 */
const program = mainProgram.pipe(
  Effect.provide(FetchHttpClient.layer)
)

const main = async () => {
  const exit = await Effect.runPromiseExit(program)
  if (Exit.isFailure(exit)) {
    // This can only be a defect (unexpected exception), not a typed error
    console.error("Unexpected defect:", exit.cause)
  }
}

main()
