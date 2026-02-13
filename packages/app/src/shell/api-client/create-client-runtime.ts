import { Effect } from "effect"

import { applyErrorMiddleware, applyRequestMiddleware, applyResponseMiddleware } from "./create-client-middleware.js"
import { createResponseEnvelope } from "./create-client-response.js"
import {
  createMergedOptions,
  invokeFetch,
  randomID,
  resolveQuerySerializer,
  serializeBody,
  setCustomRequestFields,
  supportsRequestInitExt,
  toHeaderOverrides
} from "./create-client-runtime-helpers.js"
import type { SerializedBody } from "./create-client-runtime-helpers.js"
import type {
  BaseRuntimeConfig,
  PreparedRequest,
  RuntimeClient,
  RuntimeFetchOptions,
  RuntimeFetchResponse
} from "./create-client-runtime-types.js"
import type {
  BodySerializer,
  ClientOptions,
  Middleware,
  MiddlewareRequestParams,
  ParseAs,
  PathSerializer,
  QuerySerializer
} from "./create-client-types.js"
import {
  createFinalURL,
  defaultBodySerializer,
  defaultPathSerializer,
  mergeHeaders,
  removeTrailingSlash
} from "./openapi-compat-utils.js"

type ResolvedFetchConfig = {
  Request: typeof Request
  fetch: NonNullable<ClientOptions["fetch"]>
  parseAs: ParseAs
  params: MiddlewareRequestParams
  body: BodyInit | object | undefined
  bodySerializer: BodySerializer<unknown>
  headers: ClientOptions["headers"]
  init: Record<string, unknown>
  finalBaseUrl: string
  pathSerializer: PathSerializer
  querySerializer: QuerySerializer<unknown>
  middleware: Array<Middleware>
}

const resolveBaseUrl = (baseUrl: string, localBaseUrl: string | undefined): string => (
  localBaseUrl ? removeTrailingSlash(localBaseUrl) : baseUrl
)

const resolveBodySerializer = (
  globalBodySerializer: BodySerializer<unknown> | undefined,
  requestBodySerializer: BodySerializer<unknown> | undefined
): BodySerializer<unknown> => (
  requestBodySerializer ?? globalBodySerializer ?? defaultBodySerializer
)

const resolvePathSerializer = (
  globalPathSerializer: PathSerializer | undefined,
  requestPathSerializer: PathSerializer | undefined
): PathSerializer => (
  requestPathSerializer ?? globalPathSerializer ?? defaultPathSerializer
)

const joinMiddleware = (
  globalMiddlewares: Array<Middleware>,
  requestMiddlewares: Array<Middleware>
): Array<Middleware> => [...globalMiddlewares, ...requestMiddlewares]

const resolveFetchConfig = (
  config: BaseRuntimeConfig,
  fetchOptions?: RuntimeFetchOptions
): ResolvedFetchConfig => {
  const {
    Request = config.Request,
    baseUrl: localBaseUrl,
    body,
    bodySerializer: requestBodySerializer,
    fetch = config.fetch,
    headers,
    middleware: requestMiddlewares = [],
    params = {},
    parseAs = "json",
    pathSerializer: requestPathSerializer,
    querySerializer: requestQuerySerializer,
    ...init
  } = fetchOptions ?? {}

  return {
    Request,
    fetch,
    parseAs,
    params,
    body,
    bodySerializer: resolveBodySerializer(config.bodySerializer, requestBodySerializer),
    headers,
    init,
    finalBaseUrl: resolveBaseUrl(config.baseUrl, localBaseUrl),
    pathSerializer: resolvePathSerializer(config.pathSerializer, requestPathSerializer),
    querySerializer: resolveQuerySerializer(config.querySerializer, requestQuerySerializer),
    middleware: joinMiddleware(config.globalMiddlewares, requestMiddlewares)
  }
}

type ResolvedHeaders = {
  serializedBody: SerializedBody
  finalHeaders: Headers
}

const resolveHeaders = (
  config: BaseRuntimeConfig,
  resolved: ResolvedFetchConfig
): ResolvedHeaders => {
  const headerOverrides = toHeaderOverrides(resolved.params.header)
  const serializedBody = serializeBody(
    resolved.body,
    resolved.bodySerializer,
    mergeHeaders(config.headers, resolved.headers, headerOverrides)
  )

  const finalHeaders = mergeHeaders(
    !serializedBody.hasBody || serializedBody.value instanceof FormData
      ? {}
      : { "Content-Type": "application/json" },
    config.headers,
    resolved.headers,
    headerOverrides
  )

  return { serializedBody, finalHeaders }
}

const createRequest = (
  config: BaseRuntimeConfig,
  schemaPath: string,
  resolved: ResolvedFetchConfig,
  resolvedHeaders: ResolvedHeaders
): Request => {
  const requestInit: RequestInit = {
    redirect: "follow",
    ...config.baseOptions,
    ...resolved.init,
    ...(resolvedHeaders.serializedBody.hasBody
      ? { body: resolvedHeaders.serializedBody.value }
      : {}),
    headers: resolvedHeaders.finalHeaders
  }

  const request = new resolved.Request(
    createFinalURL(schemaPath, {
      baseUrl: resolved.finalBaseUrl,
      params: resolved.params,
      querySerializer: resolved.querySerializer,
      pathSerializer: resolved.pathSerializer
    }),
    requestInit
  )

  setCustomRequestFields(request, resolved.init)
  return request
}

const createPreparedContext = (
  schemaPath: string,
  resolved: ResolvedFetchConfig
): PreparedRequest["context"] => ({
  schemaPath,
  params: resolved.params,
  id: randomID(),
  options: createMergedOptions({
    baseUrl: resolved.finalBaseUrl,
    parseAs: resolved.parseAs,
    querySerializer: resolved.querySerializer,
    bodySerializer: resolved.bodySerializer,
    pathSerializer: resolved.pathSerializer,
    fetch: resolved.fetch
  }),
  middleware: resolved.middleware
})

const prepareRequest = (
  config: BaseRuntimeConfig,
  schemaPath: string,
  fetchOptions?: RuntimeFetchOptions
): PreparedRequest => {
  const resolved = resolveFetchConfig(config, fetchOptions)
  const requestHeaders = resolveHeaders(config, resolved)
  const request = createRequest(config, schemaPath, resolved, requestHeaders)

  return {
    request,
    fetch: resolved.fetch,
    parseAs: resolved.parseAs,
    middleware: resolved.middleware,
    requestInitExt: config.requestInitExt,
    context: createPreparedContext(schemaPath, resolved)
  }
}

const executeFetch = (
  prepared: PreparedRequest
): Effect.Effect<{ request: Request; response: Response }, Error> => {
  if (prepared.middleware.length === 0) {
    return invokeFetch(prepared.fetch, prepared.request, prepared.requestInitExt).pipe(
      Effect.map((response) => ({ request: prepared.request, response }))
    )
  }

  return Effect.gen(function*() {
    const requestPhase = yield* applyRequestMiddleware(prepared.request, prepared.context)
    const request = requestPhase.request

    const response = requestPhase.response ?? (
      yield* Effect.catchAll(
        invokeFetch(prepared.fetch, request, prepared.requestInitExt),
        (fetchError) => applyErrorMiddleware(request, fetchError, prepared.context)
      )
    )

    const responseAfterMiddleware = yield* applyResponseMiddleware(request, response, prepared.context)
    return { request, response: responseAfterMiddleware }
  })
}

const createCoreFetch = (config: BaseRuntimeConfig) =>
(
  schemaPath: string,
  fetchOptions?: RuntimeFetchOptions
): Effect.Effect<RuntimeFetchResponse, Error> =>
  Effect.gen(function*() {
    const prepared = prepareRequest(config, schemaPath, fetchOptions)
    const execution = yield* executeFetch(prepared)
    return yield* createResponseEnvelope(execution.request, execution.response, prepared.parseAs)
  })

const hasMiddlewareHook = (value: Middleware): boolean => (
  "onRequest" in value || "onResponse" in value || "onError" in value
)

const createBaseRuntimeConfig = (
  clientOptions: ClientOptions | undefined,
  globalMiddlewares: Array<Middleware>
): BaseRuntimeConfig => {
  const {
    Request = globalThis.Request,
    baseUrl: rawBaseUrl = "",
    bodySerializer,
    fetch = globalThis.fetch,
    headers,
    pathSerializer,
    querySerializer,
    requestInitExt: rawRequestInitExt,
    ...baseOptions
  } = { ...clientOptions }

  return {
    Request,
    baseUrl: removeTrailingSlash(rawBaseUrl),
    bodySerializer,
    fetch,
    headers,
    pathSerializer,
    querySerializer,
    requestInitExt: supportsRequestInitExt() ? rawRequestInitExt : undefined,
    baseOptions,
    globalMiddlewares
  }
}

const createClientMethods = (
  coreFetch: ReturnType<typeof createCoreFetch>,
  globalMiddlewares: Array<Middleware>
): RuntimeClient => ({
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

export const createRuntimeClient = (clientOptions?: ClientOptions): RuntimeClient => {
  const globalMiddlewares: Array<Middleware> = []
  const config = createBaseRuntimeConfig(clientOptions, globalMiddlewares)
  const coreFetch = createCoreFetch(config)
  return createClientMethods(coreFetch, globalMiddlewares)
}
