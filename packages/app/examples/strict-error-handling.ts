// CHANGE: Strict example demonstrating forced E=never error handling
// WHY: Prove that after catchTags with Match.exhaustive, the error channel becomes never
// QUOTE(ТЗ): "Приёмка по смыслу: после catchTags(...) тип ошибки становится never"
// REF: PR#3 blocking review from skulidropek
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Effect<void, never, never> - all errors handled

import { Console, Effect, Match } from "effect"

import { type ClientOptions, createClientEffect } from "../src/index.js"
import type { Paths } from "../tests/fixtures/petstore.openapi.js"

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

const listPetsProgram = apiClient.GET("/pets", {
  params: { query: { limit: 10 } }
}).pipe(
  Effect.flatMap((success) =>
    Match.value(success).pipe(
      Match.when({ status: 200 }, ({ body }) => Console.log(`Got ${body.length} pets`)),
      Match.exhaustive
    )
  ),
  Effect.catchTags({
    HttpError: (error) =>
      Match.value(error.status).pipe(
        Match.when(500, () => Console.log(`Server error: ${error.body.message}`)),
        Match.exhaustive
      ),
    TransportError: ({ error }) => Console.log(`Transport error: ${error.message}`),
    UnexpectedStatus: ({ body, status }) => Console.log(`Unexpected status ${status}: ${body}`),
    UnexpectedContentType: ({ actual, expected }) =>
      Console.log(`Unexpected content type ${actual ?? "unknown"}; expected ${expected.join(", ")}`),
    ParseError: ({ error }) => Console.log(`Parse error: ${error.message}`),
    DecodeError: ({ error }) => Console.log(`Decode error: ${error.message}`)
  })
)

export const strictErrorHandlingProgram: Effect.Effect<void> = listPetsProgram
