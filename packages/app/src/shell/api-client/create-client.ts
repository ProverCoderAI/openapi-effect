// CHANGE: Type-safe createClient API with full request-side enforcement
// WHY: Ensure path/method → operation → request types are all linked
// QUOTE(ТЗ): "path + method определяют operation, и из неё выводятся request/response types"
// REF: PR#3 blocking review sections 3.2, 3.3
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Creates Effect-based API client
// INVARIANT: All operations are type-safe from path → operation → request → response
// COMPLEXITY: O(1) client creation

import type * as HttpClient from "@effect/platform/HttpClient"
import type { Effect } from "effect"
import type { HttpMethod } from "openapi-typescript-helpers"

import type {
  ApiFailure,
  ApiSuccess,
  OperationFor,
  PathsForMethod,
  RequestOptionsFor,
  ResponsesFor
} from "../../core/api-client/strict-types.js"
import { asStrictApiClient, asStrictRequestInit, type Dispatcher } from "../../core/axioms.js"
import type { StrictRequestInit } from "./strict-client.js"
import { executeRequest } from "./strict-client.js"

/**
 * Client configuration options
 *
 * @pure - immutable configuration
 */
export type ClientOptions = {
  readonly baseUrl: string
  readonly credentials?: RequestCredentials
  readonly headers?: HeadersInit
  readonly fetch?: typeof globalThis.fetch
}

/**
 * Primitive value type for path/query parameters
 *
 * @pure true - type alias only
 */
type ParamValue = string | number | boolean

/**
 * Query parameter value - can be primitive or array of primitives
 *
 * @pure true - type alias only
 */
type QueryValue = ParamValue | ReadonlyArray<ParamValue>

/**
 * Type-safe API client with full request-side type enforcement
 *
 * **Key guarantees:**
 * 1. GET only works on paths that have `get` method in schema
 * 2. POST only works on paths that have `post` method in schema
 * 3. Dispatcher type is derived from operation's responses
 * 4. Request options (params/query/body) are derived from operation
 *
 * **Effect Channel Design:**
 * - Success channel: `ApiSuccess<Responses>` - 2xx responses only
 * - Error channel: `ApiFailure<Responses>` - HTTP errors (4xx, 5xx) + boundary errors
 *
 * @typeParam Paths - OpenAPI paths type from openapi-typescript
 *
 * @pure false - operations perform HTTP requests
 * @invariant ∀ call: path ∈ PathsForMethod<Paths, method> ∧ options derived from operation
 */
export type StrictApiClient<Paths extends object> = {
  /**
   * Execute GET request
   *
   * @typeParam Path - Path that supports GET method (enforced at type level)
   * @param path - API path with GET method
   * @param dispatcher - Response dispatcher (must match operation responses)
   * @param options - Request options (typed from operation)
   * @returns Effect with 2xx in success channel, errors in error channel
   */
  readonly GET: <Path extends PathsForMethod<Paths, "get">>(
    path: Path,
    dispatcher: Dispatcher<ResponsesFor<OperationFor<Paths, Path, "get">>>,
    options?: RequestOptionsFor<OperationFor<Paths, Path, "get">>
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "get">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "get">>>,
    HttpClient.HttpClient
  >

  /**
   * Execute POST request
   */
  readonly POST: <Path extends PathsForMethod<Paths, "post">>(
    path: Path,
    dispatcher: Dispatcher<ResponsesFor<OperationFor<Paths, Path, "post">>>,
    options?: RequestOptionsFor<OperationFor<Paths, Path, "post">>
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "post">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "post">>>,
    HttpClient.HttpClient
  >

  /**
   * Execute PUT request
   */
  readonly PUT: <Path extends PathsForMethod<Paths, "put">>(
    path: Path,
    dispatcher: Dispatcher<ResponsesFor<OperationFor<Paths, Path, "put">>>,
    options?: RequestOptionsFor<OperationFor<Paths, Path, "put">>
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "put">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "put">>>,
    HttpClient.HttpClient
  >

  /**
   * Execute DELETE request
   */
  readonly DELETE: <Path extends PathsForMethod<Paths, "delete">>(
    path: Path,
    dispatcher: Dispatcher<ResponsesFor<OperationFor<Paths, Path, "delete">>>,
    options?: RequestOptionsFor<OperationFor<Paths, Path, "delete">>
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "delete">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "delete">>>,
    HttpClient.HttpClient
  >

  /**
   * Execute PATCH request
   */
  readonly PATCH: <Path extends PathsForMethod<Paths, "patch">>(
    path: Path,
    dispatcher: Dispatcher<ResponsesFor<OperationFor<Paths, Path, "patch">>>,
    options?: RequestOptionsFor<OperationFor<Paths, Path, "patch">>
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "patch">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "patch">>>,
    HttpClient.HttpClient
  >

  /**
   * Execute HEAD request
   */
  readonly HEAD: <Path extends PathsForMethod<Paths, "head">>(
    path: Path,
    dispatcher: Dispatcher<ResponsesFor<OperationFor<Paths, Path, "head">>>,
    options?: RequestOptionsFor<OperationFor<Paths, Path, "head">>
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "head">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "head">>>,
    HttpClient.HttpClient
  >

  /**
   * Execute OPTIONS request
   */
  readonly OPTIONS: <Path extends PathsForMethod<Paths, "options">>(
    path: Path,
    dispatcher: Dispatcher<ResponsesFor<OperationFor<Paths, Path, "options">>>,
    options?: RequestOptionsFor<OperationFor<Paths, Path, "options">>
  ) => Effect.Effect<
    ApiSuccess<ResponsesFor<OperationFor<Paths, Path, "options">>>,
    ApiFailure<ResponsesFor<OperationFor<Paths, Path, "options">>>,
    HttpClient.HttpClient
  >
}

/**
 * Build URL with path parameters and query string
 *
 * @param baseUrl - Base URL for the API
 * @param path - Path template with placeholders
 * @param params - Path parameters to substitute
 * @param query - Query parameters to append
 * @returns Fully constructed URL
 *
 * @pure true
 * @complexity O(n + m) where n = |params|, m = |query|
 */
const buildUrl = (
  baseUrl: string,
  path: string,
  params?: Record<string, ParamValue>,
  query?: Record<string, QueryValue>
): string => {
  // Replace path parameters
  let url = path
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`{${key}}`, encodeURIComponent(String(value)))
    }
  }

  // Construct full URL
  const fullUrl = new URL(url, baseUrl)

  // Add query parameters
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          fullUrl.searchParams.append(key, String(item))
        }
      } else {
        fullUrl.searchParams.set(key, String(value))
      }
    }
  }

  return fullUrl.toString()
}

/**
 * Check if body is already a BodyInit type (not a plain object needing serialization)
 *
 * @pure true
 */
const isBodyInit = (body: BodyInit | object): body is BodyInit =>
  typeof body === "string"
  || body instanceof Blob
  || body instanceof ArrayBuffer
  || body instanceof ReadableStream
  || body instanceof FormData
  || body instanceof URLSearchParams

/**
 * Serialize body to BodyInit - passes through BodyInit types, JSON-stringifies objects
 *
 * @pure true
 * @returns BodyInit or undefined, with consistent return path
 */
const serializeBody = (body: BodyInit | object | undefined): BodyInit | undefined => {
  // Early return for undefined
  if (body === undefined) {
    return body
  }
  // Pass through existing BodyInit types
  if (isBodyInit(body)) {
    return body
  }
  // Plain object - serialize to JSON string (which is a valid BodyInit)
  const serialized: BodyInit = JSON.stringify(body)
  return serialized
}

/**
 * Check if body requires JSON Content-Type header
 *
 * @pure true
 */
const needsJsonContentType = (body: BodyInit | object | undefined): boolean =>
  body !== undefined
  && typeof body !== "string"
  && !(body instanceof Blob)
  && !(body instanceof FormData)

/**
 * Merge headers from client options and request options
 *
 * @pure true
 * @complexity O(n) where n = number of headers
 */
const mergeHeaders = (
  clientHeaders: HeadersInit | undefined,
  requestHeaders: HeadersInit | undefined
): Headers => {
  const headers = new Headers(clientHeaders)
  if (requestHeaders) {
    const optHeaders = new Headers(requestHeaders)
    for (const [key, value] of optHeaders.entries()) {
      headers.set(key, value)
    }
  }
  return headers
}

/**
 * Request options type for method handlers
 *
 * @pure true - type alias only
 */
type MethodHandlerOptions = {
  params?: Record<string, ParamValue>
  query?: Record<string, QueryValue>
  body?: BodyInit | object
  headers?: HeadersInit
  signal?: AbortSignal
}

/**
 * Create HTTP method handler with full type constraints
 *
 * @param method - HTTP method
 * @param clientOptions - Client configuration
 * @returns Method handler function
 *
 * @pure false - creates function that performs HTTP requests
 * @complexity O(1) handler creation
 */
const createMethodHandler = (
  method: HttpMethod,
  clientOptions: ClientOptions
) =>
<Responses>(
  path: string,
  dispatcher: Dispatcher<Responses>,
  options?: MethodHandlerOptions
) => {
  const url = buildUrl(clientOptions.baseUrl, path, options?.params, options?.query)
  const headers = mergeHeaders(clientOptions.headers, options?.headers)
  const body = serializeBody(options?.body)

  if (needsJsonContentType(options?.body)) {
    headers.set("Content-Type", "application/json")
  }

  const config: StrictRequestInit<Responses> = asStrictRequestInit({
    method,
    url,
    dispatcher,
    headers,
    body,
    signal: options?.signal
  })

  return executeRequest(config)
}

/**
 * Create type-safe Effect-based API client
 *
 * The client enforces:
 * 1. Method availability: GET only on paths with `get`, POST only on paths with `post`
 * 2. Dispatcher correlation: must match operation's responses
 * 3. Request options: params/query/body typed from operation
 *
 * @typeParam Paths - OpenAPI paths type from openapi-typescript
 * @param options - Client configuration
 * @returns API client with typed methods for all operations
 *
 * @pure false - creates client that performs HTTP requests
 * @effect Client methods return Effect<Success, Failure, HttpClient>
 * @invariant ∀ path, method: path ∈ PathsForMethod<Paths, method>
 * @complexity O(1) client creation
 *
 * @example
 * ```typescript
 * import createClient from "openapi-effect"
 * import type { Paths } from "./generated/schema"
 * import { dispatchergetPet } from "./generated/dispatch"
 *
 * const client = createClient<Paths>({
 *   baseUrl: "https://api.example.com",
 *   credentials: "include"
 * })
 *
 * // Type-safe call - path must have "get", dispatcher must match
 * const result = yield* client.GET("/pets/{petId}", dispatchergetPet, {
 *   params: { petId: "123" }  // Required because getPet has path params
 * })
 *
 * // Compile error: "/pets/{petId}" has no "put" method
 * // client.PUT("/pets/{petId}", ...) // Type error!
 *
 * // Compile error: wrong dispatcher for path
 * // client.GET("/pets/{petId}", dispatcherlistPets, ...) // Type error!
 * ```
 */
export const createClient = <Paths extends object>(
  options: ClientOptions
): StrictApiClient<Paths> =>
  asStrictApiClient<StrictApiClient<Paths>>({
    GET: createMethodHandler("get", options),
    POST: createMethodHandler("post", options),
    PUT: createMethodHandler("put", options),
    DELETE: createMethodHandler("delete", options),
    PATCH: createMethodHandler("patch", options),
    HEAD: createMethodHandler("head", options),
    OPTIONS: createMethodHandler("options", options)
  })
