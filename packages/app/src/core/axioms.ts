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

/**
 * Cast middleware callback output after async boundary normalization.
 * AXIOM: Middleware runtime validation checks the concrete Request/Response/Error
 * shape before the value is used to modify execution.
 *
 * @pure true
 */
export const asMiddlewareResult = <T>(value: unknown): T => value as T
