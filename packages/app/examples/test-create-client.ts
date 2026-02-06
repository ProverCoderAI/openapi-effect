// CHANGE: Example script demonstrating Effect-native error handling with createClient
// WHY: Show how to handle HTTP errors (404, 500) via Effect error channel
// QUOTE(TZ): "Мы не заставляем обрабатывать потенциальные исключения... Должно быть типо результат который принимается и потециальные исключения которые надо обработать"
// REF: PR#3 comment from skulidropek about Effect representation
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Demonstrates Effect-based API calls with forced error handling

import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Console, Effect, Exit, Match } from "effect"
import {
  createClient,
  type ClientOptions
} from "../src/shell/api-client/create-client.js"
import "../src/generated/dispatchers-by-path.js"
import type { Paths } from "../tests/fixtures/petstore.openapi.js"
// Types are automatically inferred - no need to import them explicitly

/**
 * Example: Create API client with simplified API
 *
 * This demonstrates the ergonomic createClient API that matches
 * the interface requested by the reviewer.
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

/**
 * Example program: List all pets with Effect-native error handling
 *
 * NEW DESIGN:
 * - Success channel (yield*): Only 2xx responses
 * - Error channel (catchTag/catchAll): HTTP errors (500) + boundary errors
 *
 * This FORCES developers to handle HTTP errors explicitly!
 *
 * @pure false - performs HTTP request
 */
const listAllPetsExample = Effect.gen(function*() {
  yield* Console.log("=== Example 1: List all pets ===")

  // Execute request - type is automatically inferred from dispatcherlistPets
  // Now: success = 200 only, error = 500 | BoundaryError
  const result = yield* apiClient.GET(
    "/pets",
    {
      query: { limit: 10 }
    }
  )

  // Success! We only get here if status was 200
  // No need to check status - TypeScript knows it's 200
  const pets = result.body
  yield* Console.log(`Success: Got ${pets.length} pets`)
  if (pets.length > 0) {
    yield* Console.log(`  First pet: ${JSON.stringify(pets[0], null, 2)}`)
  }
}).pipe(
  // HTTP errors (500) now require explicit handling!
  Effect.catchTag("HttpError", (error) =>
    Console.log(`Server error (500): ${JSON.stringify(error.body)}`)),
  // Boundary errors are also in error channel
  Effect.catchTag("TransportError", (error) =>
    Console.log(`Transport error: ${error.error.message}`)),
  Effect.catchTag("UnexpectedStatus", (error) =>
    Console.log(`Unexpected status: ${error.status}`))
)

/**
 * Example program: Get specific pet
 *
 * Demonstrates handling multiple HTTP error statuses (404, 500).
 * Uses Match.exhaustive to force handling ALL schema-defined statuses.
 *
 * @pure false - performs HTTP request
 */
const getPetExample = Effect.gen(function*() {
  yield* Console.log("\n=== Example 2: Get specific pet ===")

  // Type is inferred from dispatchergetPet
  // Success = 200, Error = 404 | 500 | BoundaryError
  const result = yield* apiClient.GET(
    "/pets/{petId}",
    {
      params: { petId: "123" }
    }
  )

  // Success! Status is guaranteed to be 200
  yield* Console.log(`Success: Got pet "${result.body.name}"`)
  yield* Console.log(`  Tag: ${result.body.tag ?? "none"}`)
}).pipe(
  // Handle HTTP errors using Match.exhaustive - forces handling ALL schema statuses
  // CRITICAL: Match.exhaustive, not Match.orElse!
  Effect.catchTag("HttpError", (error) =>
    Match.value(error.status).pipe(
      Match.when(404, () => Console.log(`Not found: ${JSON.stringify(error.body)}`)),
      Match.when(500, () => Console.log(`Server error: ${JSON.stringify(error.body)}`)),
      Match.exhaustive // Forces handling all 404 | 500 - no escape hatch
    )),
  Effect.catchTag("TransportError", (error) =>
    Console.log(`Transport error: ${error.error.message}`))
)

/**
 * Example program: Create new pet
 *
 * Demonstrates handling validation errors (400).
 * Uses Match.exhaustive to force handling ALL schema-defined statuses.
 *
 * @pure false - performs HTTP request
 */
const createPetExample = Effect.gen(function*() {
  yield* Console.log("\n=== Example 3: Create new pet ===")

  const newPet = {
    name: "Fluffy",
    tag: "cat"
  }

  // Type is inferred from dispatchercreatePet
  // Success = 201, Error = 400 | 500 | BoundaryError
  const result = yield* apiClient.POST(
    "/pets",
    {
      // Typed body - client will auto-stringify and set Content-Type
      body: newPet
    }
  )

  // Success! Status is guaranteed to be 201
  yield* Console.log(`Success: Created pet with ID ${result.body.id}`)
  yield* Console.log(`  Name: ${result.body.name}`)
}).pipe(
  // Handle HTTP errors - FORCED by TypeScript!
  // CRITICAL: Match.exhaustive, not Match.orElse!
  Effect.catchTag("HttpError", (error) =>
    Match.value(error.status).pipe(
      Match.when(400, () => Console.log(`Validation error: ${JSON.stringify(error.body)}`)),
      Match.when(500, () => Console.log(`Server error: ${JSON.stringify(error.body)}`)),
      Match.exhaustive // Forces handling all 400 | 500 - no escape hatch
    )),
  Effect.catchTag("TransportError", (error) =>
    Console.log(`Transport error: ${error.error.message}`))
)

/**
 * Example program: Using Effect.either for conditional error handling
 *
 * Demonstrates how to access both success and error in one place.
 *
 * @pure false - performs HTTP request
 */
const eitherExample = Effect.gen(function*() {
  yield* Console.log("\n=== Example 4: Using Effect.either ===")

  const result = yield* Effect.either(
    apiClient.GET("/pets/{petId}", {
      params: { petId: "999" } // Non-existent pet
    })
  )

  if (result._tag === "Right") {
    // Success - got the pet
    yield* Console.log(`Found pet: ${result.right.body.name}`)
  } else {
    // Error - check the type
    const error = result.left
    if ("_tag" in error) {
      if (error._tag === "HttpError") {
        // HTTP error from schema (404 or 500)
        yield* Console.log(`HTTP error ${error.status}: ${JSON.stringify(error.body)}`)
      } else {
        // Boundary error (TransportError, UnexpectedStatus, etc.)
        yield* Console.log(`Boundary error: ${error._tag}`)
      }
    }
  }
})

/**
 * Main program - runs all examples
 *
 * @pure false - performs HTTP requests
 */
const mainProgram = Effect.gen(function*() {
  yield* Console.log("========================================")
  yield* Console.log("  OpenAPI Effect Client - Examples")
  yield* Console.log("  Effect-Native Error Handling")
  yield* Console.log("========================================\n")

  yield* Console.log("NEW DESIGN:")
  yield* Console.log("  - Success channel: 2xx responses only")
  yield* Console.log("  - Error channel: HTTP errors (4xx, 5xx) + boundary errors")
  yield* Console.log("  - Developers MUST handle HTTP errors explicitly!\n")

  yield* Console.log("Example code:")
  yield* Console.log('  const result = yield* client.GET("/path", { params })')
  yield* Console.log("  // result is 200 - no need to check status!")
  yield* Console.log("").pipe(Effect.flatMap(() =>
    Console.log("  // HTTP errors handled via Effect.catchTag or Effect.match\n")
  ))

  // Note: These examples will fail with transport errors since
  // we're not connecting to a real server. This is intentional
  // to demonstrate error handling.

  yield* listAllPetsExample.pipe(
    Effect.catchAll((error) =>
      Console.log(`Unhandled error in listAllPets: ${JSON.stringify(error)}`))
  )

  yield* getPetExample.pipe(
    Effect.catchAll((error) =>
      Console.log(`Unhandled error in getPet: ${JSON.stringify(error)}`))
  )

  yield* createPetExample.pipe(
    Effect.catchAll((error) =>
      Console.log(`Unhandled error in createPet: ${JSON.stringify(error)}`))
  )

  yield* eitherExample.pipe(
    Effect.catchAll((error) =>
      Console.log(`Unhandled error in either example: ${JSON.stringify(error)}`))
  )

  yield* Console.log("\nAll examples completed!")
  yield* Console.log("\nKey benefits of Effect-native error handling:")
  yield* Console.log("  - HTTP errors (404, 500) FORCE explicit handling")
  yield* Console.log("  - No accidental ignoring of error responses")
  yield* Console.log("  - Type-safe discrimination via _tag and status")
  yield* Console.log("  - Exhaustive pattern matching with Match.exhaustive")
})

/**
 * Execute the program with FetchHttpClient layer
 */
const program = mainProgram.pipe(
  Effect.provide(FetchHttpClient.layer)
)

/**
 * Run the program and handle errors
 */
const main = async () => {
  const exit = await Effect.runPromiseExit(program)
  if (Exit.isFailure(exit)) {
    console.error("Unexpected error:", exit.cause)
  }
}

main()
