// CHANGE: Expose the minimal openapi-effect public API
// WHY: Keep the package focused on openapi-fetch-compatible inputs with Effect output channels
// SOURCE: n/a
// PURITY: SHELL (re-exports)
// COMPLEXITY: O(1)

export type * from "./core/api-client/index.js"
export { assertNever } from "./core/api-client/index.js"

export type {
  ClientEffect,
  ClientOptions,
  EffectClient,
  EffectClientMethod,
  EffectClientRequestMethod,
  FetchOptions,
  HeadersOptions,
  Middleware,
  ParseAs,
  QuerySerializer,
  QuerySerializerOptions,
  RequestBodyOption,
  RequestOptions
} from "./shell/api-client/create-client.js"

export {
  createClientEffect,
  createFinalURL,
  createQuerySerializer,
  defaultBodySerializer,
  defaultPathSerializer,
  mergeHeaders,
  removeTrailingSlash,
  serializeArrayParam,
  serializeObjectParam,
  serializePrimitiveParam
} from "./shell/api-client/index.js"
