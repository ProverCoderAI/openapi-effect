// CHANGE: Local openapi-fetch compatible createClient implemented via Effect internally
// WHY: Drop-in replacement for openapi-fetch without depending on it; keep Promise-based signature for consumers
// SOURCE: Behavior-compatible with openapi-fetch@0.15.x (MIT). Uses Effect for internal control-flow.
// PURITY: SHELL (performs HTTP requests)
// COMPLEXITY: O(1) + O(|body|)

import { Effect, Either } from "effect"
import type { MediaType } from "openapi-typescript-helpers"

import {
  createFinalURL,
  createQuerySerializer,
  defaultBodySerializer,
  mergeHeaders,
  removeTrailingSlash
} from "./serialize.js"
import type {
  Client,
  ClientOptions,
  FetchResponse,
  HeadersOptions,
  MergedOptions,
  Middleware,
  QuerySerializer,
  QuerySerializerOptions,
  RequestOptions
} from "./types.js"

const supportsRequestInitExt = (): boolean => {
  // Match openapi-fetch behavior: only enable in Node >= 18 with undici.
  return (
    typeof process === "object"
    && Number.parseInt(process?.versions?.node?.slice(0, 2)) >= 18
    && (process as any).versions?.undici
  )
}

const randomID = (): string => Math.random().toString(36).slice(2, 11)

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" && value !== null && "then" in value && typeof (value as any).then === "function"

const fromMaybePromise = <A>(thunk: () => A | PromiseLike<A>): Effect.Effect<A, unknown> =>
  Effect.try({
    try: () => thunk(),
    catch: (error) => error
  }).pipe(
    Effect.flatMap((value) =>
      isPromiseLike(value)
        ? Effect.tryPromise({
          try: () => value as any as Promise<A>,
          catch: (error) => error
        })
        : Effect.succeed(value)
    )
  )

function assertMiddlewareShape(m: unknown): asserts m is Middleware {
  if (!m) return
  if (
    typeof m !== "object"
    || !("onRequest" in (m as any) || "onResponse" in (m as any) || "onError" in (m as any))
  ) {
    throw new Error("Middleware must be an object with one of `onRequest()`, `onResponse() or `onError()`")
  }
}

export const createClient = <Paths extends {}, Media extends MediaType = MediaType>(
  clientOptions?: ClientOptions
): Client<Paths, Media> => {
  const clientOptions_ = ({ ...clientOptions } as any) satisfies Record<string, unknown>

  let baseUrl: string = clientOptions_.baseUrl ?? ""
  const CustomRequest: typeof Request = clientOptions_.Request ?? globalThis.Request
  const baseFetch: any = clientOptions_.fetch ?? globalThis.fetch
  const globalQuerySerializer: unknown = clientOptions_.querySerializer
  const globalBodySerializer: unknown = clientOptions_.bodySerializer
  const baseHeaders: HeadersOptions | undefined = clientOptions_.headers as HeadersOptions | undefined
  let requestInitExt: Record<string, unknown> | undefined = clientOptions_.requestInitExt

  // Capture all other RequestInit fields (credentials, mode, cache, ...).
  const baseOptions: Record<string, unknown> = { ...clientOptions_ }
  delete (baseOptions as any).baseUrl
  delete (baseOptions as any).Request
  delete (baseOptions as any).fetch
  delete (baseOptions as any).querySerializer
  delete (baseOptions as any).bodySerializer
  delete (baseOptions as any).headers
  delete (baseOptions as any).requestInitExt

  requestInitExt = supportsRequestInitExt() ? requestInitExt : undefined
  baseUrl = removeTrailingSlash(baseUrl)
  const globalMiddlewares: Array<Middleware> = []

  const coreFetchEffect = <O>(
    schemaPath: string,
    fetchOptions?: RequestOptions<O> & Omit<RequestInit, "body" | "headers">
  ): Effect.Effect<FetchResponse<any, any, any>, unknown> =>
    Effect.gen(function*() {
      const fetchOptions_ = ({ ...fetchOptions } as any) satisfies Record<string, unknown>

      const localBaseUrl: string | undefined = fetchOptions_.baseUrl
      const fetch: any = fetchOptions_.fetch ?? baseFetch
      const RequestCtor: typeof Request = fetchOptions_.Request ?? CustomRequest
      const headers: HeadersOptions | undefined = fetchOptions_.headers as HeadersOptions | undefined
      const params: any = fetchOptions_.params ?? {}
      const parseAs: any = fetchOptions_.parseAs ?? "json"
      const requestQuerySerializer: unknown = fetchOptions_.querySerializer
      const bodySerializer: any = fetchOptions_.bodySerializer ?? (globalBodySerializer ?? defaultBodySerializer)
      const body: unknown = fetchOptions_.body
      const requestMiddlewares: Array<Middleware> = fetchOptions_.middleware ?? []

      const init: Record<string, unknown> = { ...fetchOptions_ }
      delete (init as any).baseUrl
      delete (init as any).fetch
      delete (init as any).Request
      delete (init as any).headers
      delete (init as any).params
      delete (init as any).parseAs
      delete (init as any).querySerializer
      delete (init as any).bodySerializer
      delete (init as any).body
      delete (init as any).middleware

      let finalBaseUrl = baseUrl
      if (localBaseUrl) {
        finalBaseUrl = removeTrailingSlash(localBaseUrl) ?? baseUrl
      }

      let querySerializer: QuerySerializer<O> = typeof globalQuerySerializer === "function"
        ? (globalQuerySerializer as any)
        : createQuerySerializer(globalQuerySerializer as QuerySerializerOptions | undefined)

      if (requestQuerySerializer) {
        querySerializer = typeof requestQuerySerializer === "function"
          ? (requestQuerySerializer as any)
          : createQuerySerializer({
            ...(typeof globalQuerySerializer === "object" ? (globalQuerySerializer as any) : {}),
            ...(requestQuerySerializer as any)
          })
      }

      const serializedBody = body === undefined
        ? undefined
        : bodySerializer(body, mergeHeaders(baseHeaders, headers, params.header))

      const finalHeaders = mergeHeaders(
        serializedBody === undefined || serializedBody instanceof FormData
          ? {}
          : { "Content-Type": "application/json" },
        baseHeaders,
        headers,
        params.header
      )

      const finalMiddlewares = [...globalMiddlewares, ...requestMiddlewares]
      const requestInit: RequestInit = {
        redirect: "follow",
        ...baseOptions,
        ...init,
        body: serializedBody,
        headers: finalHeaders
      }

      let id: string | undefined
      let options: MergedOptions | undefined
      let request: Request = new (RequestCtor as any)(
        createFinalURL(schemaPath, { baseUrl: finalBaseUrl, params, querySerializer }),
        requestInit
      )

      let response: Response | undefined

      // Copy init extension keys onto Request for middleware access (matches openapi-fetch behavior).
      for (const key in init) {
        if (!(key in request)) {
          ;(request as any)[key] = (init as any)[key]
        }
      }

      if (finalMiddlewares.length > 0) {
        id = randomID()
        options = Object.freeze({
          baseUrl: finalBaseUrl,
          fetch,
          parseAs,
          querySerializer,
          bodySerializer
        })

        for (const m of finalMiddlewares) {
          if (m && typeof m === "object" && typeof (m as any).onRequest === "function") {
            const result = yield* fromMaybePromise(() =>
              (m as any).onRequest({
                request,
                schemaPath,
                params,
                options,
                id
              })
            )

            if (result) {
              if (result instanceof Request) {
                request = result
              } else if (result instanceof Response) {
                response = result
                break
              } else {
                throw new TypeError("onRequest: must return new Request() or Response() when modifying the request")
              }
            }
          }
        }
      }

      if (!response) {
        const fetched = yield* Effect.either(
          Effect.tryPromise({
            try: () => fetch(request, requestInitExt),
            catch: (error) => error
          })
        )

        if (Either.isLeft(fetched)) {
          let errorAfterMiddleware: unknown = fetched.left

          if (finalMiddlewares.length > 0) {
            for (let i = finalMiddlewares.length - 1; i >= 0; i--) {
              const m = finalMiddlewares[i]
              if (m && typeof m === "object" && typeof (m as any).onError === "function") {
                const result = yield* fromMaybePromise(() =>
                  (m as any).onError({
                    request,
                    error: errorAfterMiddleware,
                    schemaPath,
                    params,
                    options,
                    id
                  })
                )

                if (result) {
                  if (result instanceof Response) {
                    errorAfterMiddleware = undefined
                    response = result
                    break
                  }
                  if (result instanceof Error) {
                    errorAfterMiddleware = result
                    continue
                  }
                  throw new Error("onError: must return new Response() or instance of Error")
                }
              }
            }
          }

          if (errorAfterMiddleware) {
            // Re-throw as failure (Promise rejection on the outside).
            return yield* Effect.fail(errorAfterMiddleware)
          }
        } else {
          response = fetched.right as Response
        }

        if (finalMiddlewares.length > 0 && response) {
          for (let i = finalMiddlewares.length - 1; i >= 0; i--) {
            const m = finalMiddlewares[i]
            if (m && typeof m === "object" && typeof (m as any).onResponse === "function") {
              const result = yield* fromMaybePromise(() =>
                (m as any).onResponse({
                  request,
                  response,
                  schemaPath,
                  params,
                  options,
                  id
                })
              )

              if (result) {
                if (!(result instanceof Response)) {
                  throw new TypeError("onResponse: must return new Response() when modifying the response")
                }
                response = result
              }
            }
          }
        }
      }

      // If middleware short-circuited with a Response, openapi-fetch does NOT run onResponse hooks.
      // We already replicated that by running onResponse only inside the fetch path above.
      if (!response) {
        // Defensive: should never happen, but keeps types happy.
        return { error: undefined, response: new Response(null) } as any
      }

      const contentLength = response.headers.get("Content-Length")

      if (response.status === 204 || request.method === "HEAD" || contentLength === "0") {
        return response.ok ? ({ data: undefined, response } as any) : ({ error: undefined, response } as any)
      }

      if (response.ok) {
        if (parseAs === "stream") {
          return { data: response.body, response } as any
        }

        if (parseAs === "json" && !contentLength) {
          const raw = yield* Effect.tryPromise({
            try: () => response.text(),
            catch: (error) => error
          })
          if (raw === "") {
            return { data: undefined, response } as any
          }
          const parsed = yield* Effect.try({
            try: () => JSON.parse(raw),
            catch: (error) => error
          })
          return { data: parsed, response } as any
        }

        const data = yield* Effect.tryPromise({
          try: () => (response as any)[parseAs](),
          catch: (error) => error
        })
        return { data, response } as any
      }

      const errorText = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (error) => error
      })

      const error = yield* Effect.catchAll(
        Effect.try({
          try: () => JSON.parse(errorText),
          catch: () => errorText
        }),
        () => Effect.succeed(errorText)
      )
      return { error, response } as any
    })

  const coreFetch = (schemaPath: string, fetchOptions: any): Promise<any> =>
    Effect.runPromise(coreFetchEffect(schemaPath, fetchOptions))

  return {
    request(method: any, url: any, init: any) {
      return coreFetch(url, { ...init, method: String(method).toUpperCase() })
    },
    GET(url: any, init: any) {
      return coreFetch(url, { ...init, method: "GET" })
    },
    PUT(url: any, init: any) {
      return coreFetch(url, { ...init, method: "PUT" })
    },
    POST(url: any, init: any) {
      return coreFetch(url, { ...init, method: "POST" })
    },
    DELETE(url: any, init: any) {
      return coreFetch(url, { ...init, method: "DELETE" })
    },
    OPTIONS(url: any, init: any) {
      return coreFetch(url, { ...init, method: "OPTIONS" })
    },
    HEAD(url: any, init: any) {
      return coreFetch(url, { ...init, method: "HEAD" })
    },
    PATCH(url: any, init: any) {
      return coreFetch(url, { ...init, method: "PATCH" })
    },
    TRACE(url: any, init: any) {
      return coreFetch(url, { ...init, method: "TRACE" })
    },
    /** Register middleware */
    use(...middleware: Array<Middleware>) {
      for (const m of middleware) {
        if (!m) {
          continue
        }
        assertMiddlewareShape(m)
        globalMiddlewares.push(m)
      }
    },
    /** Unregister middleware */
    eject(...middleware: Array<Middleware>) {
      for (const m of middleware) {
        const i = globalMiddlewares.indexOf(m)
        if (i !== -1) {
          globalMiddlewares.splice(i, 1)
        }
      }
    }
  } as any
}

export default createClient
