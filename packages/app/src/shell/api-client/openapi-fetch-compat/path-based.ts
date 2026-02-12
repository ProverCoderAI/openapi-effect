// CHANGE: Local openapi-fetch compatible path-based client proxy
// WHY: Preserve openapi-fetch API (`createPathBasedClient`, `wrapAsPathBasedClient`) without dependency
// SOURCE: Behavior-compatible with openapi-fetch@0.15.x (MIT)
// PURITY: SHELL (runtime)
// COMPLEXITY: O(1) per path access

import type { MediaType } from "openapi-typescript-helpers"

import type { Client, ClientForPath, PathBasedClient } from "./types.js"

class PathCallForwarder<Paths extends Record<string, Record<string, any>>, Media extends MediaType> {
  constructor(
    private readonly client: Client<Paths, Media>,
    private readonly url: string
  ) {}

  GET = (init: any) => this.client.GET(this.url as any, init)
  PUT = (init: any) => this.client.PUT(this.url as any, init)
  POST = (init: any) => this.client.POST(this.url as any, init)
  DELETE = (init: any) => this.client.DELETE(this.url as any, init)
  OPTIONS = (init: any) => this.client.OPTIONS(this.url as any, init)
  HEAD = (init: any) => this.client.HEAD(this.url as any, init)
  PATCH = (init: any) => this.client.PATCH(this.url as any, init)
  TRACE = (init: any) => this.client.TRACE(this.url as any, init)
}

class PathClientProxyHandler<Paths extends Record<string, Record<string, any>>, Media extends MediaType>
  implements ProxyHandler<ClientForPath<any, any>>
{
  client: any = null

  // Assume the property is an URL.
  get(coreClient: any, url: string): any {
    const forwarder = new PathCallForwarder<Paths, Media>(coreClient, url)
    this.client[url] = forwarder
    return forwarder
  }
}

export const wrapAsPathBasedClient = <Paths extends {}, Media extends MediaType = MediaType>(
  client: Client<Paths, Media>
): PathBasedClient<Paths, Media> => {
  const handler = new PathClientProxyHandler<Paths & Record<string, Record<string, any>>, Media>()
  const proxy = new Proxy(client as any, handler)

  function ClientProxy(): void {}
  ClientProxy.prototype = proxy

  const pathClient = new (ClientProxy as any)()
  handler.client = pathClient
  return pathClient
}
