import { asStrictApiClient } from "../../core/axioms.js"
import type { ClientEffect, EffectClient } from "./create-client-effect-types.js"
import { createRuntimeEffectClient } from "./create-client-runtime.js"
import type { ClientOptions } from "./create-client-types.js"

export type {
  ClientOptions,
  FetchOptions,
  HeadersOptions,
  Middleware,
  MiddlewareCallbackParams,
  ParseAs,
  QuerySerializer,
  QuerySerializerOptions,
  RequestBodyOption,
  RequestOptions
} from "./create-client-types.js"

export type {
  ClientEffect,
  EffectClient,
  EffectClientMethod,
  EffectClientRequestMethod
} from "./create-client-effect-types.js"

export {
  createFinalURL,
  createQuerySerializer,
  defaultBodySerializer,
  defaultPathSerializer,
  mergeHeaders,
  removeTrailingSlash,
  serializeArrayParam,
  serializeObjectParam,
  serializePrimitiveParam
} from "./openapi-compat-utils.js"

export const createClientEffect = <Paths extends object>(
  clientOptions?: ClientOptions
): ClientEffect<Paths> => asStrictApiClient<EffectClient<Paths>>(createRuntimeEffectClient(clientOptions))
