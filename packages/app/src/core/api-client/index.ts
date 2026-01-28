// CHANGE: Main entry point for api-client core module
// WHY: Export public API with clear separation of concerns
// QUOTE(ТЗ): "Публичный API должен иметь вид: strictClient.GET(path, options): Effect<ApiResponse<Op>, BoundaryError, never>"
// REF: issue-2, section 6
// SOURCE: n/a
// PURITY: CORE (re-exports)
// COMPLEXITY: O(1)

// Core types (compile-time)
export type {
  ApiResponse,
  ApiSuccess,
  BodyFor,
  BoundaryError,
  ContentTypesFor,
  DecodeError,
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
