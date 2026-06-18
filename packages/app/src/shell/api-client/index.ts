// CHANGE: Main entry point for the openapi-effect shell module
// WHY: Export only the Effect client API and its openapi-fetch-compatible input helpers
// QUOTE(ТЗ): "итоговый тип возвращался от effect а не promise"
// REF: user-msg-openapi-effect-only
// SOURCE: n/a
// PURITY: SHELL (re-exports)
// COMPLEXITY: O(1)

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
} from "./create-client.js"
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
} from "./create-client.js"
