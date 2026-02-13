import type { Effect } from "effect"

import type { MiddlewareContext } from "./create-client-middleware.js"
import type {
  BodySerializer,
  ClientOptions,
  HeadersOptions,
  Middleware,
  MiddlewareRequestParams,
  ParseAs,
  PathSerializer,
  QuerySerializer,
  QuerySerializerOptions
} from "./create-client-types.js"

export type RuntimeFetchResponse = {
  data?: unknown
  error?: unknown
  response: Response
}

export type RuntimeFetchOptions = Omit<RequestInit, "body" | "headers" | "method"> & {
  baseUrl?: string
  fetch?: NonNullable<ClientOptions["fetch"]>
  Request?: ClientOptions["Request"]
  headers?: HeadersOptions
  params?: MiddlewareRequestParams
  parseAs?: ParseAs
  querySerializer?: QuerySerializer<unknown> | QuerySerializerOptions
  pathSerializer?: PathSerializer
  bodySerializer?: BodySerializer<unknown>
  body?: BodyInit | object
  middleware?: Array<Middleware>
  method?: string
  [key: string]: unknown
}

export type RuntimeClient = {
  request: (method: string, url: string, init?: RuntimeFetchOptions) => Effect.Effect<RuntimeFetchResponse, Error>
  GET: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<RuntimeFetchResponse, Error>
  PUT: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<RuntimeFetchResponse, Error>
  POST: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<RuntimeFetchResponse, Error>
  DELETE: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<RuntimeFetchResponse, Error>
  OPTIONS: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<RuntimeFetchResponse, Error>
  HEAD: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<RuntimeFetchResponse, Error>
  PATCH: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<RuntimeFetchResponse, Error>
  TRACE: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<RuntimeFetchResponse, Error>
  use: (...middleware: Array<Middleware>) => void
  eject: (...middleware: Array<Middleware>) => void
}

export type HeaderValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>
  | null
  | undefined

export type HeaderRecord = Record<string, HeaderValue>

export type BaseRuntimeConfig = {
  Request: typeof Request
  baseUrl: string
  bodySerializer: BodySerializer<unknown> | undefined
  fetch: NonNullable<ClientOptions["fetch"]>
  pathSerializer: PathSerializer | undefined
  headers: HeadersOptions | undefined
  querySerializer: QuerySerializer<unknown> | QuerySerializerOptions | undefined
  requestInitExt: Record<string, unknown> | undefined
  baseOptions: Omit<
    ClientOptions,
    | "Request"
    | "baseUrl"
    | "bodySerializer"
    | "fetch"
    | "headers"
    | "querySerializer"
    | "pathSerializer"
    | "requestInitExt"
  >
  globalMiddlewares: Array<Middleware>
}

export type PreparedRequest = {
  request: Request
  fetch: NonNullable<ClientOptions["fetch"]>
  parseAs: ParseAs
  context: MiddlewareContext
  middleware: Array<Middleware>
  requestInitExt: Record<string, unknown> | undefined
}

export type FetchWithRequestInitExt = (
  input: Request,
  requestInitExt?: Record<string, unknown>
) => ReturnType<typeof globalThis.fetch>
