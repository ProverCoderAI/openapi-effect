// CHANGE: Expose Effect-only public API
// WHY: Enforce Effect-first paradigm and remove Promise-based client surface
// SOURCE: n/a
// PURITY: SHELL (re-exports)
// COMPLEXITY: O(1)

export * as FetchHttpClient from "@effect/platform/FetchHttpClient"

export type * from "./core/api-client/index.js"
export { assertNever } from "./core/api-client/index.js"

export type {
  ClientOptions,
  DispatchersFor,
  StrictApiClient,
  StrictApiClientWithDispatchers
} from "./shell/api-client/create-client.js"

export type { Decoder, Dispatcher, RawResponse, StrictClient, StrictRequestInit } from "./shell/api-client/index.js"

export {
  createClient,
  createClientEffect,
  createDispatcher,
  createFinalURL,
  createPathBasedClient,
  createQuerySerializer,
  createStrictClient,
  createUniversalDispatcher,
  defaultBodySerializer,
  defaultPathSerializer,
  executeRequest,
  mergeHeaders,
  parseJSON,
  registerDefaultDispatchers,
  removeTrailingSlash,
  serializeArrayParam,
  serializeObjectParam,
  serializePrimitiveParam,
  unexpectedContentType,
  unexpectedStatus
} from "./shell/api-client/index.js"

export { createClient as default } from "./shell/api-client/index.js"

// Generated dispatchers (auto-generated from OpenAPI schema)
export * from "./generated/index.js"
