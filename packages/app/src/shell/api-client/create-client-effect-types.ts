// CHANGE: Define Effect-channel client types over openapi-fetch-compatible inputs
// WHY: Method inputs stay derived from openapi-fetch helpers while output is inferred from operation responses
// QUOTE(ТЗ): "output должен отличаться тем что он стаёт Effect ... input должен быть 1 в 1"
// REF: user-msg-openapi-effect-input-compat
// SOURCE: n/a
// PURITY: CORE - compile-time types only
// EFFECT: Effect<ApiSuccess<Responses>, ApiFailure<Responses>, never>
// INVARIANT: ∀ call: Path ∧ Method select exactly one OpenAPI operation response set
// COMPLEXITY: O(1) runtime / compile-time only

import type { Effect } from "effect"
import type { HttpMethod, PathsWithMethod } from "openapi-typescript-helpers"

import type { ApiFailure, ApiSuccess, ResponsesFor } from "../../core/api-client/strict-types.js"
import type {
  MaybeOptionalInit,
  MethodArgs,
  Middleware,
  OperationFor,
  RequestMethodArgs
} from "./create-client-types.js"

type EffectMethodResult<
  Paths extends object,
  Path extends PathsWithMethod<Paths, Method>,
  Method extends HttpMethod
> = Effect.Effect<
  ApiSuccess<ResponsesFor<OperationFor<Paths, Path & keyof Paths, Method>>>,
  ApiFailure<ResponsesFor<OperationFor<Paths, Path & keyof Paths, Method>>>
>

type EffectPath<Paths extends object, Method extends HttpMethod> = PathsWithMethod<Paths, Method>

type EffectInit<
  Paths extends object,
  Method extends HttpMethod,
  Path extends EffectPath<Paths, Method>
> = MaybeOptionalInit<Paths[Path], Extract<Method, keyof Paths[Path]>>

export interface EffectClientMethod<
  Paths extends object,
  Method extends HttpMethod
> {
  <
    Path extends EffectPath<Paths, Method>,
    Init extends EffectInit<Paths, Method, Path>
  >(
    ...args: MethodArgs<Paths, Method, Path, Init>
  ): EffectMethodResult<Paths, Path, Method>
}

export interface EffectClientRequestMethod<Paths extends object> {
  <
    Method extends HttpMethod,
    Path extends EffectPath<Paths, Method>,
    Init extends EffectInit<Paths, Method, Path>
  >(
    ...args: RequestMethodArgs<Method, MethodArgs<Paths, Method, Path, Init>>
  ): EffectMethodResult<Paths, Path, Method>
}

export interface EffectClient<Paths extends object> {
  request: EffectClientRequestMethod<Paths>
  GET: EffectClientMethod<Paths, "get">
  PUT: EffectClientMethod<Paths, "put">
  POST: EffectClientMethod<Paths, "post">
  DELETE: EffectClientMethod<Paths, "delete">
  OPTIONS: EffectClientMethod<Paths, "options">
  HEAD: EffectClientMethod<Paths, "head">
  PATCH: EffectClientMethod<Paths, "patch">
  TRACE: EffectClientMethod<Paths, "trace">
  use(...middleware: Array<Middleware>): void
  eject(...middleware: Array<Middleware>): void
}

export type ClientEffect<Paths extends object> = EffectClient<Paths>
