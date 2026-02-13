import { Effect } from "effect"

import { toError } from "./create-client-response.js"
import type { AsyncValue, MergedOptions, Middleware, MiddlewareRequestParams, Thenable } from "./create-client-types.js"

const isThenable = <T>(value: unknown): value is Thenable<T> => (
  typeof value === "object"
  && value !== null
  && "then" in value
  && typeof Reflect.get(value, "then") === "function"
)

export const toPromiseEffect = <T>(value: AsyncValue<T>): Effect.Effect<T, Error> => (
  isThenable(value)
    ? Effect.async<T, Error>((resume) => {
      value.then(
        (result) => {
          resume(Effect.succeed(result))
        },
        (error) => {
          resume(Effect.fail(toError(error)))
        }
      )
    })
    : Effect.succeed(value)
)

export type MiddlewareContext = {
  schemaPath: string
  params: MiddlewareRequestParams
  options: MergedOptions
  id: string
  middleware: Array<Middleware>
}

const reverseMiddleware = (middleware: Array<Middleware>): Array<Middleware> => {
  const output: Array<Middleware> = []

  for (let index = middleware.length - 1; index >= 0; index -= 1) {
    const item = middleware[index]
    if (item !== undefined) {
      output.push(item)
    }
  }

  return output
}

type RequestMiddlewareResult = {
  request: Request
  response?: Response
}

const createMiddlewareParams = (
  request: Request,
  context: MiddlewareContext
): {
  request: Request
  schemaPath: string
  params: MiddlewareRequestParams
  options: MergedOptions
  id: string
} => ({
  request,
  schemaPath: context.schemaPath,
  params: context.params,
  options: context.options,
  id: context.id
})

export const applyRequestMiddleware = (
  request: Request,
  context: MiddlewareContext
): Effect.Effect<RequestMiddlewareResult, Error> =>
  Effect.gen(function*() {
    let nextRequest = request

    for (const item of context.middleware) {
      if (typeof item.onRequest !== "function") {
        continue
      }

      const result = yield* toPromiseEffect(item.onRequest(createMiddlewareParams(nextRequest, context)))

      if (result === undefined) {
        continue
      }

      if (result instanceof Request) {
        nextRequest = result
        continue
      }

      if (result instanceof Response) {
        return { request: nextRequest, response: result }
      }

      return yield* Effect.fail(
        new Error("onRequest: must return new Request() or Response() when modifying the request")
      )
    }

    return { request: nextRequest }
  })

export const applyResponseMiddleware = (
  request: Request,
  response: Response,
  context: MiddlewareContext
): Effect.Effect<Response, Error> =>
  Effect.gen(function*() {
    let nextResponse = response

    for (const item of reverseMiddleware(context.middleware)) {
      if (typeof item.onResponse !== "function") {
        continue
      }

      const result = yield* toPromiseEffect(item.onResponse({
        ...createMiddlewareParams(request, context),
        response: nextResponse
      }))

      if (result === undefined) {
        continue
      }

      if (!(result instanceof Response)) {
        return yield* Effect.fail(
          new Error("onResponse: must return new Response() when modifying the response")
        )
      }

      nextResponse = result
    }

    return nextResponse
  })

const normalizeErrorResult = (
  result: Response | Error | undefined
): Effect.Effect<Response | Error | undefined, Error> => {
  if (result === undefined || result instanceof Response || result instanceof Error) {
    return Effect.succeed(result)
  }

  return Effect.fail(new Error("onError: must return new Response() or instance of Error"))
}

export const applyErrorMiddleware = (
  request: Request,
  fetchError: Error,
  context: MiddlewareContext
): Effect.Effect<Response, Error> =>
  Effect.gen(function*() {
    let nextError: Error = fetchError

    for (const item of reverseMiddleware(context.middleware)) {
      if (typeof item.onError !== "function") {
        continue
      }

      const rawResult = yield* toPromiseEffect(item.onError({
        ...createMiddlewareParams(request, context),
        error: nextError
      }))

      const result = yield* normalizeErrorResult(rawResult)
      if (result instanceof Response) {
        return result
      }

      if (result instanceof Error) {
        nextError = result
      }
    }

    return yield* Effect.fail(nextError)
  })
