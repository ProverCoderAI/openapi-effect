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
import { Effect } from "effect"
import type { HttpMethod } from "openapi-typescript-helpers"

import { asDispatchersFor, asStrictApiClient, asStrictRequestInit, type Dispatcher } from "../../core/axioms.js"
import type {
  ClientEffect,
  ClientOptions,
  DispatchersFor,
  DispatchersForMethod,
  StrictApiClientWithDispatchers
} from "./create-client-types.js"
import type { StrictRequestInit } from "./strict-client.js"
import { createUniversalDispatcher, executeRequest } from "./strict-client.js"

export type {
  ClientEffect,
  ClientOptions,
  DispatchersFor,
  StrictApiClient,
  StrictApiClientWithDispatchers
} from "./create-client-types.js"
export { createUniversalDispatcher } from "./strict-client.js"

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

// CHANGE: Add default dispatcher registry for auto-dispatching createClient
// WHY: Allow createClient(options) without explicitly passing dispatcher map
// QUOTE(ТЗ): "const apiClient = createClient<Paths>(clientOptions)"
// REF: user-msg-4
// SOURCE: n/a
// FORMAT THEOREM: ∀ call: defaultDispatchers = dispatchersByPath ⇒ createClient uses dispatcher(path, method)
// PURITY: SHELL
// EFFECT: none
// INVARIANT: defaultDispatchers is set before createClient use
// COMPLEXITY: O(1)
let defaultDispatchers: DispatchersFor<object> | undefined

/**
 * Register default dispatcher map used by createClient(options)
 *
 * @pure false - mutates module-level registry
 * @invariant defaultDispatchers set exactly once per app boot
 */
export const registerDefaultDispatchers = <Paths extends object>(
  dispatchers: DispatchersFor<Paths>
): void => {
  defaultDispatchers = dispatchers
}

/**
 * Resolve default dispatcher map or fail fast
 *
 * @pure false - reads module-level registry
 * @invariant defaultDispatchers must be set for auto-dispatching client
 */
const resolveDefaultDispatchers = <Paths extends object>(): DispatchersFor<Paths> => {
  if (defaultDispatchers === undefined) {
    throw new Error("Default dispatchers are not registered. Import generated dispatchers module.")
  }
  return asDispatchersFor<DispatchersFor<Paths>>(defaultDispatchers)
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
  baseUrl: string | undefined,
  path: string,
  params?: Record<string, ParamValue>,
  query?: Record<string, QueryValue>
): string => {
  // Replace path parameters
  let url = path
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url = url.replace("{" + key + "}", encodeURIComponent(String(value)))
    }
  }

  // Add query parameters
  if (query) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          searchParams.append(key, String(item))
        }
      } else {
        searchParams.set(key, String(value))
      }
    }
    const qs = searchParams.toString()
    if (qs.length > 0) {
      url = url.includes("?") ? url + "&" + qs : url + "?" + qs
    }
  }

  // If baseUrl isn't provided, keep a relative URL (browser-friendly)
  if (baseUrl === undefined || baseUrl === "") {
    return url
  }

  // Construct full URL
  return new URL(url, baseUrl).toString()
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
const toHeaders = (headersInit: ClientOptions["headers"] | undefined): Headers => {
  const headers = new Headers()
  if (headersInit === undefined) {
    return headers
  }

  if (headersInit instanceof Headers) {
    return new Headers(headersInit)
  }

  if (Array.isArray(headersInit)) {
    for (const entry of headersInit) {
      if (Array.isArray(entry) && entry.length === 2) {
        headers.set(String(entry[0]), String(entry[1]))
      }
    }
    return headers
  }

  for (const [key, value] of Object.entries(headersInit)) {
    if (value === null || value === undefined) {
      continue
    }
    if (Array.isArray(value)) {
      headers.set(key, value.map(String).join(","))
      continue
    }
    headers.set(key, String(value))
  }

  return headers
}

const mergeHeaders = (
  clientHeaders: ClientOptions["headers"] | undefined,
  requestHeaders: ClientOptions["headers"] | undefined
): Headers => {
  const headers = toHeaders(clientHeaders)
  const optHeaders = toHeaders(requestHeaders)
  for (const [key, value] of optHeaders.entries()) {
    headers.set(key, value)
  }
  return headers
}

/**
 * Request options type for method handlers
 *
 * @pure true - type alias only
 */
type MethodHandlerOptions = {
  params?: Record<string, ParamValue> | undefined
  query?: Record<string, QueryValue> | undefined
  body?: BodyInit | object | undefined
  headers?: ClientOptions["headers"] | undefined
  signal?: AbortSignal | undefined
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
 * Create method handler that infers dispatcher from map
 *
 * @pure false - creates function that performs HTTP requests
 * @complexity O(1) handler creation
 */
const createMethodHandlerWithDispatchers = <Paths extends object, Method extends HttpMethod>(
  method: Method,
  clientOptions: ClientOptions,
  dispatchers: DispatchersForMethod<Paths, Method>
) =>
<Path extends keyof DispatchersForMethod<Paths, Method> & string>(
  path: Path,
  options?: MethodHandlerOptions
) =>
  createMethodHandler(method, clientOptions)(
    path,
    dispatchers[path][method],
    options
  )

// CHANGE: Create method handler that infers dispatcher from map
// WHY: Allow per-call API without passing dispatcher parameter
// QUOTE(ТЗ): "Зачем передавать что либо в GET"
// REF: user-msg-1
// SOURCE: n/a
// FORMAT THEOREM: ∀ path ∈ PathsForMethod<Paths, method>: dispatchers[path][method] = Dispatcher<ResponsesFor<Op>>
// PURITY: SHELL
// EFFECT: Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient>
// INVARIANT: Dispatcher lookup is total for all operations in Paths
// COMPLEXITY: O(1) runtime + O(1) dispatcher lookup
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
 * import "./generated/dispatchers-by-path" // registers default dispatchers
 *
 * const client = createClient<Paths>({
 *   baseUrl: "https://api.example.com",
 *   credentials: "include"
 * })
 *
 * // Type-safe call - dispatcher inferred from path+method
 * const result = yield* client.GET("/pets/{petId}", {
 *   params: { petId: "123" }  // Required because getPet has path params
 * })
 *
 * // Compile error: "/pets/{petId}" has no "put" method
 * // client.PUT("/pets/{petId}", ...) // Type error!
 * ```
 */
export const createClient = <Paths extends object>(
  options: ClientOptions,
  dispatchers?: DispatchersFor<Paths>
): StrictApiClientWithDispatchers<Paths> => {
  const resolvedDispatchers = dispatchers ?? resolveDefaultDispatchers<Paths>()

  return asStrictApiClient<StrictApiClientWithDispatchers<Paths>>({
    GET: createMethodHandlerWithDispatchers("get", options, resolvedDispatchers),
    POST: createMethodHandlerWithDispatchers("post", options, resolvedDispatchers),
    PUT: createMethodHandlerWithDispatchers("put", options, resolvedDispatchers),
    DELETE: createMethodHandlerWithDispatchers("delete", options, resolvedDispatchers),
    PATCH: createMethodHandlerWithDispatchers("patch", options, resolvedDispatchers),
    HEAD: createMethodHandlerWithDispatchers("head", options, resolvedDispatchers),
    OPTIONS: createMethodHandlerWithDispatchers("options", options, resolvedDispatchers)
  })
}

// CHANGE: Add createMethodHandlerWithUniversalDispatcher for zero-boilerplate client
// WHY: Enable createClientEffect<Paths>(options) without code generation or dispatcher registry
// QUOTE(ТЗ): "Я не хочу создавать какие-то дополнительные модули"
// REF: issue-5
// SOURCE: n/a
// FORMAT THEOREM: ∀ path, method: universalDispatcher handles response classification generically
// PURITY: SHELL
// EFFECT: Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient>
// INVARIANT: 2xx → success channel, non-2xx → error channel
// COMPLEXITY: O(1) handler creation + O(1) universal dispatcher creation per call
const createMethodHandlerWithUniversalDispatcher = (
  method: HttpMethod,
  clientOptions: ClientOptions
) =>
(
  path: string,
  options?: MethodHandlerOptions
) =>
  createMethodHandler(method, clientOptions)(
    path,
    createUniversalDispatcher(),
    options
  )

type HttpErrorTag = { readonly _tag: "HttpError" }

const isHttpErrorValue = (error: unknown): error is HttpErrorTag =>
  typeof error === "object"
  && error !== null
  && "_tag" in error
  && Reflect.get(error, "_tag") === "HttpError"

const exposeHttpErrorsAsValues = <A, E>(
  request: Effect.Effect<A, E, HttpClient.HttpClient>
): Effect.Effect<
  A | Extract<E, HttpErrorTag>,
  Exclude<E, Extract<E, HttpErrorTag>>,
  HttpClient.HttpClient
> =>
  request.pipe(
    Effect.catchIf(
      (error): error is Extract<E, HttpErrorTag> => isHttpErrorValue(error),
      (error) => Effect.succeed(error)
    )
  )

const createMethodHandlerWithUniversalDispatcherValue = (
  method: HttpMethod,
  clientOptions: ClientOptions
) =>
(
  path: string,
  options?: MethodHandlerOptions
) =>
  exposeHttpErrorsAsValues(
    createMethodHandlerWithUniversalDispatcher(method, clientOptions)(path, options)
  )

// CHANGE: Add createClientEffect — zero-boilerplate Effect-based API client
// WHY: Enable the user's desired DSL without any generated code or dispatcher setup
// QUOTE(ТЗ): "const apiClientEffect = createClientEffect<Paths>(clientOptions); apiClientEffect.POST('/api/auth/login', { body: credentials })"
// REF: issue-5
// SOURCE: n/a
// FORMAT THEOREM: ∀ Paths, options: createClientEffect<Paths>(options) → ClientEffect<Paths>
// PURITY: SHELL
// EFFECT: Client methods return Effect<ApiSuccess | HttpError, BoundaryError, HttpClient>
// INVARIANT: ∀ path, method: path ∈ PathsForMethod<Paths, method> (compile-time) ∧ response classified by status range (runtime)
// COMPLEXITY: O(1) client creation
/**
 * Create type-safe Effect-based API client with zero boilerplate
 *
 * Uses a universal dispatcher and exposes HTTP statuses as values:
 * - 2xx → success value (ApiSuccess)
 * - non-2xx schema statuses → success value (HttpError with _tag)
 * - boundary/protocol failures stay in error channel
 * - JSON parsed automatically for application/json content types
 *
 * **No code generation needed.** No dispatcher registry needed.
 * Just pass your OpenAPI Paths type and client options.
 *
 * @typeParam Paths - OpenAPI paths type from openapi-typescript
 * @param options - Client configuration (baseUrl, credentials, headers, etc.)
 * @returns API client with typed methods for all operations
 *
 * @pure false - creates client that performs HTTP requests
 * @effect Client methods return Effect<Success, Failure, HttpClient>
 * @invariant ∀ path, method: path ∈ PathsForMethod<Paths, method>
 * @complexity O(1) client creation
 *
 * @example
 * ```typescript
 * import { createClientEffect, type ClientOptions } from "openapi-effect"
 * import type { paths } from "./openapi.d.ts"
 *
 * const clientOptions: ClientOptions = {
 *   baseUrl: "https://petstore.example.com",
 *   credentials: "include"
 * }
 * const apiClientEffect = createClientEffect<paths>(clientOptions)
 *
 * // Type-safe call — path, method, and body all enforced at compile time
 * const result = yield* apiClientEffect.POST("/api/auth/login", {
 *   body: { email: "user@example.com", password: "secret" }
 * })
 * ```
 */
export const createClientEffect = <Paths extends object>(
  options: ClientOptions
): ClientEffect<Paths> => {
  return asStrictApiClient<ClientEffect<Paths>>({
    GET: createMethodHandlerWithUniversalDispatcherValue("get", options),
    POST: createMethodHandlerWithUniversalDispatcherValue("post", options),
    PUT: createMethodHandlerWithUniversalDispatcherValue("put", options),
    DELETE: createMethodHandlerWithUniversalDispatcherValue("delete", options),
    PATCH: createMethodHandlerWithUniversalDispatcherValue("patch", options),
    HEAD: createMethodHandlerWithUniversalDispatcherValue("head", options),
    OPTIONS: createMethodHandlerWithUniversalDispatcherValue("options", options)
  })
}
