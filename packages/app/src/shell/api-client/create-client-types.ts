import type { Effect } from "effect"
import type {
  ErrorResponse,
  FilterKeys,
  HttpMethod,
  IsOperationRequestBodyOptional,
  MediaType,
  OperationRequestBodyContent,
  PathsWithMethod,
  Readable,
  RequiredKeysOf,
  ResponseObjectMap,
  SuccessResponse,
  Writable
} from "openapi-typescript-helpers"

export interface ClientOptions extends Omit<RequestInit, "headers"> {
  baseUrl?: string
  fetch?: (input: Request) => ReturnType<typeof globalThis.fetch>
  Request?: typeof Request
  querySerializer?: QuerySerializer<unknown> | QuerySerializerOptions
  bodySerializer?: BodySerializer<unknown>
  pathSerializer?: PathSerializer
  headers?: HeadersOptions
  requestInitExt?: Record<string, unknown>
}

export type HeadersOptions =
  | Required<RequestInit>["headers"]
  | Record<
    string,
    string | number | boolean | Array<string | number | boolean> | null | undefined
  >

export type QuerySerializer<T> = (
  query: T extends { parameters: infer Parameters } ? Parameters extends { query?: infer Query } ? NonNullable<Query>
    : Record<string, unknown>
    : Record<string, unknown>
) => string

export type QuerySerializerOptions = {
  array?: {
    style: "form" | "spaceDelimited" | "pipeDelimited"
    explode: boolean
  }
  object?: {
    style: "form" | "deepObject"
    explode: boolean
  }
  allowReserved?: boolean
}

export type BodySerializer<T> = (
  body: Writable<OperationRequestBodyContent<T>> | BodyInit | object,
  headers?: Headers | HeadersOptions
) => BodyInit

export type PathSerializer = (
  pathname: string,
  pathParams: Record<string, unknown>
) => string

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

export type ParamsOption<T> = T extends { parameters: infer Parameters }
  ? RequiredKeysOf<Parameters> extends never ? { params?: Parameters }
  : { params: Parameters }
  : DefaultParamsOption

export type RequestBodyOption<T> = Writable<OperationRequestBodyContent<T>> extends never ? { body?: never }
  : IsOperationRequestBodyOptional<T> extends true ? { body?: Writable<OperationRequestBodyContent<T>> }
  : { body: Writable<OperationRequestBodyContent<T>> }

export type FetchOptions<T> = RequestOptions<T> & Omit<RequestInit, "body" | "headers">

export type FetchResponse<
  T extends Record<string | number, unknown>,
  Options,
  Media extends MediaType
> =
  | {
    data: ParseAsResponse<Readable<SuccessResponse<ResponseObjectMap<T>, Media>>, Options>
    error?: never
    response: Response
  }
  | {
    data?: never
    error: Readable<ErrorResponse<ResponseObjectMap<T>, Media>>
    response: Response
  }

export type RequestOptions<T> =
  & ParamsOption<T>
  & RequestBodyOption<T>
  & {
    baseUrl?: string
    querySerializer?: QuerySerializer<T> | QuerySerializerOptions
    bodySerializer?: BodySerializer<T>
    pathSerializer?: PathSerializer
    parseAs?: ParseAs
    fetch?: ClientOptions["fetch"]
    headers?: HeadersOptions
    middleware?: Array<Middleware>
  }

export type MergedOptions<T = unknown> = {
  baseUrl: string
  parseAs: ParseAs
  querySerializer: QuerySerializer<T>
  bodySerializer: BodySerializer<T>
  pathSerializer: PathSerializer
  fetch: typeof globalThis.fetch
}

export interface MiddlewareRequestParams {
  query?: Record<string, unknown>
  header?: Record<string, unknown>
  path?: Record<string, unknown>
  cookie?: Record<string, unknown>
}

export interface MiddlewareCallbackParams {
  request: Request
  readonly schemaPath: string
  readonly params: MiddlewareRequestParams
  readonly id: string
  readonly options: MergedOptions
}

export type Thenable<T> = {
  then: (
    onFulfilled: (value: T) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => unknown
}

export type AsyncValue<T> = T | Thenable<T>

export type MiddlewareOnRequest = (
  options: MiddlewareCallbackParams
) => AsyncValue<Request | Response | undefined>

export type MiddlewareOnResponse = (
  options: MiddlewareCallbackParams & { response: Response }
) => AsyncValue<Response | undefined>

export type MiddlewareOnError = (
  options: MiddlewareCallbackParams & { error: unknown }
) => AsyncValue<Response | Error | undefined>

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

export type MaybeOptionalInit<Params, Location extends keyof Params> = RequiredKeysOf<
  FetchOptions<FilterKeys<Params, Location>>
> extends never ? FetchOptions<FilterKeys<Params, Location>> | undefined
  : FetchOptions<FilterKeys<Params, Location>>

type InitParam<Init> = RequiredKeysOf<Init> extends never ? [(Init & { [key: string]: unknown })?]
  : [Init & { [key: string]: unknown }]

type OperationFor<
  Paths extends object,
  Path extends keyof Paths,
  Method extends HttpMethod
> = Paths[Path] extends Record<Method, infer Operation> ? Operation & Record<string | number, unknown>
  : never

type MethodResult<
  Paths extends object,
  Path extends PathsWithMethod<Paths, Method>,
  Method extends HttpMethod,
  Init,
  Media extends MediaType
> = Effect.Effect<
  FetchResponse<OperationFor<Paths, Path & keyof Paths, Method>, Init, Media>,
  Error
>

export type ClientMethod<
  Paths extends object,
  Method extends HttpMethod,
  Media extends MediaType
> = <
  Path extends PathsWithMethod<Paths, Method>,
  Init extends MaybeOptionalInit<Paths[Path], Extract<Method, keyof Paths[Path]>>
>(
  url: Path,
  ...init: InitParam<Init>
) => MethodResult<Paths, Path, Method, Init, Media>

export type ClientRequestMethod<
  Paths extends object,
  Media extends MediaType
> = <
  Method extends HttpMethod,
  Path extends PathsWithMethod<Paths, Method>,
  Init extends MaybeOptionalInit<Paths[Path], Extract<Method, keyof Paths[Path]>>
>(
  method: Method,
  url: Path,
  ...init: InitParam<Init>
) => MethodResult<Paths, Path, Method, Init, Media>

type PathMethodResult<
  PathInfo extends Record<string | number, unknown>,
  Method extends keyof PathInfo,
  Init,
  Media extends MediaType
> = Effect.Effect<
  FetchResponse<PathInfo[Method] & Record<string | number, unknown>, Init, Media>,
  Error
>

export type ClientForPath<PathInfo extends Record<string | number, unknown>, Media extends MediaType> = {
  [Method in keyof PathInfo as Uppercase<string & Method>]: <
    Init extends MaybeOptionalInit<PathInfo, Method>
  >(
    ...init: InitParam<Init>
  ) => PathMethodResult<PathInfo, Method, Init, Media>
}

export interface Client<Paths extends object, Media extends MediaType = MediaType> {
  request: ClientRequestMethod<Paths, Media>
  GET: ClientMethod<Paths, "get", Media>
  PUT: ClientMethod<Paths, "put", Media>
  POST: ClientMethod<Paths, "post", Media>
  DELETE: ClientMethod<Paths, "delete", Media>
  OPTIONS: ClientMethod<Paths, "options", Media>
  HEAD: ClientMethod<Paths, "head", Media>
  PATCH: ClientMethod<Paths, "patch", Media>
  TRACE: ClientMethod<Paths, "trace", Media>
  use(...middleware: Array<Middleware>): void
  eject(...middleware: Array<Middleware>): void
}

export type ClientPathsWithMethod<
  CreatedClient extends Client<Record<string, Record<HttpMethod, unknown>>>,
  Method extends HttpMethod
> = CreatedClient extends Client<infer Paths, infer _Media> ? PathsWithMethod<Paths, Method>
  : never

export type MethodResponse<
  CreatedClient extends Client<Record<string, Record<HttpMethod, unknown>>>,
  Method extends HttpMethod,
  Path extends ClientPathsWithMethod<CreatedClient, Method>,
  Options = object
> = CreatedClient extends Client<
  infer Paths extends Record<string, Record<HttpMethod, unknown>>,
  infer Media extends MediaType
> ? NonNullable<
    FetchResponse<Paths[Path][Method] & Record<string | number, unknown>, Options, Media>["data"]
  >
  : never

export type PathBasedClient<
  Paths extends Record<string | number, unknown>,
  Media extends MediaType = MediaType
> = {
  [Path in keyof Paths]: ClientForPath<Paths[Path] & Record<string | number, unknown>, Media>
}

export type DispatchersFor<Paths extends object> = {
  [Path in keyof Paths]?: {
    [Method in HttpMethod]?: object
  }
}

export type StrictApiClient<Paths extends object> = Client<Paths>
export type StrictApiClientWithDispatchers<Paths extends object> = Client<Paths>
export type ClientEffect<Paths extends object> = Client<Paths>
