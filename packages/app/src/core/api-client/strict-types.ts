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
  Paths extends Record<string, unknown>,
  Method extends HttpMethod
> = PathsWithMethod<Paths, Method>

/**
 * Extract operation definition for a path and method
 *
 * @pure true - compile-time only
 * @invariant ∀ path ∈ Paths, method ∈ Methods: Operation<Paths, path, method> = Paths[path][method]
 */
export type OperationFor<
  Paths extends Record<string, unknown>,
  Path extends keyof Paths,
  Method extends HttpMethod
> = Method extends keyof Paths[Path] ? Paths[Path][Method] : never

/**
 * Extract all response definitions from an operation
 *
 * @pure true - compile-time only
 */
export type ResponsesFor<Op> = Op extends { responses: infer R } ? R : never

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
> = Status extends keyof Responses
  ? Responses[Status] extends { content: infer C }
    ? keyof C & string
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
  ? Responses[Status] extends { content: infer C }
    ? ContentType extends keyof C
      ? C[ContentType]
      : never
    : ContentType extends "none"
    ? void
    : never
  : never

/**
 * Build a correlated response variant (status + contentType + body)
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
 * Build all response variants for given responses
 *
 * @pure true - compile-time only
 */
type AllResponseVariants<Responses> = StatusCodes<Responses> extends infer Status
  ? Status extends StatusCodes<Responses>
    ? ContentTypesFor<Responses, Status> extends infer CT
      ? CT extends ContentTypesFor<Responses, Status>
        ? ResponseVariant<Responses, Status, CT>
        : never
      : never
    : never
  : never

/**
 * Filter response variants to success statuses (2xx)
 *
 * @pure true - compile-time only
 * @invariant ∀ v ∈ SuccessVariants: v.status ∈ [200..299]
 */
export type SuccessVariants<Responses> = AllResponseVariants<Responses> extends infer V
  ? V extends ResponseVariant<Responses, infer S, infer CT>
    ? S extends 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226
      ? ResponseVariant<Responses, S, CT>
      : never
    : never
  : never

/**
 * Filter response variants to error statuses (non-2xx from schema)
 *
 * @pure true - compile-time only
 * @invariant ∀ v ∈ HttpErrorVariants: v.status ∉ [200..299] ∧ v.status ∈ Schema
 */
export type HttpErrorVariants<Responses> = AllResponseVariants<Responses> extends infer V
  ? V extends ResponseVariant<Responses, infer S, infer CT>
    ? S extends 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226
      ? never
      : ResponseVariant<Responses, S, CT>
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
  readonly error: unknown
  readonly body: string
}

export type BoundaryError =
  | TransportError
  | UnexpectedStatus
  | UnexpectedContentType
  | ParseError
  | DecodeError

/**
 * Complete failure type for an operation
 *
 * @pure true - compile-time only
 * @invariant Failure = HttpError ⊎ BoundaryError (disjoint union)
 */
export type ApiFailure<Responses> = HttpErrorVariants<Responses> | BoundaryError

/**
 * Success type for an operation
 *
 * @pure true - compile-time only
 */
export type ApiSuccess<Responses> = SuccessVariants<Responses>

/**
 * Helper to ensure exhaustive pattern matching
 *
 * @pure true
 * @throws Compile-time error if called with non-never type
 */
export const assertNever = (x: never): never => {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`)
}
