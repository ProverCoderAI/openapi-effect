// CHANGE: Define core type-level operations for extracting OpenAPI types
// WHY: Enable compile-time type safety without runtime overhead through pure type transformations
// QUOTE(ТЗ): "Success / HttpError являются коррелированными суммами (status → точный тип body) строго из OpenAPI типов"
// REF: issue-2, section 3.1, 4.1-4.3
// SOURCE: n/a
// FORMAT THEOREM: ∀ Op ∈ Operations: ResponseVariant<Op> = Success<Op> ⊎ Failure<Op>
// PURITY: CORE
// INVARIANT: All types computed at compile time, no runtime operations
// COMPLEXITY: O(1) compile-time / O(0) runtime

import type { HttpMethod, PathsWithMethod } from "openapi-typescript-helpers"

/**
 * Extract all paths that support a given HTTP method
 *
 * @pure true - compile-time only
 * @invariant Result ⊆ paths
 */
export type PathsForMethod<
  Paths extends object,
  Method extends HttpMethod
> = PathsWithMethod<Paths, Method>

/**
 * Extract operation definition for a path and method
 *
 * @pure true - compile-time only
 * @invariant ∀ path ∈ Paths, method ∈ Methods: Operation<Paths, path, method> = Paths[path][method]
 */
export type OperationFor<
  Paths extends object,
  Path extends keyof Paths,
  Method extends HttpMethod
> = Method extends keyof Paths[Path] ? Paths[Path][Method] : never

/**
 * Extract all response definitions from an operation
 *
 * @pure true - compile-time only
 */
export type ResponsesFor<Op> = Op extends { responses: infer R } ? R : never

// ============================================================================
// Request-side typing (path/method → params/query/body)
// ============================================================================

/**
 * Extract path parameters from operation
 *
 * @pure true - compile-time only
 * @invariant Returns path params type or undefined if none
 */
export type PathParamsFor<Op> = Op extends { parameters: { path: infer P } }
  ? P extends Record<string, infer V> ? Record<string, V>
  : never
  : undefined

/**
 * Extract query parameters from operation
 *
 * @pure true - compile-time only
 * @invariant Returns query params type or undefined if none
 */
export type QueryParamsFor<Op> = Op extends { parameters: { query?: infer Q } } ? Q
  : undefined

/**
 * Extract request body type from operation
 *
 * @pure true - compile-time only
 * @invariant Returns body type or undefined if no requestBody
 */
export type RequestBodyFor<Op> = Op extends { requestBody: { content: infer C } }
  ? C extends { "application/json": infer J } ? J
  : C extends { [key: string]: infer V } ? V
  : never
  : undefined

/**
 * Check if path params are required
 *
 * @pure true - compile-time only
 */

export type HasRequiredPathParams<Op> = Op extends { parameters: { path: infer P } }
  ? P extends Record<PropertyKey, string | number | boolean> ? keyof P extends never ? false : true
  : false
  : false

/**
 * Check if request body is required
 *
 * @pure true - compile-time only
 */
export type HasRequiredBody<Op> = Op extends { requestBody: infer RB } ? RB extends { content: object } ? true
  : false
  : false

/**
 * Build request options type from operation with all constraints
 * - params: required if path has required parameters
 * - query: optional, typed from operation
 * - body: required if operation has requestBody (accepts typed object OR string)
 *
 * For request body:
 * - Users can pass either the typed object (preferred, for type safety)
 * - Or a pre-stringified JSON string with headers (for backwards compatibility)
 *
 * @pure true - compile-time only
 * @invariant Options type is fully derived from operation definition
 */
export type RequestOptionsFor<Op> =
  & (HasRequiredPathParams<Op> extends true ? { readonly params: PathParamsFor<Op> }
    : { readonly params?: PathParamsFor<Op> })
  & (HasRequiredBody<Op> extends true ? { readonly body: RequestBodyFor<Op> | BodyInit }
    : { readonly body?: RequestBodyFor<Op> | BodyInit })
  & { readonly query?: QueryParamsFor<Op> }
  & { readonly headers?: HeadersInit }
  & { readonly signal?: AbortSignal }

/**
 * Extract status codes from responses
 *
 * @pure true - compile-time only
 * @invariant Result = { s | s ∈ keys(Responses) }
 */
export type StatusCodes<Responses> = keyof Responses & (number | string)

/**
 * Extract content types for a specific status code
 *
 * @pure true - compile-time only
 */
export type ContentTypesFor<
  Responses,
  Status extends StatusCodes<Responses>
> = Status extends keyof Responses ? Responses[Status] extends { content: infer C } ? keyof C & string
  : "none"
  : never

/**
 * Extract body type for a specific status and content-type
 *
 * @pure true - compile-time only
 * @invariant Strict correlation: Body type depends on both status and content-type
 */
export type BodyFor<
  Responses,
  Status extends StatusCodes<Responses>,
  ContentType extends ContentTypesFor<Responses, Status>
> = Status extends keyof Responses
  ? Responses[Status] extends { content: infer C } ? ContentType extends keyof C ? C[ContentType]
    : never
  : ContentType extends "none" ? undefined
  : never
  : never

/**
 * Build a correlated success response variant (status + contentType + body)
 * Used for 2xx responses that go to the success channel.
 *
 * @pure true - compile-time only
 * @invariant ∀ variant: variant.body = BodyFor<Responses, variant.status, variant.contentType>
 */
export type ResponseVariant<
  Responses,
  Status extends StatusCodes<Responses>,
  ContentType extends ContentTypesFor<Responses, Status>
> = {
  readonly status: Status
  readonly contentType: ContentType
  readonly body: BodyFor<Responses, Status, ContentType>
}

/**
 * Build a correlated HTTP error response variant (status + contentType + body + _tag)
 * Used for non-2xx responses (4xx, 5xx) that go to the error channel.
 *
 * The `_tag: "HttpError"` discriminator allows distinguishing HTTP errors from BoundaryErrors.
 *
 * @pure true - compile-time only
 * @invariant ∀ variant: variant.body = BodyFor<Responses, variant.status, variant.contentType>
 */
export type HttpErrorResponseVariant<
  Responses,
  Status extends StatusCodes<Responses>,
  ContentType extends ContentTypesFor<Responses, Status>
> = {
  readonly _tag: "HttpError"
  readonly status: Status
  readonly contentType: ContentType
  readonly body: BodyFor<Responses, Status, ContentType>
}

/**
 * Build all response variants for given responses
 *
 * @pure true - compile-time only
 */
type AllResponseVariants<Responses> = StatusCodes<Responses> extends infer Status
  ? Status extends StatusCodes<Responses>
    ? ContentTypesFor<Responses, Status> extends infer CT
      ? CT extends ContentTypesFor<Responses, Status> ? ResponseVariant<Responses, Status, CT>
      : never
    : never
  : never
  : never

/**
 * Generic 2xx status detection without hardcoding
 * Uses template literal type to check if status string starts with "2"
 *
 * Works with any 2xx status including non-standard ones like 250.
 *
 * @pure true - compile-time only
 * @invariant Is2xx<S> = true ⟺ 200 ≤ S < 300
 */
export type Is2xx<S extends string | number> = `${S}` extends `2${string}` ? true : false

/**
 * Filter response variants to success statuses (2xx)
 * Uses generic Is2xx instead of hardcoded status list.
 *
 * @pure true - compile-time only
 * @invariant ∀ v ∈ SuccessVariants: Is2xx<v.status> = true
 */
export type SuccessVariants<Responses> = AllResponseVariants<Responses> extends infer V
  ? V extends ResponseVariant<Responses, infer S, infer CT> ? Is2xx<S> extends true ? ResponseVariant<Responses, S, CT>
    : never
  : never
  : never

/**
 * Filter response variants to error statuses (non-2xx from schema)
 * Returns HttpErrorResponseVariant with `_tag: "HttpError"` for discrimination.
 * Uses generic Is2xx instead of hardcoded status list.
 *
 * @pure true - compile-time only
 * @invariant ∀ v ∈ HttpErrorVariants: Is2xx<v.status> = false ∧ v.status ∈ Schema ∧ v._tag = "HttpError"
 */
export type HttpErrorVariants<Responses> = AllResponseVariants<Responses> extends infer V
  ? V extends ResponseVariant<Responses, infer S, infer CT> ? Is2xx<S> extends true ? never
    : HttpErrorResponseVariant<Responses, S, CT>
  : never
  : never

/**
 * Boundary errors - always present regardless of schema
 *
 * @pure true - compile-time only
 * @invariant These errors represent protocol/parsing failures, not business logic
 */
export type TransportError = {
  readonly _tag: "TransportError"
  readonly error: Error
}

export type UnexpectedStatus = {
  readonly _tag: "UnexpectedStatus"
  readonly status: number
  readonly body: string
}

export type UnexpectedContentType = {
  readonly _tag: "UnexpectedContentType"
  readonly status: number
  readonly expected: ReadonlyArray<string>
  readonly actual: string | undefined
  readonly body: string
}

export type ParseError = {
  readonly _tag: "ParseError"
  readonly status: number
  readonly contentType: string
  readonly error: Error
  readonly body: string
}

export type DecodeError = {
  readonly _tag: "DecodeError"
  readonly status: number
  readonly contentType: string
  readonly error: Error
  readonly body: string
}

export type BoundaryError =
  | TransportError
  | UnexpectedStatus
  | UnexpectedContentType
  | ParseError
  | DecodeError

/**
 * Success type for an operation (2xx statuses only)
 *
 * Goes to the **success channel** of Effect.
 * Developers receive this directly without needing to handle errors.
 *
 * @pure true - compile-time only
 * @invariant ∀ v ∈ ApiSuccess: v.status ∈ [200..299]
 */
export type ApiSuccess<Responses> = SuccessVariants<Responses>

/**
 * HTTP error responses from schema (non-2xx statuses like 400, 404, 500)
 *
 * Goes to the **error channel** of Effect, forcing explicit handling.
 * These are business-level errors defined in the OpenAPI schema.
 *
 * @pure true - compile-time only
 * @invariant ∀ v ∈ HttpError: v.status ∉ [200..299] ∧ v.status ∈ Schema
 */
export type HttpError<Responses> = HttpErrorVariants<Responses>

/**
 * Complete failure type for API operations
 *
 * Includes both schema-defined HTTP errors (4xx, 5xx) and boundary errors.
 * All failures go to the **error channel** of Effect, forcing explicit handling.
 *
 * @pure true - compile-time only
 * @invariant ApiFailure = HttpError ⊎ BoundaryError
 *
 * BREAKING CHANGE: Previously, HTTP errors (404, 500) were in success channel.
 * Now they are in error channel, requiring explicit handling with Effect.catchTag
 * or Effect.match pattern.
 */
export type ApiFailure<Responses> = HttpError<Responses> | BoundaryError

/**
 * @deprecated Use ApiSuccess<Responses> for success channel
 * and ApiFailure<Responses> for error channel instead.
 *
 * ApiResponse mixed success and error statuses in one type.
 * New API separates them into proper Effect channels.
 */
export type ApiResponse<Responses> = SuccessVariants<Responses> | HttpErrorVariants<Responses>

/**
 * Helper to ensure exhaustive pattern matching
 *
 * @pure true
 * @throws Compile-time error if called with non-never type
 */
export const assertNever = (x: never): never => {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`)
}
