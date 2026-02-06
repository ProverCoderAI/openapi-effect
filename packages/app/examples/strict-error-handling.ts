// CHANGE: Strict example demonstrating forced E=never error handling
// WHY: Prove that after catchTags with Match.exhaustive, the error channel becomes 'never'
// QUOTE(ТЗ): "Приёмка по смыслу: после catchTags(...) тип ошибки становится never"
// REF: PR#3 blocking review from skulidropek
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Effect<void, never, HttpClient> - all errors handled

import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import type * as HttpClient from "@effect/platform/HttpClient"
import { Cause, Console, Effect, Match } from "effect"
import "../src/generated/dispatchers-by-path.js"
import { type ClientOptions, createClient } from "../src/shell/api-client/create-client.js"
import type { Paths } from "../tests/fixtures/petstore.openapi.js"

/**
 * Client configuration
 */
const clientOptions: ClientOptions = {
  baseUrl: "https://petstore.example.com",
  credentials: "include"
}

// CHANGE: Use default dispatcher registry (registered by generated module)
// WHY: Call createClient(options) without passing dispatcher map
// QUOTE(ТЗ): "const apiClient = createClient<Paths>(clientOptions)"
// REF: user-msg-4
// SOURCE: n/a
// FORMAT THEOREM: ∀ op ∈ Operations: createClient(options) uses registered dispatchers
// PURITY: SHELL
// EFFECT: none
// INVARIANT: default dispatchers registered before client creation
// COMPLEXITY: O(1)
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
  yield* apiClient.GET("/pets/{petId}", { params: { petId: "123" } }).pipe(
    Effect.tap((result) => Console.log(`Got pet: ${result.body.name}`))
  )
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
  Effect.catchTag("UnexpectedContentType", (e) => Console.log(`Unexpected content-type: ${e.actual ?? "unknown"}`)),
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

  yield* apiClient.POST(
    "/pets",
    {
      // Body can be typed object - client will auto-stringify and set Content-Type
      body: { name: "Fluffy", tag: "cat" }
    }
  ).pipe(
    Effect.tap((result) => Console.log(`Created pet: ${result.body.id}`))
  )
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
  Effect.catchTag("UnexpectedContentType", (e) => Console.log(`Unexpected content-type: ${e.actual ?? "unknown"}`)),
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

  yield* apiClient.GET("/pets", { query: { limit: 10 } }).pipe(
    Effect.tap((result) => Console.log(`Got ${result.body.length} pets`))
  )

  const pets = yield* apiClient.GET("/pets", { query: { limit: 10 } })

  yield* Console.log(`Got ${pets.body.length} pets`)
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
  Effect.catchTag("UnexpectedContentType", (e) => Console.log(`Unexpected content-type: ${e.actual ?? "unknown"}`)),
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

// CHANGE: Remove async/await entrypoint and handle defects in Effect
// WHY: Lint rules forbid async/await and floating promises; defects are handled in Effect channel
// QUOTE(ТЗ): "Запрещён async/await — используй Effect.gen / Effect.tryPromise."
// REF: user-msg-2
// SOURCE: n/a
// FORMAT THEOREM: For all exits, mainProgram E=never implies failure(exit) -> defect(exit)
// PURITY: SHELL
// EFFECT: Effect<void, never, HttpClient> -> Promise<void> via Effect.runPromise
// INVARIANT: Typed error channel remains never
// COMPLEXITY: O(1)
const program = mainProgram.pipe(
  Effect.provide(FetchHttpClient.layer),
  Effect.catchAllCause((cause) => Console.error(`Unexpected defect: ${Cause.pretty(cause)}`))
)

void Effect.runPromise(program)
