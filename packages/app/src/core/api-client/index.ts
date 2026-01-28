// CHANGE: Main entry point for api-client core module with Effect-native error handling
// WHY: Export public API with proper separation: 2xx → success, non-2xx → error channel
// QUOTE(ТЗ): "Публичный API должен иметь вид: strictClient.GET(path, options): Effect<ApiSuccess<Op>, ApiFailure<Op>, R>"
// REF: issue-2, section 6, PR#3 comment about Effect representation
// SOURCE: n/a
// PURITY: CORE (re-exports)
// COMPLEXITY: O(1)

// Core types (compile-time)
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
} from "./strict-types.js"

export { assertNever } from "./strict-types.js"
