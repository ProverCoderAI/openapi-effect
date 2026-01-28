// CHANGE: Implement Effect-based HTTP client with Effect-native error handling
// WHY: Force explicit handling of HTTP errors (4xx, 5xx) via Effect error channel
// QUOTE(ТЗ): "каждый запрос возвращает Effect<Success, Failure, never>; Failure включает все инварианты протокола и схемы"
// REF: issue-2, section 2, 4, 5.1
// SOURCE: n/a
// FORMAT THEOREM: ∀ req ∈ Requests: execute(req) → Effect<ApiSuccess, ApiFailure, R>
// PURITY: SHELL
// EFFECT: Effect<ApiSuccess<Op>, ApiFailure<Op>, HttpClient.HttpClient>
// INVARIANT: 2xx → success channel, non-2xx → error channel (forced handling)
// COMPLEXITY: O(1) per request / O(n) for body size

import * as HttpBody from "@effect/platform/HttpBody"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Effect } from "effect"
import type { HttpMethod } from "openapi-typescript-helpers"

import type {
  ApiFailure,
  ApiSuccess,
  DecodeError,
  OperationFor,
  ParseError,
  ResponsesFor,
  TransportError,
  UnexpectedContentType,
  UnexpectedStatus
} from "../../core/api-client/strict-types.js"
import {
  asDispatcher,
  asJson,
  asRawResponse,
  asStrictRequestInit,
  type Dispatcher,
  type Json,
  type RawResponse
} from "../../core/axioms.js"

// Re-export Dispatcher type for consumers

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
) => Effect.Effect<T, DecodeError>

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
 * Execute HTTP request with Effect-native error handling
 *
 * @param config - Request configuration with dispatcher
 * @returns Effect with success (2xx) and failures (non-2xx + boundary errors)
 *
 * **Effect Channel Design:**
 * - Success channel: `ApiSuccess<Responses>` - 2xx responses only
 * - Error channel: `ApiFailure<Responses>` - HTTP errors (4xx, 5xx) + boundary errors
 *
 * This forces developers to explicitly handle HTTP errors using:
 * - `Effect.catchTag` for specific error types
 * - `Effect.match` for exhaustive handling
 * - `Effect.catchAll` for generic error handling
 *
 * @pure false - performs HTTP request
 * @effect Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient.HttpClient>
 * @invariant 2xx → success channel, non-2xx → error channel
 * @precondition config.dispatcher handles all schema statuses
 * @postcondition ∀ response: success(2xx) ∨ httpError(non-2xx) ∨ boundaryError
 * @complexity O(1) + O(|body|) for text extraction
 */
export const executeRequest = <Responses>(
  config: StrictRequestInit<Responses>
): Effect.Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient.HttpClient> =>
  Effect.gen(function*() {
    // STEP 1: Get HTTP client from context
    const client = yield* HttpClient.HttpClient

    // STEP 2: Build request based on method
    const request = buildRequest(config)

    // STEP 3: Execute request with error mapping
    const rawResponse = yield* Effect.mapError(
      Effect.gen(function*() {
        const response = yield* client.execute(request)
        const text = yield* response.text
        return asRawResponse({
          status: response.status,
          headers: toNativeHeaders(response.headers),
          text
        })
      }),
      (error): TransportError => ({
        _tag: "TransportError",
        error: error instanceof Error ? error : new Error(String(error))
      })
    )

    // STEP 4: Delegate classification to dispatcher (handles status/content-type/decode)
    return yield* config.dispatcher(rawResponse)
  })

/**
 * Build HTTP request from config
 *
 * @pure true
 */
const buildRequest = <Responses>(config: StrictRequestInit<Responses>): HttpClientRequest.HttpClientRequest => {
  const methodMap: Record<string, (url: string) => HttpClientRequest.HttpClientRequest> = {
    get: HttpClientRequest.get,
    post: HttpClientRequest.post,
    put: HttpClientRequest.put,
    patch: HttpClientRequest.patch,
    delete: HttpClientRequest.del,
    head: HttpClientRequest.head,
    options: HttpClientRequest.options
  }

  const createRequest = methodMap[config.method] ?? HttpClientRequest.get
  let request = createRequest(config.url)

  // Add headers if provided
  if (config.headers !== undefined) {
    const headers = toRecordHeaders(config.headers)
    request = HttpClientRequest.setHeaders(request, headers)
  }

  // Add body if provided
  if (config.body !== undefined) {
    const bodyText = typeof config.body === "string" ? config.body : JSON.stringify(config.body)
    request = HttpClientRequest.setBody(request, HttpBody.text(bodyText))
  }

  return request
}

/**
 * Convert Headers to Record<string, string>
 *
 * @pure true
 */
const toRecordHeaders = (headers: HeadersInit): Record<string, string> => {
  if (headers instanceof Headers) {
    const result: Record<string, string> = {}
    for (const [key, value] of headers.entries()) {
      result[key] = value
    }
    return result
  }
  if (Array.isArray(headers)) {
    const result: Record<string, string> = {}
    for (const headerPair of headers) {
      const [headerKey, headerValue] = headerPair
      result[headerKey] = headerValue
    }
    return result
  }
  return headers
}

/**
 * Convert @effect/platform Headers to native Headers
 *
 * @pure true
 */
const toNativeHeaders = (platformHeaders: { readonly [key: string]: string }): Headers => {
  const headers = new Headers()
  for (const [key, value] of Object.entries(platformHeaders)) {
    headers.set(key, value)
  }
  return headers
}

/**
 * Helper to create dispatcher from switch-based classifier
 *
 * This function uses a permissive type signature to allow generated code
 * to work with any response variant without requiring exact type matching.
 * The classify function can return any Effect with union types for success/error.
 *
 * NOTE: Uses axioms module for type casts to allow heterogeneous Effect
 * unions from switch statements. The returned Dispatcher is properly typed.
 *
 * @pure true - returns pure function
 * @complexity O(1)
 */

export const createDispatcher = <Responses>(
  classify: (
    status: number,
    contentType: string | undefined,
    text: string
  ) => Effect.Effect<unknown, unknown>
): Dispatcher<Responses> => {
  return asDispatcher<Responses>((response: RawResponse) => {
    const contentType = response.headers.get("content-type") ?? undefined
    return classify(response.status, contentType, response.text)
  })
}

/**
 * Helper to parse JSON with error handling
 *
 * @pure false - performs parsing
 * @effect Effect<Json, ParseError, never>
 */
export const parseJSON = (
  status: number,
  contentType: string,
  text: string
): Effect.Effect<Json, ParseError> =>
  Effect.try({
    try: () => asJson(JSON.parse(text)),
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
 * Generic client interface for any OpenAPI schema with Effect-native error handling
 *
 * **Effect Channel Design:**
 * - Success channel: `ApiSuccess<Op>` - 2xx responses
 * - Error channel: `ApiFailure<Op>` - HTTP errors (4xx, 5xx) + boundary errors
 *
 * @pure false - performs HTTP requests
 * @effect Effect<ApiSuccess<Op>, ApiFailure<Op>, HttpClient.HttpClient>
 */
export type StrictClient<Paths extends object> = {
  readonly GET: <Path extends keyof Paths>(
    path: Path,
    options: RequestOptions<Paths, Path, "get">
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "get">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "get">>>,
    HttpClient.HttpClient
  >

  readonly POST: <Path extends keyof Paths>(
    path: Path,
    options: RequestOptions<Paths, Path, "post">
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "post">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "post">>>,
    HttpClient.HttpClient
  >

  readonly PUT: <Path extends keyof Paths>(
    path: Path,
    options: RequestOptions<Paths, Path, "put">
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "put">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "put">>>,
    HttpClient.HttpClient
  >

  readonly PATCH: <Path extends keyof Paths>(
    path: Path,
    options: RequestOptions<Paths, Path, "patch">
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "patch">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "patch">>>,
    HttpClient.HttpClient
  >

  readonly DELETE: <Path extends keyof Paths>(
    path: Path,
    options: RequestOptions<Paths, Path, "delete">
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "delete">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "delete">>>,
    HttpClient.HttpClient
  >
}

/**
 * Request options for a specific operation
 */
export type RequestOptions<
  Paths extends object,
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
export const createStrictClient = <Paths extends object>(): StrictClient<
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
    const config = asStrictRequestInit<StrictRequestInit<ResponsesFor<OperationFor<Paths, Path, Method>>>>({
      method,
      url,
      dispatcher: options.dispatcher,
      ...(options.headers !== undefined && { headers: options.headers }),
      ...(options.body !== undefined && { body: options.body }),
      ...(options.signal !== undefined && { signal: options.signal })
    })

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

export { type Dispatcher, type RawResponse } from "../../core/axioms.js"
