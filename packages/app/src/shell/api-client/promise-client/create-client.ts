// CHANGE: Promise-compatible client implemented via Effect internals
// WHY: Preserve openapi-fetch API shape while keeping all effect handling explicit
// SOURCE: behavior-compatible with openapi-fetch@0.15.x (MIT)
// PURITY: SHELL
// COMPLEXITY: O(1) setup + O(n) middleware per request

import { Effect } from "effect"
import type { HttpMethod, MediaType } from "openapi-typescript-helpers"

import {
  buildMergedOptions,
  type CoreFetchOptions,
  type MiddlewareContext,
  randomID,
  resolveClientOptions,
  type ResolvedClientOptions,
  type ResolvedFetchOptions,
  resolveFetchOptions
} from "./client-kernel.js"
import { runOnErrorMiddlewares, runOnRequestMiddlewares, runOnResponseMiddlewares } from "./client-middleware.js"
import { buildRequest } from "./client-request.js"
import { toParsedFetchResponse } from "./client-response.js"
import type { Client, ClientMethod, ClientOptions, ClientRequestMethod, FetchResponse, Middleware } from "./types.js"

const identity = <A>(value: A): A => value

const toObjectRecord = (value: unknown): Record<string, unknown> => {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

const mergeMiddlewares = (
  globalMiddlewares: ReadonlyArray<Middleware>,
  localMiddlewares: ReadonlyArray<Middleware>
): Array<Middleware> => {
  return [...globalMiddlewares, ...localMiddlewares]
}

type ErrorRecoveryInput = {
  middlewares: ReadonlyArray<Middleware>
  context: MiddlewareContext
  request: Request
  error: unknown
}

const recoverFromFetchError = (input: ErrorRecoveryInput): Effect.Effect<Response, unknown> => {
  return runOnErrorMiddlewares(input.middlewares, input.context, input.request, input.error).pipe(
    Effect.flatMap((handled) => {
      return "response" in handled ? Effect.succeed(handled.response) : Effect.fail(handled.error)
    })
  )
}

type FetchExecutionInput = {
  middlewares: ReadonlyArray<Middleware>
  context: MiddlewareContext
  resolvedFetch: ResolvedFetchOptions
  request: Request
  shortCircuitResponse: Response | undefined
  requestInitExt: Record<string, unknown> | undefined
}

const resolveFetchResponse = (input: FetchExecutionInput): Effect.Effect<Response, unknown> => {
  if (input.shortCircuitResponse !== undefined) {
    return Effect.succeed(input.shortCircuitResponse)
  }

  return Effect.matchEffect(
    Effect.tryPromise({
      try: () => input.resolvedFetch.fetch(input.request, input.requestInitExt),
      catch: identity
    }),
    {
      onFailure: (error) =>
        recoverFromFetchError({
          middlewares: input.middlewares,
          context: input.context,
          request: input.request,
          error
        }),
      onSuccess: Effect.succeed
    }
  )
}

const resolveFinalResponse = (
  middlewares: ReadonlyArray<Middleware>,
  context: MiddlewareContext,
  request: Request,
  fetchResponse: Response,
  shortCircuitResponse: Response | undefined
): Effect.Effect<Response, unknown> => {
  return shortCircuitResponse === undefined
    ? runOnResponseMiddlewares(middlewares, context, request, fetchResponse)
    : Effect.succeed(fetchResponse)
}

const createCoreFetchEffect = <Media extends MediaType>(
  resolvedClient: ResolvedClientOptions,
  globalMiddlewares: ReadonlyArray<Middleware>
) =>
<Responses extends Record<string | number, unknown>, Options>(
  schemaPath: string,
  fetchOptions?: CoreFetchOptions<unknown>
): Effect.Effect<FetchResponse<Responses, Options, Media>, unknown> =>
  Effect.gen(function*() {
    const resolvedFetch = resolveFetchOptions(resolvedClient, fetchOptions)
    const context: MiddlewareContext = {
      schemaPath,
      params: resolvedFetch.params,
      options: buildMergedOptions(resolvedFetch),
      id: randomID()
    }

    const middlewares = mergeMiddlewares(globalMiddlewares, resolvedFetch.middleware)
    const request = buildRequest(resolvedClient, resolvedFetch, schemaPath)
    const onRequest = yield* runOnRequestMiddlewares(middlewares, context, request)

    const fetchResponse = yield* resolveFetchResponse({
      middlewares,
      context,
      resolvedFetch,
      request: onRequest.request,
      shortCircuitResponse: onRequest.response,
      requestInitExt: resolvedClient.requestInitExt
    })

    const finalResponse = yield* resolveFinalResponse(
      middlewares,
      context,
      onRequest.request,
      fetchResponse,
      onRequest.response
    )

    return yield* toParsedFetchResponse<Responses, Options, Media>(
      finalResponse,
      onRequest.request,
      resolvedFetch.parseAs
    )
  })

type GenericFetchResponse<Media extends MediaType> = FetchResponse<Record<string | number, unknown>, unknown, Media>

const createMethodCaller = <Paths extends object, Media extends MediaType, Method extends HttpMethod>(
  callMethod: (
    method: HttpMethod,
    path: keyof Paths & string,
    init: ReadonlyArray<unknown>
  ) => globalThis.Promise<GenericFetchResponse<Media>>,
  method: Method
): ClientMethod<Paths, Method, Media> => {
  return ((url, ...init) => {
    return callMethod(method, url as keyof Paths & string, init as ReadonlyArray<unknown>)
  }) as ClientMethod<Paths, Method, Media>
}

const createCallMethod = <Media extends MediaType>(
  coreFetchEffect: <Responses extends Record<string | number, unknown>, Options>(
    schemaPath: string,
    fetchOptions?: CoreFetchOptions<unknown>
  ) => Effect.Effect<FetchResponse<Responses, Options, Media>, unknown>
) =>
(
  method: HttpMethod,
  path: string,
  init: ReadonlyArray<unknown>
): globalThis.Promise<GenericFetchResponse<Media>> => {
  const fetchOptions = {
    ...toObjectRecord(init[0]),
    method: method.toUpperCase()
  }

  return Effect.runPromise(
    coreFetchEffect<Record<string | number, unknown>, unknown>(
      path,
      fetchOptions as CoreFetchOptions<unknown>
    )
  )
}

const createMiddlewareControls = (globalMiddlewares: Array<Middleware>): Pick<Client<object>, "use" | "eject"> => {
  const use = (...middleware: ReadonlyArray<Middleware>): void => {
    globalMiddlewares.push(...middleware)
  }

  const eject = (...middleware: ReadonlyArray<Middleware>): void => {
    for (const item of middleware) {
      const index = globalMiddlewares.indexOf(item)
      if (index !== -1) {
        globalMiddlewares.splice(index, 1)
      }
    }
  }

  return { use, eject }
}

export const createClient = <Paths extends object, Media extends MediaType = MediaType>(
  clientOptions?: ClientOptions
): Client<Paths, Media> => {
  const resolvedClient = resolveClientOptions(clientOptions)
  const globalMiddlewares: Array<Middleware> = []
  const coreFetchEffect = createCoreFetchEffect<Media>(resolvedClient, globalMiddlewares)
  const callMethod = createCallMethod<Media>(coreFetchEffect)
  const controls = createMiddlewareControls(globalMiddlewares)

  const request = ((method, path, ...init) => {
    return callMethod(method, path as keyof Paths & string, init as ReadonlyArray<unknown>)
  }) as ClientRequestMethod<Paths, Media>

  return {
    request,
    GET: createMethodCaller(callMethod, "get"),
    PUT: createMethodCaller(callMethod, "put"),
    POST: createMethodCaller(callMethod, "post"),
    DELETE: createMethodCaller(callMethod, "delete"),
    OPTIONS: createMethodCaller(callMethod, "options"),
    HEAD: createMethodCaller(callMethod, "head"),
    PATCH: createMethodCaller(callMethod, "patch"),
    TRACE: createMethodCaller(callMethod, "trace"),
    use: controls.use,
    eject: controls.eject
  }
}

export default createClient
