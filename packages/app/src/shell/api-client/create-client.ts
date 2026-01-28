// CHANGE: Add high-level createClient API for simplified usage with proper type inference
// WHY: Provide convenient wrapper matching openapi-fetch ergonomics with automatic type inference
// QUOTE(ТЗ): "Я хочу что бы я мог писать вот такой код: import createClient from \"openapi-effect\"; export const apiClient = createClient<path>({ baseUrl: \"\", credentials: \"include\" });"
// REF: PR#3 comment from skulidropek
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: Creates Effect-based API client
// INVARIANT: All operations preserve Effect-based error handling
// COMPLEXITY: O(1) client creation

import type * as HttpClient from "@effect/platform/HttpClient"
import type { Effect } from "effect"
import type { HttpMethod } from "openapi-typescript-helpers"

import type { ApiFailure, ApiSuccess } from "../../core/api-client/strict-types.js"
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
 * Type-safe API client with Effect-native error handling
 *
 * The Responses type is inferred from the Dispatcher parameter, which allows
 * TypeScript to automatically determine success/failure types without explicit annotations.
 *
 * **Effect Channel Design:**
 * - Success channel: `ApiSuccess<Responses>` - 2xx responses only
 * - Error channel: `ApiFailure<Responses>` - HTTP errors (4xx, 5xx) + boundary errors
 *
 * This forces developers to explicitly handle HTTP errors using:
 * - `Effect.catchTag` for specific error types (e.g., 404, 500)
 * - `Effect.match` for exhaustive handling
 * - `Effect.catchAll` for generic error handling
 *
 * @typeParam Paths - OpenAPI paths type from openapi-typescript
 *
 * @pure false - operations perform HTTP requests
 * @effect All methods return Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient>
 */
export type StrictApiClient<Paths extends object> = {
  /**
   * Execute GET request
   *
   * @typeParam Responses - Response types (inferred from dispatcher)
   * @param path - API path
   * @param dispatcher - Response dispatcher (provides type inference)
   * @param options - Optional request options
   * @returns Effect with 2xx in success channel, errors in error channel
   */
  readonly GET: <Responses>(
    path: Extract<keyof Paths, string>,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => Effect.Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient.HttpClient>

  /**
   * Execute POST request
   */
  readonly POST: <Responses>(
    path: Extract<keyof Paths, string>,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => Effect.Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient.HttpClient>

  /**
   * Execute PUT request
   */
  readonly PUT: <Responses>(
    path: Extract<keyof Paths, string>,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => Effect.Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient.HttpClient>

  /**
   * Execute DELETE request
   */
  readonly DELETE: <Responses>(
    path: Extract<keyof Paths, string>,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => Effect.Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient.HttpClient>

  /**
   * Execute PATCH request
   */
  readonly PATCH: <Responses>(
    path: Extract<keyof Paths, string>,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => Effect.Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient.HttpClient>

  /**
   * Execute HEAD request
   */
  readonly HEAD: <Responses>(
    path: Extract<keyof Paths, string>,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => Effect.Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient.HttpClient>

  /**
   * Execute OPTIONS request
   */
  readonly OPTIONS: <Responses>(
    path: Extract<keyof Paths, string>,
    dispatcher: Dispatcher<Responses>,
    options?: RequestOptions
  ) => Effect.Effect<ApiSuccess<Responses>, ApiFailure<Responses>, HttpClient.HttpClient>
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
 * The client automatically infers response types from the dispatcher parameter,
 * eliminating the need for explicit type annotations on the result.
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
 * // Types are automatically inferred - no annotation needed!
 * const result = yield* client.GET("/pets/{id}", dispatcherGetPet, {
 *   params: { id: "123" }
 * })
 * // result is correctly typed as ApiSuccess<GetPetResponses>
 * ```
 */
export const createClient = <Paths extends object>(
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
