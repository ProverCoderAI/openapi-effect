// CHANGE: Strict example demonstrating forced E=never error handling
// WHY: Prove that after catchTags with Match.exhaustive, the error channel becomes never
// QUOTE(ТЗ): "Приёмка по смыслу: после catchTags(...) тип ошибки становится never"
// REF: PR#3 blocking review from skulidropek
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Effect<ReadonlyArray<Pet>, never, never> - all errors handled with an empty-list fallback

import { Console, Effect, Match } from "effect"

import type { Components, Paths } from "../../tests/fixtures/petstore.openapi.js"
import { type ClientOptions, createClientEffect } from "../index.js"

type Pet = Components["schemas"]["Pet"]
type Pets = ReadonlyArray<Pet>

const clientOptions: ClientOptions = {
  baseUrl: "https://petstore.example.com",
  credentials: "include"
}

// CHANGE: Use createClientEffect with openapi-fetch-compatible inputs
// WHY: Output channels are inferred from createClientEffect<Paths>() without per-call schema
// QUOTE(ТЗ): "input должен быть 1 в 1"
// REF: user-msg-openapi-effect-input-compat
// SOURCE: n/a
// FORMAT THEOREM: ∀ path, method: responses(Paths[path][method]) -> Effect<S, E, never>
// PURITY: SHELL
// EFFECT: none
// INVARIANT: Path and method select the OpenAPI operation that determines success and failure channels
// COMPLEXITY: O(1)
const apiClient = createClientEffect<Paths>(clientOptions)

const emptyPets: Pets = []

/**
 * Converts a handled listPets failure into the list monoid identity.
 *
 * @param logEffect - Diagnostic shell effect that records the handled failure
 * @returns Effect with an empty pets list and no error channel
 *
 * @pure false - preserves Console logging effect
 * @effect never
 * @invariant forall handledFailure: recoverWithEmptyPets(handledFailure) = []
 * @complexity O(1)
 * @throws Never - all failures are represented in the Effect error channel
 */
const recoverWithEmptyPets = (logEffect: Effect.Effect<void>): Effect.Effect<Pets> =>
  logEffect.pipe(Effect.as(emptyPets))

const listPetsProgram: Effect.Effect<Pets> = apiClient.GET("/pets", {
  params: { query: { limit: 10 } }
}).pipe(
  Effect.flatMap((success) =>
    Match.value(success).pipe(
      Match.when({ status: 200 }, ({ body }) => Console.log(`Got ${body.length} pets`).pipe(Effect.as(body))),
      Match.exhaustive
    )
  ),
  Effect.catchTags({
    HttpError: (error) =>
      Match.value(error.status).pipe(
        Match.when(500, () => recoverWithEmptyPets(Console.log(`Server error: ${error.body.message}`))),
        Match.exhaustive
      ),
    TransportError: ({ error }) => recoverWithEmptyPets(Console.log(`Transport error: ${error.message}`)),
    UnexpectedStatus: ({ body, status }) => recoverWithEmptyPets(Console.log(`Unexpected status ${status}: ${body}`)),
    UnexpectedContentType: ({ actual, expected }) =>
      recoverWithEmptyPets(
        Console.log(`Unexpected content type ${actual ?? "unknown"}; expected ${expected.join(", ")}`)
      ),
    ParseError: ({ error }) => recoverWithEmptyPets(Console.log(`Parse error: ${error.message}`)),
    DecodeError: ({ error }) => recoverWithEmptyPets(Console.log(`Decode error: ${error.message}`))
  })
)

export const strictErrorHandlingProgram: Effect.Effect<Pets> = listPetsProgram
