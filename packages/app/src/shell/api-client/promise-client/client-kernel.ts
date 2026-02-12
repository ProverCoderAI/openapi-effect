// CHANGE: Promise-client option resolution helpers
// WHY: Keep create-client small and lint-clean while preserving openapi-fetch-compatible behavior
// SOURCE: n/a
// PURITY: SHELL
// COMPLEXITY: O(n)

import { createQuerySerializer, defaultBodySerializer, removeTrailingSlash } from "./serialize.js"
import type {
  BodySerializer,
  ClientOptions,
  HeadersOptions,
  MergedOptions,
  Middleware,
  MiddlewareCallbackParams,
  ParseAs,
  QuerySerializer,
  QuerySerializerOptions,
  RequestOptions
} from "./types.js"

export type FetchLike = (
  request: Request,
  requestInitExt?: Record<string, unknown>
) => globalThis.Promise<Response>

export type CoreFetchOptions<O> = RequestOptions<O> & Omit<RequestInit, "body" | "headers">

type GenericQuerySerializer = QuerySerializer<Record<string, unknown>>

type RequestParams = MiddlewareCallbackParams["params"]

export type ResolvedClientOptions = {
  baseUrl: string
  RequestCtor: typeof Request
  baseFetch: FetchLike
  globalQuerySerializer: GenericQuerySerializer | QuerySerializerOptions | undefined
  globalBodySerializer: BodySerializer<unknown> | undefined
  baseHeaders: HeadersOptions | undefined
  requestInitExt: Record<string, unknown> | undefined
  baseInit: RequestInit
}

export type ResolvedFetchOptions = {
  baseUrl: string
  RequestCtor: typeof Request
  fetch: FetchLike
  params: RequestParams
  parseAs: ParseAs
  querySerializer: GenericQuerySerializer
  bodySerializer: BodySerializer<unknown>
  body: unknown
  middleware: ReadonlyArray<Middleware>
  headers: HeadersOptions | undefined
  requestInit: RequestInit
  passthroughInit: Record<string, unknown>
}

export type MiddlewareContext = {
  schemaPath: string
  params: RequestParams
  options: MergedOptions<Record<string, unknown>>
  id: string
}

const clientOptionKeys = new Set<string>([
  "baseUrl",
  "Request",
  "fetch",
  "querySerializer",
  "bodySerializer",
  "headers",
  "requestInitExt"
])

const fetchOptionKeys = new Set<string>([
  "baseUrl",
  "fetch",
  "Request",
  "headers",
  "params",
  "parseAs",
  "querySerializer",
  "bodySerializer",
  "body",
  "middleware"
])

const toRecord = (value: object | undefined): Record<string, unknown> => {
  return value === undefined ? {} : (value as Record<string, unknown>)
}

const omitKeys = (
  source: Record<string, unknown>,
  keysToDrop: ReadonlySet<string>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    if (!keysToDrop.has(key)) {
      result[key] = value
    }
  }

  return result
}

const supportsRequestInitExt = (): boolean => {
  if (typeof process !== "object") {
    return false
  }

  const majorPart = process.versions.node.split(".")[0] ?? "0"
  const major = Number.parseInt(majorPart, 10)
  return major >= 18 && typeof process.versions["undici"] === "string"
}

const adaptQuerySerializer = <T>(serializer: QuerySerializer<T>): GenericQuerySerializer => {
  const narrowed = serializer as QuerySerializer<Record<string, unknown>>
  return (query) => narrowed(query)
}

const isQuerySerializerFn = <T>(
  serializer: QuerySerializer<T> | QuerySerializerOptions | undefined
): serializer is QuerySerializer<T> => {
  return typeof serializer === "function"
}

const isQuerySerializerOptions = (
  serializer: GenericQuerySerializer | QuerySerializerOptions | undefined
): serializer is QuerySerializerOptions => {
  return typeof serializer === "object"
}

const resolveQuerySerializer = (
  globalSerializer: GenericQuerySerializer | QuerySerializerOptions | undefined,
  localSerializer: QuerySerializer<unknown> | QuerySerializerOptions | undefined
): GenericQuerySerializer => {
  if (isQuerySerializerFn(localSerializer)) {
    return adaptQuerySerializer(localSerializer)
  }

  if (localSerializer !== undefined) {
    const globalOptions = isQuerySerializerOptions(globalSerializer) ? globalSerializer : undefined
    return createQuerySerializer({ ...globalOptions, ...localSerializer })
  }

  if (isQuerySerializerFn(globalSerializer)) {
    return globalSerializer
  }

  return createQuerySerializer(globalSerializer)
}

const resolveBodySerializer = (
  globalSerializer: BodySerializer<unknown> | undefined,
  localSerializer: BodySerializer<unknown> | undefined
): BodySerializer<unknown> => {
  if (localSerializer !== undefined) {
    return localSerializer
  }

  if (globalSerializer !== undefined) {
    return globalSerializer
  }

  return defaultBodySerializer
}

const defaultFetch: FetchLike = (request, ext) => {
  return globalThis.fetch(request, ext as RequestInit | undefined)
}

const resolveRequestFetch = (
  baseFetch: FetchLike,
  fetchOverride: ClientOptions["fetch"] | undefined
): FetchLike => {
  if (fetchOverride !== undefined) {
    return (request) => fetchOverride(request)
  }

  return baseFetch
}

const resolveBaseUrl = (
  globalBaseUrl: string,
  localBaseUrl: string | undefined
): string => {
  return localBaseUrl === undefined ? globalBaseUrl : removeTrailingSlash(localBaseUrl)
}

const resolveRequestInit = (
  baseInit: RequestInit,
  requestInitRecord: Record<string, unknown>
): RequestInit => {
  return {
    redirect: "follow",
    ...baseInit,
    ...(requestInitRecord as RequestInit)
  }
}

const resolveClientFetch = (fetchOverride: ClientOptions["fetch"] | undefined): FetchLike => {
  return resolveRequestFetch(defaultFetch, fetchOverride)
}

const resolveParams = (value: unknown): RequestParams => {
  return typeof value === "object" && value !== null ? (value as RequestParams) : {}
}

type NormalizedFetchOptions = {
  baseUrl: string | undefined
  fetch: ClientOptions["fetch"] | undefined
  params: unknown
  parseAs: ParseAs
  querySerializer: QuerySerializer<unknown> | QuerySerializerOptions | undefined
  bodySerializer: BodySerializer<unknown> | undefined
  body: unknown
  middleware: ReadonlyArray<Middleware>
  headers: HeadersOptions | undefined
}

const normalizeFetchOptions = (
  fetchOptions?: CoreFetchOptions<unknown>
): NormalizedFetchOptions => {
  const options = fetchOptions ?? {}

  return {
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    params: options.params,
    parseAs: options.parseAs ?? "json",
    querySerializer: options.querySerializer,
    bodySerializer: options.bodySerializer,
    body: options.body,
    middleware: options.middleware ?? [],
    headers: options.headers
  }
}

export const resolveClientOptions = (clientOptions?: ClientOptions): ResolvedClientOptions => {
  const options = clientOptions ?? {}

  return {
    baseUrl: removeTrailingSlash(options.baseUrl ?? ""),
    RequestCtor: options.Request ?? globalThis.Request,
    baseFetch: resolveClientFetch(options.fetch),
    globalQuerySerializer: options.querySerializer,
    globalBodySerializer: options.bodySerializer,
    baseHeaders: options.headers,
    requestInitExt: supportsRequestInitExt() ? options.requestInitExt : undefined,
    baseInit: omitKeys(toRecord(options), clientOptionKeys) as RequestInit
  }
}

export const resolveFetchOptions = (
  client: ResolvedClientOptions,
  fetchOptions?: CoreFetchOptions<unknown>
): ResolvedFetchOptions => {
  const normalized = normalizeFetchOptions(fetchOptions)
  const requestInitRecord = omitKeys(toRecord(fetchOptions), fetchOptionKeys)

  return {
    baseUrl: resolveBaseUrl(client.baseUrl, normalized.baseUrl),
    RequestCtor: client.RequestCtor,
    fetch: resolveRequestFetch(client.baseFetch, normalized.fetch),
    params: resolveParams(normalized.params),
    parseAs: normalized.parseAs,
    querySerializer: resolveQuerySerializer(client.globalQuerySerializer, normalized.querySerializer),
    bodySerializer: resolveBodySerializer(client.globalBodySerializer, normalized.bodySerializer),
    body: normalized.body,
    middleware: normalized.middleware,
    headers: normalized.headers,
    requestInit: resolveRequestInit(client.baseInit, requestInitRecord),
    passthroughInit: requestInitRecord
  }
}

export const buildMergedOptions = (resolved: ResolvedFetchOptions): MergedOptions<Record<string, unknown>> => {
  return Object.freeze({
    baseUrl: resolved.baseUrl,
    fetch: globalThis.fetch,
    parseAs: resolved.parseAs,
    querySerializer: resolved.querySerializer,
    bodySerializer: resolved.bodySerializer
  })
}

export const randomID = (): string => {
  if (typeof crypto === "object" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 9)
  }

  return Date.now().toString(36)
}
