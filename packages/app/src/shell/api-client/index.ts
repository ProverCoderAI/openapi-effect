// CHANGE: Main entry point for api-client shell module
// WHY: Export public API with clear separation of concerns
// QUOTE(ТЗ): "Публичный API должен иметь вид: strictClient.GET(path, options): Effect<ApiSuccess<Op>, ApiFailure<Op>, never>"
// REF: issue-2, section 6
// SOURCE: n/a
// PURITY: SHELL (re-exports)
// COMPLEXITY: O(1)

// Shell types and functions (runtime)
export type {
  Decoder,
  Dispatcher,
  RawResponse,
  RequestOptions,
  StrictClient,
  StrictRequestInit
} from "./strict-client.js"

export {
  createDispatcher,
  createStrictClient,
  executeRequest,
  parseJSON,
  unexpectedContentType,
  unexpectedStatus
} from "./strict-client.js"
