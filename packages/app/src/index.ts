// CHANGE: Main entry point for openapi-effect package with Effect-native error handling
// WHY: Enable default import of createClient function with proper error channel design
// QUOTE(ТЗ): "import createClient from \"openapi-effect\""
// REF: PR#3 comment from skulidropek about Effect representation
// SOURCE: n/a
// PURITY: SHELL (re-exports)
// COMPLEXITY: O(1)

// High-level API (recommended for most users)
export { createClient as default } from "./shell/api-client/create-client.js"
export type { ClientOptions, StrictApiClient } from "./shell/api-client/create-client.js"

// Core types (for advanced type manipulation)
// Effect Channel Design:
// - ApiSuccess<Responses>: 2xx responses → success channel
// - ApiFailure<Responses>: HttpError (4xx, 5xx) + BoundaryError → error channel
export type {
  ApiFailure,
  ApiSuccess,
  BodyFor,
  BoundaryError,
  ContentTypesFor,
  DecodeError,
  HttpError,
  HttpErrorResponseVariant,
  HttpErrorVariants,
  OperationFor,
  ParseError,
  PathsForMethod,
  ResponsesFor,
  ResponseVariant,
  StatusCodes,
  SuccessVariants,
  TransportError,
  UnexpectedContentType,
  UnexpectedStatus
} from "./core/api-client/index.js"

// Shell utilities (for custom implementations)
export type { Decoder, Dispatcher, RawResponse, StrictClient, StrictRequestInit } from "./shell/api-client/index.js"

export {
  createDispatcher,
  createStrictClient,
  executeRequest,
  parseJSON,
  unexpectedContentType,
  unexpectedStatus
} from "./shell/api-client/index.js"

// Generated dispatchers (auto-generated from OpenAPI schema)
export * from "./generated/index.js"
