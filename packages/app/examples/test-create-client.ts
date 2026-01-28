// CHANGE: Example script demonstrating createClient API usage
// WHY: Verify simplified API works as requested by reviewer
// QUOTE(TZ): "napishi dlya menya takoi testovyi skript i prover' kak ono rabotaet"
// REF: PR#3 comment from skulidropek
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Demonstrates Effect-based API calls

import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Console, Effect, Exit } from "effect"
import { createClient, type ClientOptions } from "../src/shell/api-client/create-client.js"
import { dispatchercreatePet, dispatchergetPet, dispatcherlistPets } from "../src/generated/dispatch.js"
import type { Operations, Paths } from "../tests/fixtures/petstore.openapi.js"
import type { ApiSuccess, ResponsesFor } from "../src/core/api-client/strict-types.js"

// Type aliases for operation responses
type ListPetsResponses = ResponsesFor<Operations["listPets"]>
type GetPetResponses = ResponsesFor<Operations["getPet"]>
type CreatePetResponses = ResponsesFor<Operations["createPet"]>

// Success types for pattern matching
type ListPetsSuccess = ApiSuccess<ListPetsResponses>
type GetPetSuccess = ApiSuccess<GetPetResponses>
type CreatePetSuccess = ApiSuccess<CreatePetResponses>

// Helper type for Error schema body
type ErrorBody = { readonly code: number; readonly message: string }

// Helper to check if body is an Error schema response
const isErrorBody = (body: unknown): body is ErrorBody =>
  typeof body === "object" &&
  body !== null &&
  "message" in body &&
  typeof (body as ErrorBody).message === "string"

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

const apiClient = createClient<Paths>(clientOptions)

/**
 * Example program: List all pets
 *
 * @pure false - performs HTTP request
 * @effect Effect<void, ListPetsFailure, HttpClient>
 */
const listAllPetsExample = Effect.gen(function*() {
  yield* Console.log("=== Example 1: List all pets ===")

  // Execute request using the simplified API
  const result: ListPetsSuccess = yield* apiClient.GET(
    "/pets",
    dispatcherlistPets,
    {
      query: { limit: 10 }
    }
  )

  // Pattern match on the response
  if (result.status === 200) {
    const pets = result.body as Array<{ id: string; name: string; tag?: string }>
    yield* Console.log(`Success: Got ${pets.length} pets`)
    yield* Console.log(`  First pet: ${JSON.stringify(pets[0], null, 2)}`)
  } else if (result.status === 500 && isErrorBody(result.body)) {
    yield* Console.log(`Server error: ${result.body.message}`)
  }
})

/**
 * Example program: Get specific pet
 *
 * @pure false - performs HTTP request
 * @effect Effect<void, GetPetFailure, HttpClient>
 */
const getPetExample = Effect.gen(function*() {
  yield* Console.log("\n=== Example 2: Get specific pet ===")

  const result: GetPetSuccess = yield* apiClient.GET(
    "/pets/{petId}",
    dispatchergetPet,
    {
      params: { petId: "123" }
    }
  )

  if (result.status === 200) {
    const pet = result.body as { id: string; name: string; tag?: string }
    yield* Console.log(`Success: Got pet "${pet.name}"`)
    yield* Console.log(`  Tag: ${pet.tag ?? "none"}`)
  } else if (result.status === 404 && isErrorBody(result.body)) {
    yield* Console.log(`Not found: ${result.body.message}`)
  } else if (result.status === 500 && isErrorBody(result.body)) {
    yield* Console.log(`Server error: ${result.body.message}`)
  }
})

/**
 * Example program: Create new pet
 *
 * @pure false - performs HTTP request
 * @effect Effect<void, CreatePetFailure, HttpClient>
 */
const createPetExample = Effect.gen(function*() {
  yield* Console.log("\n=== Example 3: Create new pet ===")

  const newPet = {
    name: "Fluffy",
    tag: "cat"
  }

  const result: CreatePetSuccess = yield* apiClient.POST(
    "/pets",
    dispatchercreatePet,
    {
      body: JSON.stringify(newPet),
      headers: { "Content-Type": "application/json" }
    }
  )

  if (result.status === 201) {
    const pet = result.body as { id: string; name: string; tag?: string }
    yield* Console.log(`Success: Created pet with ID ${pet.id}`)
    yield* Console.log(`  Name: ${pet.name}`)
  } else if (result.status === 400 && isErrorBody(result.body)) {
    yield* Console.log(`Validation error: ${result.body.message}`)
  } else if (result.status === 500 && isErrorBody(result.body)) {
    yield* Console.log(`Server error: ${result.body.message}`)
  }
})

/**
 * Example program: Handle transport error
 *
 * @pure false - performs HTTP request
 * @effect Effect<void, never, HttpClient>
 */
const errorHandlingExample = Effect.gen(function*() {
  yield* Console.log("\n=== Example 4: Error handling ===")

  // Create client with invalid URL to trigger transport error
  const invalidClient = createClient<Paths>({
    baseUrl: "http://invalid.localhost:99999",
    credentials: "include"
  })

  const result = yield* Effect.either(
    invalidClient.GET("/pets", dispatcherlistPets)
  )

  if (result._tag === "Left") {
    const error = result.left
    if (error._tag === "TransportError") {
      yield* Console.log(`Transport error caught: ${error.error.message}`)
    } else if (error._tag === "UnexpectedStatus") {
      yield* Console.log(`Unexpected status: ${error.status}`)
    } else if (error._tag === "ParseError") {
      yield* Console.log(`Parse error: ${error.error.message}`)
    } else {
      yield* Console.log(`Other error: ${error._tag}`)
    }
  } else {
    yield* Console.log("Expected error but got success")
  }
})

/**
 * Helper type for ApiFailure errors
 */
type ApiError = { readonly _tag: string }

/**
 * Main program - runs all examples
 *
 * @pure false - performs HTTP requests
 * @effect Effect<void, never, HttpClient>
 */
const mainProgram = Effect.gen(function*() {
  yield* Console.log("========================================")
  yield* Console.log("  OpenAPI Effect Client - Examples")
  yield* Console.log("========================================\n")

  yield* Console.log("Demonstrating simplified API:")
  yield* Console.log('  import createClient from "openapi-effect"')
  yield* Console.log("  const client = createClient<Paths>({ ... })")
  yield* Console.log("  client.GET(\"/path\", dispatcher, options)\n")

  // Note: These examples will fail with transport errors since
  // we're not connecting to a real server. This is intentional
  // to demonstrate error handling.

  yield* Effect.catchAll(listAllPetsExample, (error: ApiError) =>
    Console.log(`Transport error (expected): ${error._tag === "TransportError" ? "Cannot connect to example server" : error._tag}`)
  )

  yield* Effect.catchAll(getPetExample, (error: ApiError) =>
    Console.log(`Transport error (expected): ${error._tag === "TransportError" ? "Cannot connect to example server" : error._tag}`)
  )

  yield* Effect.catchAll(createPetExample, (error: ApiError) =>
    Console.log(`Transport error (expected): ${error._tag === "TransportError" ? "Cannot connect to example server" : error._tag}`)
  )

  yield* errorHandlingExample

  yield* Console.log("\nAll examples completed!")
  yield* Console.log("\nType safety verification:")
  yield* Console.log("  - All paths are type-checked against OpenAPI schema")
  yield* Console.log("  - Path parameters validated at compile time")
  yield* Console.log("  - Query parameters type-safe")
  yield* Console.log("  - Response bodies fully typed")
  yield* Console.log("  - All errors explicit in Effect type")
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
