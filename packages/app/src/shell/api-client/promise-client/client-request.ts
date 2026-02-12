// CHANGE: Request construction helpers for promise-compatible client
// WHY: Isolate RequestInit/header/body assembly from create-client orchestration
// SOURCE: n/a
// PURITY: SHELL
// COMPLEXITY: O(n)

import type { ResolvedClientOptions, ResolvedFetchOptions } from "./client-kernel.js"
import { createFinalURL, mergeHeaders } from "./serialize.js"

type HeaderScalar = string | number | boolean

type HeaderValue = HeaderScalar | ReadonlyArray<HeaderScalar> | null | undefined

type HeaderRecord = Record<string, HeaderValue>

const isHeaderScalar = (value: unknown): value is HeaderScalar => {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
}

const isHeaderArray = (value: unknown): value is ReadonlyArray<HeaderScalar> => {
  return Array.isArray(value) && value.every((item) => isHeaderScalar(item))
}

const normalizeHeaderParams = (headers: Record<string, unknown> | undefined): HeaderRecord | undefined => {
  if (headers === undefined) {
    return undefined
  }

  const result: HeaderRecord = {}

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) {
      result[key] = value
      continue
    }

    if (isHeaderScalar(value) || isHeaderArray(value)) {
      result[key] = value
    }
  }

  return result
}

const createRequestInit = (
  baseInit: RequestInit,
  headers: Headers,
  serializedBody: unknown
): RequestInit => {
  const init: RequestInit = {
    ...baseInit,
    headers
  }

  if (serializedBody === undefined) {
    return init
  }

  return {
    ...init,
    body: serializedBody as BodyInit | null
  }
}

const applyPassthroughInit = (request: Request, passthroughInit: Record<string, unknown>): void => {
  const target = request as unknown as Record<string, unknown>

  for (const [key, value] of Object.entries(passthroughInit)) {
    if (!(key in request)) {
      target[key] = value
    }
  }
}

export const buildRequest = (
  client: ResolvedClientOptions,
  resolved: ResolvedFetchOptions,
  schemaPath: string
): Request => {
  const headerParams = normalizeHeaderParams(resolved.params.header)
  const serializerHeaders = mergeHeaders(client.baseHeaders, resolved.headers, headerParams)

  const serializedBody = resolved.body === undefined
    ? undefined
    : resolved.bodySerializer(resolved.body as never, serializerHeaders)

  const autoContentType = serializedBody === undefined || serializedBody instanceof FormData
    ? undefined
    : { "Content-Type": "application/json" }

  const finalHeaders = mergeHeaders(autoContentType, client.baseHeaders, resolved.headers, headerParams)

  const request = new resolved.RequestCtor(
    createFinalURL(schemaPath, {
      baseUrl: resolved.baseUrl,
      params: resolved.params,
      querySerializer: resolved.querySerializer
    }),
    createRequestInit(resolved.requestInit, finalHeaders, serializedBody)
  )

  applyPassthroughInit(request, resolved.passthroughInit)
  return request
}
