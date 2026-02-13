import type { MediaType } from "openapi-typescript-helpers"

import { asStrictApiClient } from "../../core/axioms.js"
import type { RuntimeClient, RuntimeFetchOptions } from "./create-client-runtime-types.js"
import { createRuntimeClient } from "./create-client-runtime.js"
import type { Client, ClientEffect, ClientOptions, DispatchersFor, PathBasedClient } from "./create-client-types.js"

export type {
  Client,
  ClientEffect,
  ClientForPath,
  ClientMethod,
  ClientOptions,
  ClientPathsWithMethod,
  ClientRequestMethod,
  DispatchersFor,
  FetchOptions,
  FetchResponse,
  HeadersOptions,
  MethodResponse,
  Middleware,
  MiddlewareCallbackParams,
  ParseAs,
  PathBasedClient,
  QuerySerializer,
  QuerySerializerOptions,
  RequestBodyOption,
  RequestOptions,
  StrictApiClient,
  StrictApiClientWithDispatchers
} from "./create-client-types.js"

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

export const createClient = <Paths extends object, Media extends MediaType = MediaType>(
  clientOptions?: ClientOptions
): Client<Paths, Media> => asStrictApiClient<Client<Paths, Media>>(createRuntimeClient(clientOptions))

class PathCallForwarder {
  constructor(
    private readonly client: RuntimeClient,
    private readonly url: string
  ) {}

  private readonly call = (
    method: "GET" | "PUT" | "POST" | "DELETE" | "OPTIONS" | "HEAD" | "PATCH" | "TRACE",
    init?: RuntimeFetchOptions
  ) => this.client[method](this.url, init)

  public readonly GET = (init?: RuntimeFetchOptions) => this.call("GET", init)
  public readonly PUT = (init?: RuntimeFetchOptions) => this.call("PUT", init)
  public readonly POST = (init?: RuntimeFetchOptions) => this.call("POST", init)
  public readonly DELETE = (init?: RuntimeFetchOptions) => this.call("DELETE", init)
  public readonly OPTIONS = (init?: RuntimeFetchOptions) => this.call("OPTIONS", init)
  public readonly HEAD = (init?: RuntimeFetchOptions) => this.call("HEAD", init)
  public readonly PATCH = (init?: RuntimeFetchOptions) => this.call("PATCH", init)
  public readonly TRACE = (init?: RuntimeFetchOptions) => this.call("TRACE", init)
}

export const wrapAsPathBasedClient = <
  Paths extends Record<string | number, unknown>,
  Media extends MediaType = MediaType
>(
  client: Client<Paths, Media>
): PathBasedClient<Paths, Media> => {
  const cache = new Map<string, object>()
  const target = asStrictApiClient<PathBasedClient<Paths, Media>>({})

  return new Proxy(target, {
    get: (_target, property) => {
      if (typeof property !== "string") {
        return
      }

      const cached = cache.get(property)
      if (cached !== undefined) {
        return cached
      }

      const forwarder = new PathCallForwarder(asStrictApiClient<RuntimeClient>(client), property)
      cache.set(property, forwarder)
      return forwarder
    }
  })
}

export const createPathBasedClient = <
  Paths extends Record<string | number, unknown>,
  Media extends MediaType = MediaType
>(
  clientOptions?: ClientOptions
): PathBasedClient<Paths, Media> => wrapAsPathBasedClient(createClient<Paths, Media>(clientOptions))

export const createClientEffect = <Paths extends object>(
  clientOptions?: ClientOptions
): ClientEffect<Paths> => createClient<Paths>(clientOptions)

export const registerDefaultDispatchers = <Paths extends object>(
  _dispatchers: DispatchersFor<Paths>
): void => {}
