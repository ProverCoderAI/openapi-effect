// CHANGE: Create axioms module for type-safe cast operations
// WHY: Centralize all type assertions in a single auditable location per CLAUDE.md
// QUOTE(ТЗ): "as: запрещён в обычном коде; допускается ТОЛЬКО в одном аксиоматическом модуле"
// REF: issue-2, section 3.1
// SOURCE: n/a
// FORMAT THEOREM: ∀ cast ∈ Axioms: cast(x) → typed(x) ∨ runtime_validated(x)
// PURITY: CORE
// EFFECT: none - pure type-level operations
// INVARIANT: All casts auditable in single file
// COMPLEXITY: O(1)

/**
 * JSON value type - result of JSON.parse()
 * This is the fundamental type for all parsed JSON values
 */
/**
 * Cast function for dispatcher factory
 * AXIOM: Dispatcher factory receives valid classify function
 *
 * This enables generated dispatchers to work with heterogeneous Effect unions.
 * The cast is safe because:
 * 1. The classify function is generated from OpenAPI schema
 * 2. All status/content-type combinations are exhaustively covered
 * 3. The returned Effect conforms to Dispatcher signature
 *
 * @pure true
 */
import type { Effect } from "effect"
import type { ApiFailure, ApiSuccess, TransportError } from "./api-client/strict-types.js"

export type Json =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<Json>
  | { readonly [k: string]: Json }

/**
 * Cast parsed JSON value to typed Json
 * AXIOM: JSON.parse returns a valid Json value
 *
 * @precondition value is result of JSON.parse on valid JSON string
 * @postcondition result conforms to Json type
 * @pure true
 */
export const asJson = (value: unknown): Json => value as Json

/**
 * Cast a value to a specific type with const assertion
 * Used for creating literal typed objects in generated code
 *
 * @pure true
 */
export const asConst = <T>(value: T): T => value

/**
 * Create a typed RawResponse from raw values
 * AXIOM: HTTP response structure is known at runtime
 *
 * @pure true
 */
export type RawResponse = {
  readonly status: number
  readonly headers: Headers
  readonly text: string
}

export const asRawResponse = (value: {
  status: number
  headers: Headers
  text: string
}): RawResponse => value as RawResponse

/**
 * Dispatcher classifies response and applies decoder
 *
 * NEW DESIGN (Effect-native):
 * - Success channel: `ApiSuccess<Responses>` (2xx responses only)
 * - Error channel: `ApiFailure<Responses>` (non-2xx schema errors + boundary errors)
 *
 * This forces developers to explicitly handle HTTP errors (404, 500, etc.)
 * using Effect.catchTag, Effect.match, or similar patterns.
 *
 * @pure false - applies decoders
 * @effect Effect<ApiSuccess, HttpError | BoundaryError, never>
 * @invariant Must handle all statuses and content-types from schema
 */
export type Dispatcher<Responses> = (
  response: RawResponse
) => Effect.Effect<
  ApiSuccess<Responses>,
  Exclude<ApiFailure<Responses>, TransportError>
>

export const asDispatcher = <Responses>(
  fn: (response: RawResponse) => Effect.Effect<unknown, unknown>
): Dispatcher<Responses> => fn as Dispatcher<Responses>

/**
 * Cast for StrictRequestInit config object
 * AXIOM: Config object has correct structure when all properties assigned
 *
 * @pure true
 */
export const asStrictRequestInit = <T>(config: object): T => config as T

/**
 * Classifier function type for dispatcher creation
 * AXIOM: Classify function returns Effect with heterogeneous union types
 *
 * This type uses `unknown` to allow the classify function to return
 * heterogeneous Effect unions from switch statements. The actual types
 * are enforced by the generated dispatcher code.
 *
 * @pure true
 */
export type ClassifyFn = (
  status: number,
  contentType: string | undefined,
  text: string
) => Effect.Effect<unknown, unknown>

/**
 * Cast internal client implementation to typed StrictApiClient
 * AXIOM: Client implementation correctly implements all method constraints
 *
 * This cast is safe because:
 * 1. StrictApiClient type enforces path/method constraints at call sites
 * 2. The runtime implementation correctly builds requests for any path/method
 * 3. Type checking happens at the call site, not in the implementation
 *
 * @pure true
 */
export const asStrictApiClient = <T>(client: object): T => client as T
