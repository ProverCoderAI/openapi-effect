// CHANGE: Middleware execution pipeline for promise-compatible client
// WHY: Centralize request/response/error middleware behavior with typed Effect composition
// SOURCE: n/a
// PURITY: SHELL
// COMPLEXITY: O(n)

import { Effect } from "effect"

import type { MiddlewareContext } from "./client-kernel.js"
import type { Middleware } from "./types.js"

const identity = <A>(value: A): A => value

const fromMaybePromise = <A>(thunk: () => A | PromiseLike<A>): Effect.Effect<A, unknown> => {
  return Effect.tryPromise({
    try: () => globalThis.Promise.resolve(thunk()),
    catch: identity
  })
}

const hasOnRequest = (middleware: Middleware): middleware is Middleware & {
  onRequest: NonNullable<Middleware["onRequest"]>
} => {
  return "onRequest" in middleware && typeof middleware.onRequest === "function"
}

const hasOnResponse = (middleware: Middleware): middleware is Middleware & {
  onResponse: NonNullable<Middleware["onResponse"]>
} => {
  return "onResponse" in middleware && typeof middleware.onResponse === "function"
}

const hasOnError = (middleware: Middleware): middleware is Middleware & {
  onError: NonNullable<Middleware["onError"]>
} => {
  return "onError" in middleware && typeof middleware.onError === "function"
}

export type RequestMiddlewareResult = {
  request: Request
  response: Response | undefined
}

export type ErrorMiddlewareResult =
  | { response: Response }
  | { error: unknown }

const reversedIndexSequence = (size: number): Array<number> => {
  const indexes: Array<number> = []
  for (let index = size - 1; index >= 0; index -= 1) {
    indexes.push(index)
  }
  return indexes
}

const reverseMiddlewares = (middlewares: ReadonlyArray<Middleware>): Array<Middleware> => {
  const reversed: Array<Middleware> = []

  for (const index of reversedIndexSequence(middlewares.length)) {
    const middleware = middlewares[index]
    if (middleware !== undefined) {
      reversed.push(middleware)
    }
  }

  return reversed
}

const buildMiddlewareParams = (context: MiddlewareContext, request: Request) => {
  return {
    request,
    schemaPath: context.schemaPath,
    params: context.params,
    options: context.options,
    id: context.id
  }
}

export const runOnRequestMiddlewares = (
  middlewares: ReadonlyArray<Middleware>,
  context: MiddlewareContext,
  initialRequest: Request
): Effect.Effect<RequestMiddlewareResult, unknown> =>
  Effect.gen(function*() {
    let request = initialRequest

    for (const middleware of middlewares) {
      if (!hasOnRequest(middleware)) {
        continue
      }

      const result = yield* fromMaybePromise(() => middleware.onRequest(buildMiddlewareParams(context, request)))

      if (result instanceof Request) {
        request = result
        continue
      }

      if (result instanceof Response) {
        return { request, response: result }
      }
    }

    return { request, response: undefined }
  })

export const runOnErrorMiddlewares = (
  middlewares: ReadonlyArray<Middleware>,
  context: MiddlewareContext,
  request: Request,
  error: unknown
): Effect.Effect<ErrorMiddlewareResult, unknown> =>
  Effect.gen(function*() {
    let currentError = error

    for (const middleware of reverseMiddlewares(middlewares)) {
      if (!hasOnError(middleware)) {
        continue
      }

      const result = yield* fromMaybePromise(() =>
        middleware.onError({
          ...buildMiddlewareParams(context, request),
          error: currentError
        })
      )

      if (result instanceof Response) {
        return { response: result }
      }

      if (result instanceof Error) {
        currentError = result
      }
    }

    return { error: currentError }
  })

export const runOnResponseMiddlewares = (
  middlewares: ReadonlyArray<Middleware>,
  context: MiddlewareContext,
  request: Request,
  initialResponse: Response
): Effect.Effect<Response, unknown> =>
  Effect.gen(function*() {
    let response = initialResponse

    for (const middleware of reverseMiddlewares(middlewares)) {
      if (!hasOnResponse(middleware)) {
        continue
      }

      const result = yield* fromMaybePromise(() =>
        middleware.onResponse({
          ...buildMiddlewareParams(context, request),
          response
        })
      )

      if (result instanceof Response) {
        response = result
      }
    }

    return response
  })
