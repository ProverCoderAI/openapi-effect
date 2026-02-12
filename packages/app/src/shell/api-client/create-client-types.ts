// CHANGE: Extract public createClient types into dedicated module
// WHY: Keep create-client.ts under lint max-lines without weakening type-level invariants
// QUOTE(ТЗ): "Только прогони по всему проекту линтеры"
// REF: user-msg-2
// SOURCE: n/a
// PURITY: CORE
// EFFECT: none
// INVARIANT: All type-level correlations remain unchanged
// COMPLEXITY: O(1) compile-time / O(0) runtime

import type * as HttpClient from "@effect/platform/HttpClient"
import type { Effect } from "effect"
import type { ClientOptions as OpenapiFetchClientOptions } from "openapi-fetch"
import type { HttpMethod } from "openapi-typescript-helpers"

import type {
  ApiFailure,
  ApiSuccess,
  HttpError,
  OperationFor,
  PathsForMethod,
  RequestOptionsFor,
  ResponsesFor
} from "../../core/api-client/strict-types.js"
import type { Dispatcher } from "../../core/axioms.js"

/**
 * Client configuration options
 *
 * @pure - immutable configuration
 */
export type ClientOptions = OpenapiFetchClientOptions

// CHANGE: Add dispatcher map type for auto-dispatching clients
// WHY: Enable creating clients that infer dispatcher from path+method without per-call parameter
// QUOTE(ТЗ): "ApiClient и так знает текущие типы. Зачем передавать что либо в GET"
// REF: user-msg-1
// SOURCE: n/a
// FORMAT THEOREM: ∀ path, method: dispatchers[path][method] = Dispatcher<ResponsesFor<OperationFor<Paths, path, method>>>
// PURITY: CORE
// EFFECT: none
// INVARIANT: dispatcher map is total for all operations in Paths
// COMPLEXITY: O(1) compile-time / O(0) runtime
export type DispatchersForMethod<
  Paths extends object,
  Method extends HttpMethod
> = {
  readonly [Path in PathsForMethod<Paths, Method>]: {
    readonly [K in Method]: Dispatcher<ResponsesFor<OperationFor<Paths, Path, Method>>>
  }
}

export type DispatchersFor<Paths extends object> =
  & DispatchersForMethod<Paths, "get">
  & DispatchersForMethod<Paths, "post">
  & DispatchersForMethod<Paths, "put">
  & DispatchersForMethod<Paths, "delete">
  & DispatchersForMethod<Paths, "patch">
  & DispatchersForMethod<Paths, "head">
  & DispatchersForMethod<Paths, "options">

type ResponsesForOperation<
  Paths extends object,
  Path extends keyof Paths,
  Method extends HttpMethod
> = ResponsesFor<OperationFor<Paths, Path, Method>>

type RequestEffect<
  Paths extends object,
  Path extends keyof Paths,
  Method extends HttpMethod
> = Effect.Effect<
  ApiSuccess<ResponsesForOperation<Paths, Path, Method>>,
  ApiFailure<ResponsesForOperation<Paths, Path, Method>>,
  HttpClient.HttpClient
>

type RequestEffectWithHttpErrorsInSuccess<
  Paths extends object,
  Path extends keyof Paths,
  Method extends HttpMethod
> = Effect.Effect<
  | ApiSuccess<ResponsesForOperation<Paths, Path, Method>>
  | HttpError<ResponsesForOperation<Paths, Path, Method>>,
  Exclude<
    ApiFailure<ResponsesForOperation<Paths, Path, Method>>,
    HttpError<ResponsesForOperation<Paths, Path, Method>>
  >,
  HttpClient.HttpClient
>

type DispatcherFor<
  Paths extends object,
  Path extends keyof Paths,
  Method extends HttpMethod
> = Dispatcher<ResponsesForOperation<Paths, Path, Method>>

type RequestOptionsForOperation<
  Paths extends object,
  Path extends keyof Paths,
  Method extends HttpMethod
> = RequestOptionsFor<OperationFor<Paths, Path, Method>>

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
    dispatcher: DispatcherFor<Paths, Path, "get">,
    options?: RequestOptionsForOperation<Paths, Path, "get">
  ) => RequestEffect<Paths, Path, "get">

  /**
   * Execute POST request
   */
  readonly POST: <Path extends PathsForMethod<Paths, "post">>(
    path: Path,
    dispatcher: DispatcherFor<Paths, Path, "post">,
    options?: RequestOptionsForOperation<Paths, Path, "post">
  ) => RequestEffect<Paths, Path, "post">

  /**
   * Execute PUT request
   */
  readonly PUT: <Path extends PathsForMethod<Paths, "put">>(
    path: Path,
    dispatcher: DispatcherFor<Paths, Path, "put">,
    options?: RequestOptionsForOperation<Paths, Path, "put">
  ) => RequestEffect<Paths, Path, "put">

  /**
   * Execute DELETE request
   */
  readonly DELETE: <Path extends PathsForMethod<Paths, "delete">>(
    path: Path,
    dispatcher: DispatcherFor<Paths, Path, "delete">,
    options?: RequestOptionsForOperation<Paths, Path, "delete">
  ) => RequestEffect<Paths, Path, "delete">

  /**
   * Execute PATCH request
   */
  readonly PATCH: <Path extends PathsForMethod<Paths, "patch">>(
    path: Path,
    dispatcher: DispatcherFor<Paths, Path, "patch">,
    options?: RequestOptionsForOperation<Paths, Path, "patch">
  ) => RequestEffect<Paths, Path, "patch">

  /**
   * Execute HEAD request
   */
  readonly HEAD: <Path extends PathsForMethod<Paths, "head">>(
    path: Path,
    dispatcher: DispatcherFor<Paths, Path, "head">,
    options?: RequestOptionsForOperation<Paths, Path, "head">
  ) => RequestEffect<Paths, Path, "head">

  /**
   * Execute OPTIONS request
   */
  readonly OPTIONS: <Path extends PathsForMethod<Paths, "options">>(
    path: Path,
    dispatcher: DispatcherFor<Paths, Path, "options">,
    options?: RequestOptionsForOperation<Paths, Path, "options">
  ) => RequestEffect<Paths, Path, "options">
}

/**
 * Type-safe API client with auto-dispatching (dispatcher is derived from path+method)
 *
 * **Key guarantees:**
 * 1. GET only works on paths that have `get` method in schema
 * 2. Dispatcher is looked up from provided dispatcher map by path+method
 * 3. Request options (params/query/body) are derived from operation
 *
 * **Effect Channel Design:**
 * - Success channel: `ApiSuccess<Responses>` - 2xx responses only
 * - Error channel: `ApiFailure<Responses>` - HTTP errors (4xx, 5xx) + boundary errors
 *
 * @typeParam Paths - OpenAPI paths type from openapi-typescript
 *
 * @pure false - operations perform HTTP requests
 * @invariant ∀ call: path ∈ PathsForMethod<Paths, method> ∧ dispatcherMap[path][method] defined
 */
export type StrictApiClientWithDispatchers<Paths extends object> = {
  /**
   * Execute GET request (dispatcher is inferred)
   */
  readonly GET: <Path extends PathsForMethod<Paths, "get">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "get">
  ) => RequestEffect<Paths, Path, "get">

  /**
   * Execute POST request (dispatcher is inferred)
   */
  readonly POST: <Path extends PathsForMethod<Paths, "post">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "post">
  ) => RequestEffect<Paths, Path, "post">

  /**
   * Execute PUT request (dispatcher is inferred)
   */
  readonly PUT: <Path extends PathsForMethod<Paths, "put">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "put">
  ) => RequestEffect<Paths, Path, "put">

  /**
   * Execute DELETE request (dispatcher is inferred)
   */
  readonly DELETE: <Path extends PathsForMethod<Paths, "delete">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "delete">
  ) => RequestEffect<Paths, Path, "delete">

  /**
   * Execute PATCH request (dispatcher is inferred)
   */
  readonly PATCH: <Path extends PathsForMethod<Paths, "patch">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "patch">
  ) => RequestEffect<Paths, Path, "patch">

  /**
   * Execute HEAD request (dispatcher is inferred)
   */
  readonly HEAD: <Path extends PathsForMethod<Paths, "head">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "head">
  ) => RequestEffect<Paths, Path, "head">

  /**
   * Execute OPTIONS request (dispatcher is inferred)
   */
  readonly OPTIONS: <Path extends PathsForMethod<Paths, "options">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "options">
  ) => RequestEffect<Paths, Path, "options">
}

/**
 * Ergonomic API client where HTTP statuses (2xx + 4xx/5xx from schema)
 * are returned in the success value channel.
 *
 * Boundary/protocol errors remain in the error channel.
 * This removes the need for `Effect.either` when handling normal HTTP statuses.
 */
export type ClientEffect<Paths extends object> = {
  readonly GET: <Path extends PathsForMethod<Paths, "get">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "get">
  ) => RequestEffectWithHttpErrorsInSuccess<Paths, Path, "get">

  readonly POST: <Path extends PathsForMethod<Paths, "post">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "post">
  ) => RequestEffectWithHttpErrorsInSuccess<Paths, Path, "post">

  readonly PUT: <Path extends PathsForMethod<Paths, "put">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "put">
  ) => RequestEffectWithHttpErrorsInSuccess<Paths, Path, "put">

  readonly DELETE: <Path extends PathsForMethod<Paths, "delete">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "delete">
  ) => RequestEffectWithHttpErrorsInSuccess<Paths, Path, "delete">

  readonly PATCH: <Path extends PathsForMethod<Paths, "patch">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "patch">
  ) => RequestEffectWithHttpErrorsInSuccess<Paths, Path, "patch">

  readonly HEAD: <Path extends PathsForMethod<Paths, "head">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "head">
  ) => RequestEffectWithHttpErrorsInSuccess<Paths, Path, "head">

  readonly OPTIONS: <Path extends PathsForMethod<Paths, "options">>(
    path: Path,
    options?: RequestOptionsForOperation<Paths, Path, "options">
  ) => RequestEffectWithHttpErrorsInSuccess<Paths, Path, "options">
}
