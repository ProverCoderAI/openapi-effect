// CHANGE: Make openapi-effect a drop-in replacement for openapi-fetch (Promise API), with an opt-in Effect API.
// WHY: Consumer projects must be able to swap openapi-fetch -> openapi-effect with near-zero code changes.
// QUOTE(ТЗ): "openapi-effect должен почти 1 в 1 заменяться с openapi-fetch" / "Просто добавлять effect поведение"
// SOURCE: n/a
// PURITY: SHELL (re-exports)
// COMPLEXITY: O(1)

// Promise-based client (openapi-fetch compatible)
export { default } from "./shell/api-client/promise-client/index.js"
export { createClient } from "./shell/api-client/promise-client/index.js"
export * from "./shell/api-client/promise-client/index.js"

// Effect-based client (opt-in)
export * as FetchHttpClient from "@effect/platform/FetchHttpClient"

// Strict Effect client (advanced)
export type * from "./core/api-client/index.js"
export { assertNever } from "./core/api-client/index.js"

export type {
  DispatchersFor,
  StrictApiClient,
  StrictApiClientWithDispatchers
} from "./shell/api-client/create-client.js"

export type { Decoder, Dispatcher, RawResponse, StrictClient, StrictRequestInit } from "./shell/api-client/index.js"

export {
  createClient as createClientStrict,
  createClientEffect,
  createDispatcher,
  createStrictClient,
  createUniversalDispatcher,
  executeRequest,
  parseJSON,
  registerDefaultDispatchers,
  unexpectedContentType,
  unexpectedStatus
} from "./shell/api-client/index.js"

// Generated dispatchers (auto-generated from OpenAPI schema)
export * from "./generated/index.js"
