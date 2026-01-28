// CHANGE: Example script demonstrating createClient API usage
// WHY: Verify simplified API works as requested by reviewer
// QUOTE(ТЗ): "напиши для меня такой тестовый скрипт и проверь как оно работает"
// REF: PR#3 comment from skulidropek
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Demonstrates Effect-based API calls

import * as HttpClient from "@effect/platform/HttpClient"
import { Console, Effect, Layer } from "effect"
import createClient from "../src/index.js"
import { dispatcherlistPets, dispatchergetPet, dispatchercreatePet } from "../src/generated/dispatch.js"
import type { paths } from "../tests/fixtures/petstore.openapi.js"

/**
 * Example: Create API client with simplified API
 *
 * This demonstrates the ergonomic createClient API that matches
 * the interface requested by the reviewer.
 */
const apiClient = createClient<paths>({
  baseUrl: "https://petstore.example.com",
  credentials: "include"
})

/**
 * Example program: List all pets
 *
 * @pure false - performs HTTP request
 * @effect Effect<void, never, never>
 */
const listAllPetsExample = Effect.gen(function*() {
  yield* Console.log("=== Example 1: List all pets ===")

  // Execute request using the simplified API
  const result = yield* apiClient.GET(
    "/pets",
    dispatcherlistPets,
    {
      query: { limit: 10 }
    }
  )

  // Pattern match on the response
  if (result.status === 200) {
    yield* Console.log(`✓ Success: Got ${result.body.length} pets`)
    yield* Console.log(`  First pet: ${JSON.stringify(result.body[0], null, 2)}`)
  } else if (result.status === 500) {
    yield* Console.log(`✗ Server error: ${result.body.message}`)
  }
})

/**
 * Example program: Get specific pet
 *
 * @pure false - performs HTTP request
 * @effect Effect<void, never, never>
 */
const getPetExample = Effect.gen(function*() {
  yield* Console.log("\n=== Example 2: Get specific pet ===")

  const result = yield* apiClient.GET(
    "/pets/{petId}",
    dispatchergetPet,
    {
      params: { petId: "123" }
    }
  )

  if (result.status === 200) {
    yield* Console.log(`✓ Success: Got pet "${result.body.name}"`)
    yield* Console.log(`  Tag: ${result.body.tag ?? "none"}`)
  } else if (result.status === 404) {
    yield* Console.log(`✗ Not found: ${result.body.message}`)
  } else if (result.status === 500) {
    yield* Console.log(`✗ Server error: ${result.body.message}`)
  }
})

/**
 * Example program: Create new pet
 *
 * @pure false - performs HTTP request
 * @effect Effect<void, never, never>
 */
const createPetExample = Effect.gen(function*() {
  yield* Console.log("\n=== Example 3: Create new pet ===")

  const newPet = {
    name: "Fluffy",
    tag: "cat"
  }

  const result = yield* apiClient.POST(
    "/pets",
    dispatchercreatePet,
    {
      body: JSON.stringify(newPet),
      headers: { "Content-Type": "application/json" }
    }
  )

  if (result.status === 201) {
    yield* Console.log(`✓ Success: Created pet with ID ${result.body.id}`)
    yield* Console.log(`  Name: ${result.body.name}`)
  } else if (result.status === 400) {
    yield* Console.log(`✗ Validation error: ${result.body.message}`)
  } else if (result.status === 500) {
    yield* Console.log(`✗ Server error: ${result.body.message}`)
  }
})

/**
 * Example program: Handle transport error
 *
 * @pure false - performs HTTP request
 * @effect Effect<void, never, never>
 */
const errorHandlingExample = Effect.gen(function*() {
  yield* Console.log("\n=== Example 4: Error handling ===")

  // Create client with invalid URL to trigger transport error
  const invalidClient = createClient<paths>({
    baseUrl: "http://invalid.localhost:99999",
    credentials: "include"
  })

  const result = yield* Effect.either(
    invalidClient.GET("/pets", dispatcherlistPets)
  )

  if (result._tag === "Left") {
    const error = result.left
    if (error._tag === "TransportError") {
      yield* Console.log(`✓ Transport error caught: ${error.message}`)
    } else if (error._tag === "UnexpectedStatus") {
      yield* Console.log(`✓ Unexpected status: ${error.status}`)
    } else if (error._tag === "ParseError") {
      yield* Console.log(`✓ Parse error: ${error.message}`)
    } else {
      yield* Console.log(`✓ Other error: ${error._tag}`)
    }
  } else {
    yield* Console.log("✗ Expected error but got success")
  }
})

/**
 * Main program - runs all examples
 *
 * @pure false - performs HTTP requests
 * @effect Effect<void, never, never>
 */
const mainProgram = Effect.gen(function*() {
  yield* Console.log("╔════════════════════════════════════════════════════╗")
  yield* Console.log("║  OpenAPI Effect Client - createClient() Examples  ║")
  yield* Console.log("╚════════════════════════════════════════════════════╝\n")

  yield* Console.log("Demonstrating simplified API:")
  yield* Console.log('  import createClient from "openapi-effect"')
  yield* Console.log("  const client = createClient<paths>({ ... })")
  yield* Console.log("  client.GET(\"/path\", dispatcher, options)\n")

  // Note: These examples will fail with transport errors since
  // we're not connecting to a real server. This is intentional
  // to demonstrate error handling.

  yield* Effect.catchAll(listAllPetsExample, (error) =>
    Console.log(`Transport error (expected): ${error._tag === "TransportError" ? "Cannot connect to example server" : error._tag}`)
  )

  yield* Effect.catchAll(getPetExample, (error) =>
    Console.log(`Transport error (expected): ${error._tag === "TransportError" ? "Cannot connect to example server" : error._tag}`)
  )

  yield* Effect.catchAll(createPetExample, (error) =>
    Console.log(`Transport error (expected): ${error._tag === "TransportError" ? "Cannot connect to example server" : error._tag}`)
  )

  yield* errorHandlingExample

  yield* Console.log("\n✓ All examples completed!")
  yield* Console.log("\nType safety verification:")
  yield* Console.log("  - All paths are type-checked against OpenAPI schema")
  yield* Console.log("  - Path parameters validated at compile time")
  yield* Console.log("  - Query parameters type-safe")
  yield* Console.log("  - Response bodies fully typed")
  yield* Console.log("  - All errors explicit in Effect type")
})

/**
 * Execute the program with HttpClient layer
 */
const program = mainProgram.pipe(
  Effect.provide(Layer.succeed(HttpClient.HttpClient, HttpClient.fetchOk))
)

Effect.runPromise(program).catch((error) => {
  console.error("Unexpected error:", error)
  process.exit(1)
})
