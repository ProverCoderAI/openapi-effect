// CHANGE: Add high-level createClient API for simplified usage
// WHY: Provide convenient wrapper matching openapi-fetch ergonomics
// QUOTE(ТЗ): "Я хочу что бы я мог писать вот такой код: import createClient from \"openapi-effect\"; export const apiClient = createClient<path>({ baseUrl: \"\", credentials: \"include\" });"
// REF: PR#3 comment from skulidropek
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Creates Effect-based API client
// INVARIANT: All operations preserve Effect-based error handling
// COMPLEXITY: O(1) client creation

import type { HttpMethod } from "openapi-typescript-helpers"

import type { ResponsesFor } from "../../core/api-client/strict-types.js"
import { asStrictRequestInit, type Dispatcher } from "../../core/axioms.js"
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
 * Request options for API methods
 *
 * @pure - immutable options
 */
export type RequestOptions = {
  readonly params?: Record<string, string | number | boolean>
  readonly body?: BodyInit
  readonly query?: Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>
  readonly headers?: HeadersInit
  readonly signal?: AbortSignal
}

/**
 * Type-safe API client with Effect-based operations
 *
 * @typeParam Paths - OpenAPI paths type from openapi-typescript
 *
 * @pure false - operations perform HTTP requests
 * @effect All methods return Effect<Success, Failure, never>
 */
export type StrictApiClient<Paths extends Record<string, unknown>> = {
  readonly GET: <
    Path extends Extract<keyof Paths, string>,
    Op = Paths[Path] extends { get: infer G } ? G : never,
    Responses = ResponsesFor<Op>
  >(
    path: Path,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => ReturnType<typeof executeRequest<Responses>>

  readonly POST: <
    Path extends Extract<keyof Paths, string>,
    Op = Paths[Path] extends { post: infer P } ? P : never,
    Responses = ResponsesFor<Op>
  >(
    path: Path,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => ReturnType<typeof executeRequest<Responses>>

  readonly PUT: <
    Path extends Extract<keyof Paths, string>,
    Op = Paths[Path] extends { put: infer P } ? P : never,
    Responses = ResponsesFor<Op>
  >(
    path: Path,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => ReturnType<typeof executeRequest<Responses>>

  readonly DELETE: <
    Path extends Extract<keyof Paths, string>,
    Op = Paths[Path] extends { delete: infer D } ? D : never,
    Responses = ResponsesFor<Op>
  >(
    path: Path,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => ReturnType<typeof executeRequest<Responses>>

  readonly PATCH: <
    Path extends Extract<keyof Paths, string>,
    Op = Paths[Path] extends { patch: infer P } ? P : never,
    Responses = ResponsesFor<Op>
  >(
    path: Path,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => ReturnType<typeof executeRequest<Responses>>

  readonly HEAD: <
    Path extends Extract<keyof Paths, string>,
    Op = Paths[Path] extends { head: infer H } ? H : never,
    Responses = ResponsesFor<Op>
  >(
    path: Path,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => ReturnType<typeof executeRequest<Responses>>

  readonly OPTIONS: <
    Path extends Extract<keyof Paths, string>,
    Op = Paths[Path] extends { options: infer O } ? O : never,
    Responses = ResponsesFor<Op>
  >(
    path: Path,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => ReturnType<typeof executeRequest<Responses>>
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
  params?: Record<string, string | number | boolean>,
  query?: Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>
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
 * Create HTTP method handler
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
  options?: RequestOptions
) => {
  const url = buildUrl(
    clientOptions.baseUrl,
    path,
    options?.params,
    options?.query
  )

  const headers = new Headers(clientOptions.headers)
  if (options?.headers) {
    const optHeaders = new Headers(options.headers)
    for (const [key, value] of optHeaders.entries()) {
      headers.set(key, value)
    }
  }

  const config: StrictRequestInit<Responses> = asStrictRequestInit({
    method,
    url,
    dispatcher,
    headers,
    body: options?.body,
    signal: options?.signal
  })

  return executeRequest(config)
}

/**
 * Create type-safe Effect-based API client
 *
 * @typeParam Paths - OpenAPI paths type from openapi-typescript
 * @param options - Client configuration
 * @returns API client with typed methods for all operations
 *
 * @pure false - creates client that performs HTTP requests
 * @effect Client methods return Effect<Success, Failure, HttpClient>
 * @invariant All errors explicitly typed; no exceptions escape
 * @complexity O(1) client creation
 *
 * @example
 * ```typescript
 * import createClient from "openapi-effect"
 * import type { paths } from "./generated/schema"
 *
 * const client = createClient<paths>({
 *   baseUrl: "https://api.example.com",
 *   credentials: "include"
 * })
 *
 * const result = client.GET("/pets/{id}", dispatcherGetPet, {
 *   params: { id: "123" }
 * })
 * ```
 */
export const createClient = <Paths extends Record<string, unknown>>(
  options: ClientOptions
): StrictApiClient<Paths> => ({
  GET: createMethodHandler("get", options),
  POST: createMethodHandler("post", options),
  PUT: createMethodHandler("put", options),
  DELETE: createMethodHandler("delete", options),
  PATCH: createMethodHandler("patch", options),
  HEAD: createMethodHandler("head", options),
  OPTIONS: createMethodHandler("options", options)
})
