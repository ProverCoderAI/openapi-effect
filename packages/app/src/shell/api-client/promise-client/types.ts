// CHANGE: Promise-client compatibility types without dependency on openapi-fetch
// WHY: Keep drop-in public signatures while preserving repo lint constraints
// SOURCE: API shape is compatible with openapi-fetch@0.15.x (MIT)
// PURITY: CORE (types only)
// COMPLEXITY: O(1)

import type {
  ErrorResponse,
  HttpMethod,
  IsOperationRequestBodyOptional,
  MediaType,
  OperationRequestBodyContent,
  PathsWithMethod,
  RequiredKeysOf,
  ResponseObjectMap,
  SuccessResponse
} from "openapi-typescript-helpers"

/** Options for each client instance */
export interface ClientOptions extends Omit<RequestInit, "headers"> {
  /** set the common root URL for all API requests */
  baseUrl?: string
  /** custom fetch (defaults to globalThis.fetch) */
  fetch?: (input: Request) => globalThis.Promise<Response>
  /** custom Request (defaults to globalThis.Request) */
  Request?: typeof Request
  /** global querySerializer */
  querySerializer?: QuerySerializer<unknown> | QuerySerializerOptions
  /** global bodySerializer */
  bodySerializer?: BodySerializer<unknown>
  headers?: HeadersOptions
  /** RequestInit extension object to pass as 2nd argument to fetch when supported (defaults to undefined) */
  requestInitExt?: Record<string, unknown>
}

export type HeadersOptions =
  | Required<RequestInit>["headers"]
  | Record<
    string,
    | string
    | number
    | boolean
    | ReadonlyArray<string | number | boolean>
    | null
    | undefined
  >

export type QuerySerializer<T> = (
  query: T extends { parameters: Record<string, unknown> } ? NonNullable<T["parameters"]["query"]>
    : Record<string, unknown>
) => string

/** @see https://swagger.io/docs/specification/serialization/#query */
export type QuerySerializerOptions = {
  /** Set serialization for arrays. @see https://swagger.io/docs/specification/serialization/#query */
  array?: {
    /** default: "form" */
    style: "form" | "spaceDelimited" | "pipeDelimited"
    /** default: true */
    explode: boolean
  }
  /** Set serialization for objects. @see https://swagger.io/docs/specification/serialization/#query */
  object?: {
    /** default: "deepObject" */
    style: "form" | "deepObject"
    /** default: true */
    explode: boolean
  }
  /**
   * The `allowReserved` keyword specifies whether the reserved characters
   * `:/?#[]@!$&'()*+,;=` in parameter values are allowed to be sent as they
   * are, or should be percent-encoded. By default, allowReserved is `false`,
   * and reserved characters are percent-encoded.
   * @see https://swagger.io/docs/specification/serialization/#query
   */
  allowReserved?: boolean
}

export type BodySerializer<T> = (
  body: OperationRequestBodyContent<T>,
  headers?: Headers | Record<string, string>
) => unknown

type BodyType<T = unknown> = {
  json: T
  text: Awaited<ReturnType<Response["text"]>>
  blob: Awaited<ReturnType<Response["blob"]>>
  arrayBuffer: Awaited<ReturnType<Response["arrayBuffer"]>>
  stream: Response["body"]
}

export type ParseAs = keyof BodyType

export type ParseAsResponse<T, Options> = Options extends { parseAs: ParseAs } ? BodyType<T>[Options["parseAs"]]
  : T

export interface DefaultParamsOption {
  params?: {
    query?: Record<string, unknown>
  }
}

export type ParamsOption<T> = T extends { parameters: Record<string, unknown> }
  ? RequiredKeysOf<T["parameters"]> extends never ? { params?: T["parameters"] }
  : { params: T["parameters"] }
  : DefaultParamsOption

export type RequestBodyOption<T> = OperationRequestBodyContent<T> extends never ? { body?: never }
  : IsOperationRequestBodyOptional<T> extends true ? { body?: OperationRequestBodyContent<T> }
  : { body: OperationRequestBodyContent<T> }

export type RequestOptions<T> =
  & ParamsOption<T>
  & RequestBodyOption<T>
  & {
    baseUrl?: string
    querySerializer?: QuerySerializer<T> | QuerySerializerOptions
    bodySerializer?: BodySerializer<T>
    parseAs?: ParseAs
    fetch?: ClientOptions["fetch"]
    headers?: HeadersOptions
    middleware?: ReadonlyArray<Middleware>
  }

export type FetchOptions<T> = RequestOptions<T> & Omit<RequestInit, "body" | "headers">

export type FetchResponse<
  T extends Record<string | number, unknown>,
  Options,
  Media extends MediaType
> =
  | {
    data: ParseAsResponse<SuccessResponse<ResponseObjectMap<T>, Media>, Options>
    error?: never
    response: Response
  }
  | {
    data?: never
    error: ErrorResponse<ResponseObjectMap<T>, Media>
    response: Response
  }

export type MergedOptions<T = unknown> = {
  baseUrl: string
  parseAs: ParseAs
  querySerializer: QuerySerializer<T>
  bodySerializer: BodySerializer<T>
  fetch: typeof globalThis.fetch
}

export interface MiddlewareCallbackParams {
  /** Current Request object */
  request: Request
  /** The original OpenAPI schema path (including curly braces) */
  readonly schemaPath: string
  /** OpenAPI parameters as provided from openapi-fetch */
  readonly params: {
    query?: Record<string, unknown>
    header?: Record<string, unknown>
    path?: Record<string, unknown>
    cookie?: Record<string, unknown>
  }
  /** Unique ID for this request */
  readonly id: string
  /** createClient options (read-only) */
  readonly options: MergedOptions
}

export type MiddlewareOnRequest = (
  options: MiddlewareCallbackParams
) =>
  | Request
  | Response
  | undefined
  | globalThis.Promise<Request | Response | undefined>

export type MiddlewareOnResponse = (
  options: MiddlewareCallbackParams & { response: Response }
) =>
  | Response
  | undefined
  | globalThis.Promise<Response | undefined>

export type MiddlewareOnError = (
  options: MiddlewareCallbackParams & { error: unknown }
) =>
  | Response
  | Error
  | undefined
  | globalThis.Promise<undefined | Response | Error>

export type Middleware =
  | {
    onRequest: MiddlewareOnRequest
    onResponse?: MiddlewareOnResponse
    onError?: MiddlewareOnError
  }
  | {
    onRequest?: MiddlewareOnRequest
    onResponse: MiddlewareOnResponse
    onError?: MiddlewareOnError
  }
  | {
    onRequest?: MiddlewareOnRequest
    onResponse?: MiddlewareOnResponse
    onError: MiddlewareOnError
  }

type OperationForLocation<Params, Location extends PropertyKey> = Params extends Record<Location, infer Operation>
  ? Operation
  : never

type OperationForPathMethod<
  Paths extends object,
  Path extends keyof Paths,
  Method extends HttpMethod
> = OperationForLocation<Paths[Path], Method> & Record<string | number, unknown>

/** 2nd param is required only when params/requestBody are required */
export type MaybeOptionalInit<Params, Location extends PropertyKey> =
  RequiredKeysOf<FetchOptions<OperationForLocation<Params, Location>>> extends never
    ? FetchOptions<OperationForLocation<Params, Location>> | undefined
    : FetchOptions<OperationForLocation<Params, Location>>

// The final init param to accept.
// - Determines if the param is optional or not.
// - Performs arbitrary [key: string] addition.
// Note: the addition MUST happen after all inference happens.
export type InitParam<Init> = RequiredKeysOf<Init> extends never ? [(Init & Record<string, unknown>)?]
  : [Init & Record<string, unknown>]

export type ClientMethod<Paths extends object, Method extends HttpMethod, Media extends MediaType> = <
  Path extends PathsWithMethod<Paths, Method>,
  Init extends MaybeOptionalInit<Paths[Path], Method>
>(
  url: Path,
  ...init: InitParam<Init>
) => globalThis.Promise<FetchResponse<OperationForPathMethod<Paths, Path, Method>, Init, Media>>

export type ClientRequestMethod<Paths extends object, Media extends MediaType> = <
  Method extends HttpMethod,
  Path extends PathsWithMethod<Paths, Method>,
  Init extends MaybeOptionalInit<Paths[Path], Method>
>(
  method: Method,
  url: Path,
  ...init: InitParam<Init>
) => globalThis.Promise<FetchResponse<OperationForPathMethod<Paths, Path, Method>, Init, Media>>

export type ClientForPath<PathInfo extends Record<string | number, unknown>, Media extends MediaType> = {
  [Method in keyof PathInfo as Uppercase<string & Method>]: <Init extends MaybeOptionalInit<PathInfo, Method>>(
    ...init: InitParam<Init>
  ) => globalThis.Promise<FetchResponse<PathInfo[Method] & Record<string | number, unknown>, Init, Media>>
}

export interface Client<Paths extends object, Media extends MediaType = MediaType> {
  request: ClientRequestMethod<Paths, Media>
  /** Call a GET endpoint */
  GET: ClientMethod<Paths, "get", Media>
  /** Call a PUT endpoint */
  PUT: ClientMethod<Paths, "put", Media>
  /** Call a POST endpoint */
  POST: ClientMethod<Paths, "post", Media>
  /** Call a DELETE endpoint */
  DELETE: ClientMethod<Paths, "delete", Media>
  /** Call a OPTIONS endpoint */
  OPTIONS: ClientMethod<Paths, "options", Media>
  /** Call a HEAD endpoint */
  HEAD: ClientMethod<Paths, "head", Media>
  /** Call a PATCH endpoint */
  PATCH: ClientMethod<Paths, "patch", Media>
  /** Call a TRACE endpoint */
  TRACE: ClientMethod<Paths, "trace", Media>
  /** Register middleware */
  use(...middleware: ReadonlyArray<Middleware>): void
  /** Unregister middleware */
  eject(...middleware: ReadonlyArray<Middleware>): void
}

export type ClientPathsWithMethod<CreatedClient extends Client<object>, Method extends HttpMethod> =
  CreatedClient extends Client<infer Paths, infer _Media> ? PathsWithMethod<Paths, Method>
    : never

export type MethodResponse<
  CreatedClient extends Client<object>,
  Method extends HttpMethod,
  Path extends ClientPathsWithMethod<CreatedClient, Method>,
  Options = object
> = CreatedClient extends Client<infer Paths, infer Media extends MediaType>
  ? NonNullable<FetchResponse<OperationForPathMethod<Paths, Path, Method>, Options, Media>["data"]>
  : never

export type PathBasedClient<Paths extends object, Media extends MediaType = MediaType> = {
  [Path in keyof Paths]: ClientForPath<Paths[Path] & Record<string | number, unknown>, Media>
}
