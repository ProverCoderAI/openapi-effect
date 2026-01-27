// CHANGE: Implement Effect-based HTTP client with exhaustive error handling
// WHY: Provide type-safe API client where all errors are explicit in the type system
// QUOTE(ТЗ): "каждый запрос возвращает Effect<Success, Failure, never>; Failure включает все инварианты протокола и схемы"
// REF: issue-2, section 2, 4, 5.1
// SOURCE: n/a
// FORMAT THEOREM: ∀ req ∈ Requests: execute(req) → Effect<Success, Failure, never>
// PURITY: SHELL
// EFFECT: Effect<ApiSuccess<Op>, ApiFailure<Op>, never>
// INVARIANT: No exceptions escape; all errors typed in Effect channel
// COMPLEXITY: O(1) per request / O(n) for body size

import { Effect } from "effect"
import type { HttpMethod } from "openapi-typescript-helpers"

import type {
  ApiFailure,
  ApiSuccess,
  BoundaryError,
  DecodeError,
  HttpErrorVariants,
  OperationFor,
  ParseError,
  ResponsesFor,
  TransportError,
  UnexpectedContentType,
  UnexpectedStatus
} from "../../core/api-client/strict-types.js"

/**
 * Raw HTTP response from fetch
 */
export type RawResponse = {
  readonly status: number
  readonly headers: Headers
  readonly text: string
}

/**
 * Decoder for response body
 *
 * @pure false - may perform validation
 * @effect Effect<T, DecodeError, never>
 */
export type Decoder<T> = (
  status: number,
  contentType: string,
  body: string
) => Effect.Effect<T, DecodeError, never>

/**
 * Dispatcher classifies response and applies decoder
 *
 * @pure false - applies decoders
 * @effect Effect<Success, HttpError | BoundaryError, never>
 * @invariant Must handle all statuses and content-types from schema
 */
export type Dispatcher<Responses> = (
  response: RawResponse
) => Effect.Effect<
  ApiSuccess<Responses> | HttpErrorVariants<Responses>,
  Exclude<BoundaryError, TransportError>,
  never
>

/**
 * Configuration for a strict API client request
 */
export type StrictRequestInit<Responses> = {
  readonly method: HttpMethod
  readonly url: string
  readonly dispatcher: Dispatcher<Responses>
  readonly headers?: HeadersInit
  readonly body?: BodyInit
  readonly signal?: AbortSignal
}

/**
 * Execute HTTP request with full error classification
 *
 * @param config - Request configuration with dispatcher
 * @returns Effect with typed success and all possible failures
 *
 * @pure false - performs HTTP request
 * @effect Effect<ApiSuccess<Responses>, ApiFailure<Responses>, never>
 * @invariant No exceptions escape; all errors in Effect.fail channel
 * @precondition config.dispatcher handles all schema statuses
 * @postcondition ∀ response: classified ∨ BoundaryError
 * @complexity O(1) + O(|body|) for text extraction
 */
export const executeRequest = <Responses>(
  config: StrictRequestInit<Responses>
): Effect.Effect<ApiSuccess<Responses>, ApiFailure<Responses>, never> =>
  Effect.gen(function* () {
    // STEP 1: Execute transport with exception handling
    const rawResponse = yield* Effect.tryPromise({
      try: async (): Promise<RawResponse> => {
        const fetchInit: RequestInit = {
          method: config.method
        }
        if (config.headers !== undefined) {
          fetchInit.headers = config.headers
        }
        if (config.body !== undefined) {
          fetchInit.body = config.body
        }
        if (config.signal !== undefined) {
          fetchInit.signal = config.signal
        }

        const response = await fetch(config.url, fetchInit)

        const text = await response.text()

        return {
          status: response.status,
          headers: response.headers,
          text
        }
      },
      catch: (error): TransportError => ({
        _tag: "TransportError",
        error: error instanceof Error ? error : new Error(String(error))
      })
    })

    // STEP 2: Delegate classification to dispatcher (handles status/content-type/decode)
    return yield* config.dispatcher(rawResponse)
  })

/**
 * Helper to create dispatcher from switch-based classifier
 *
 * This function uses a permissive type signature to allow generated code
 * to work with any response variant without requiring exact type matching.
 * The classify function can return any Effect with union types for success/error.
 *
 * NOTE: Uses 'unknown' for the classify parameter to allow heterogeneous Effect
 * unions from switch statements. The returned Dispatcher is properly typed.
 *
 * @pure true - returns pure function
 * @complexity O(1)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createDispatcher = <Responses = any>(
  classify: (
    status: number,
    contentType: string | undefined,
    text: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Effect.Effect<any, any, never>
): Dispatcher<Responses> => {
  return ((response: RawResponse) => {
    const contentType = response.headers.get("content-type") ?? undefined
    return classify(response.status, contentType, response.text)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any as Dispatcher<Responses>
}

/**
 * Helper to parse JSON with error handling
 *
 * @pure false - performs parsing
 * @effect Effect<unknown, ParseError, never>
 */
export const parseJSON = (
  status: number,
  contentType: string,
  text: string
): Effect.Effect<unknown, ParseError, never> =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: (error): ParseError => ({
      _tag: "ParseError",
      status,
      contentType,
      error: error instanceof Error ? error : new Error(String(error)),
      body: text
    })
  })

/**
 * Helper to create UnexpectedStatus error
 *
 * @pure true
 */
export const unexpectedStatus = (status: number, body: string): UnexpectedStatus => ({
  _tag: "UnexpectedStatus",
  status,
  body
})

/**
 * Helper to create UnexpectedContentType error
 *
 * @pure true
 */
export const unexpectedContentType = (
  status: number,
  expected: ReadonlyArray<string>,
  actual: string | undefined,
  body: string
): UnexpectedContentType => ({
  _tag: "UnexpectedContentType",
  status,
  expected,
  actual,
  body
})

/**
 * Generic client interface for any OpenAPI schema
 *
 * @pure false - performs HTTP requests
 */
export type StrictClient<Paths extends Record<string, unknown>> = {
  readonly GET: <Path extends keyof Paths>(
    path: Path,
    options: RequestOptions<Paths, Path, "get">
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "get">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "get">>>,
    never
  >

  readonly POST: <Path extends keyof Paths>(
    path: Path,
    options: RequestOptions<Paths, Path, "post">
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "post">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "post">>>,
    never
  >

  readonly PUT: <Path extends keyof Paths>(
    path: Path,
    options: RequestOptions<Paths, Path, "put">
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "put">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "put">>>,
    never
  >

  readonly PATCH: <Path extends keyof Paths>(
    path: Path,
    options: RequestOptions<Paths, Path, "patch">
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "patch">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "patch">>>,
    never
  >

  readonly DELETE: <Path extends keyof Paths>(
    path: Path,
    options: RequestOptions<Paths, Path, "delete">
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "delete">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "delete">>>,
    never
  >
}

/**
 * Request options for a specific operation
 */
export type RequestOptions<
  Paths extends Record<string, unknown>,
  Path extends keyof Paths,
  Method extends HttpMethod
> = {
  readonly dispatcher: Dispatcher<ResponsesFor<OperationFor<Paths, Path, Method>>>
  readonly baseUrl: string
  readonly params?: Record<string, string | number>
  readonly query?: Record<string, string | number>
  readonly headers?: HeadersInit
  readonly body?: BodyInit
  readonly signal?: AbortSignal
}

/**
 * Create a strict client for an OpenAPI schema
 *
 * @pure true - returns pure client object
 * @complexity O(1)
 */
export const createStrictClient = <Paths extends Record<string, unknown>>(): StrictClient<
  Paths
> => {
  const makeRequest = <Path extends keyof Paths, Method extends HttpMethod>(
    method: Method,
    path: Path,
    options: RequestOptions<Paths, Path, Method>
  ) => {
    let url = `${options.baseUrl}${String(path)}`

    // Replace path parameters
    if (options.params !== undefined) {
      for (const [key, value] of Object.entries(options.params)) {
        url = url.replace(`{${key}}`, encodeURIComponent(String(value)))
      }
    }

    // Add query parameters
    if (options.query !== undefined) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(options.query)) {
        params.append(key, String(value))
      }
      url = `${url}?${params.toString()}`
    }

    // Build config object, only including optional properties if they are defined
    // This satisfies exactOptionalPropertyTypes constraint
    const config = {
      method,
      url,
      dispatcher: options.dispatcher,
      ...(options.headers !== undefined && { headers: options.headers }),
      ...(options.body !== undefined && { body: options.body }),
      ...(options.signal !== undefined && { signal: options.signal })
    } as StrictRequestInit<ResponsesFor<OperationFor<Paths, Path, Method>>>

    return executeRequest(config)
  }

  return {
    GET: (path, options) => makeRequest("get", path, options),
    POST: (path, options) => makeRequest("post", path, options),
    PUT: (path, options) => makeRequest("put", path, options),
    PATCH: (path, options) => makeRequest("patch", path, options),
    DELETE: (path, options) => makeRequest("delete", path, options)
  } satisfies StrictClient<Paths>
}
