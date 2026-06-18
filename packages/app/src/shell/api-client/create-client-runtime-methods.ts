// CHANGE: Extract runtime method builder shared by envelope and Effect clients
// WHY: Keep runtime module below lint size limits without duplicating method implementations
// QUOTE(ТЗ): "input должен быть 1 в 1"
// REF: user-msg-openapi-effect-input-compat
// SOURCE: n/a
// PURITY: SHELL
// EFFECT: none - builds lazy Effect-returning methods
// INVARIANT: All HTTP verb methods preserve the same `(url, init?)` runtime shape
// COMPLEXITY: O(1)

import type { Effect } from "effect"

import type { RuntimeClientFor, RuntimeFetchOptions } from "./create-client-runtime-types.js"
import type { Middleware } from "./create-client-types.js"

export type CoreFetch<Success, Failure> = (
  schemaPath: string,
  fetchOptions?: RuntimeFetchOptions
) => Effect.Effect<Success, Failure>

const hasMiddlewareHook = (value: Middleware): boolean => (
  "onRequest" in value || "onResponse" in value || "onError" in value
)

export const createClientMethods = <Success, Failure>(
  coreFetch: CoreFetch<Success, Failure>,
  globalMiddlewares: Array<Middleware>
): RuntimeClientFor<Success, Failure> => ({
  request: (method, url, init) => coreFetch(url, { ...init, method: method.toUpperCase() }),
  GET: (url, init) => coreFetch(url, { ...init, method: "GET" }),
  PUT: (url, init) => coreFetch(url, { ...init, method: "PUT" }),
  POST: (url, init) => coreFetch(url, { ...init, method: "POST" }),
  DELETE: (url, init) => coreFetch(url, { ...init, method: "DELETE" }),
  OPTIONS: (url, init) => coreFetch(url, { ...init, method: "OPTIONS" }),
  HEAD: (url, init) => coreFetch(url, { ...init, method: "HEAD" }),
  PATCH: (url, init) => coreFetch(url, { ...init, method: "PATCH" }),
  TRACE: (url, init) => coreFetch(url, { ...init, method: "TRACE" }),
  use: (...middleware) => {
    for (const item of middleware) {
      if (!hasMiddlewareHook(item)) {
        throw new Error("Middleware must be an object with one of `onRequest()`, `onResponse() or `onError()`")
      }
      globalMiddlewares.push(item)
    }
  },
  eject: (...middleware) => {
    for (const item of middleware) {
      const index = globalMiddlewares.indexOf(item)
      if (index !== -1) {
        globalMiddlewares.splice(index, 1)
      }
    }
  }
})
