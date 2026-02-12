// CHANGE: Path-based Promise client proxy
// WHY: Preserve openapi-fetch-compatible API (`wrapAsPathBasedClient` / `createPathBasedClient`)
// SOURCE: behavior aligned with openapi-fetch@0.15.x
// PURITY: SHELL
// COMPLEXITY: O(1) per property access

import type { MediaType } from "openapi-typescript-helpers"

import type { Client, PathBasedClient } from "./types.js"

type Forwarder = {
  GET: (...init: ReadonlyArray<unknown>) => unknown
  PUT: (...init: ReadonlyArray<unknown>) => unknown
  POST: (...init: ReadonlyArray<unknown>) => unknown
  DELETE: (...init: ReadonlyArray<unknown>) => unknown
  OPTIONS: (...init: ReadonlyArray<unknown>) => unknown
  HEAD: (...init: ReadonlyArray<unknown>) => unknown
  PATCH: (...init: ReadonlyArray<unknown>) => unknown
  TRACE: (...init: ReadonlyArray<unknown>) => unknown
}

const createForwarder = <Paths extends object, Media extends MediaType>(
  client: Client<Paths, Media>,
  url: string
): Forwarder => {
  const path = url as never

  return {
    GET: (...init) => client.GET(path, ...(init as never)),
    PUT: (...init) => client.PUT(path, ...(init as never)),
    POST: (...init) => client.POST(path, ...(init as never)),
    DELETE: (...init) => client.DELETE(path, ...(init as never)),
    OPTIONS: (...init) => client.OPTIONS(path, ...(init as never)),
    HEAD: (...init) => client.HEAD(path, ...(init as never)),
    PATCH: (...init) => client.PATCH(path, ...(init as never)),
    TRACE: (...init) => client.TRACE(path, ...(init as never))
  }
}

const createProxyHandler = <Paths extends object, Media extends MediaType>(
  client: Client<Paths, Media>,
  cache: Map<string, Forwarder>
): ProxyHandler<Record<string, unknown>> => {
  return {
    get: (_target, property): unknown => {
      if (typeof property !== "string") {
        return undefined
      }

      const cached = cache.get(property)
      if (cached !== undefined) {
        return cached
      }

      const forwarder = createForwarder(client, property)
      cache.set(property, forwarder)
      return forwarder
    }
  }
}

export const wrapAsPathBasedClient = <Paths extends object, Media extends MediaType = MediaType>(
  client: Client<Paths, Media>
): PathBasedClient<Paths, Media> => {
  const cache = new Map<string, Forwarder>()
  const proxy = new Proxy<Record<string, unknown>>({}, createProxyHandler(client, cache))
  return proxy as unknown as PathBasedClient<Paths, Media>
}
