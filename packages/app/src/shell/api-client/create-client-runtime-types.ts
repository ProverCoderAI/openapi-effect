import type { Effect } from "effect"

import type { BoundaryError } from "../../core/api-client/strict-types.js"
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

export type RuntimeApiSuccess = {
  readonly status: number
  readonly contentType: string
  readonly body: unknown
}

export type RuntimeHttpError = RuntimeApiSuccess & {
  readonly _tag: "HttpError"
}

export type RuntimeEffectFailure = RuntimeHttpError | BoundaryError

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

export type RuntimeClientFor<Success, Failure> = {
  request: (method: string, url: string, init?: RuntimeFetchOptions) => Effect.Effect<Success, Failure>
  GET: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<Success, Failure>
  PUT: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<Success, Failure>
  POST: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<Success, Failure>
  DELETE: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<Success, Failure>
  OPTIONS: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<Success, Failure>
  HEAD: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<Success, Failure>
  PATCH: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<Success, Failure>
  TRACE: (url: string, init?: RuntimeFetchOptions) => Effect.Effect<Success, Failure>
  use: (...middleware: Array<Middleware>) => void
  eject: (...middleware: Array<Middleware>) => void
}

export type RuntimeClient = RuntimeClientFor<RuntimeFetchResponse, Error>
export type RuntimeEffectClient = RuntimeClientFor<RuntimeApiSuccess, RuntimeEffectFailure>

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
