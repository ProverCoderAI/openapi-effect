// CHANGE: Request URL/body/header serialization helpers for promise-compatible client
// WHY: Keep openapi-fetch-compatible behavior while keeping functions small and testable
// SOURCE: behavior aligned with openapi-fetch@0.15.x (MIT)
// PURITY: CORE helpers
// COMPLEXITY: O(n)

import { defaultPathSerializer } from "./serialize-path.js"
import type { HeadersOptions, QuerySerializer } from "./types.js"

const readHeader = (headers: Headers | Record<string, string>, name: string): string | undefined => {
  if (headers instanceof Headers) {
    return headers.get(name) ?? headers.get(name.toLowerCase()) ?? undefined
  }

  return headers[name] ?? headers[name.toLowerCase()]
}

const isUrlEncodedBody = (body: unknown): body is Record<string, string> => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false
  }

  return Object.values(body).every((value) => typeof value === "string")
}

const toHeaderEntries = (
  headers: HeadersOptions
): Array<[string, string | number | boolean | ReadonlyArray<string | number | boolean> | null | undefined]> => {
  if (headers instanceof Headers) {
    return [...headers.entries()]
  }

  if (Array.isArray(headers)) {
    return headers
  }

  return Object.entries(headers)
}

const appendHeaderValue = (
  finalHeaders: Headers,
  key: string,
  rawValue: string | number | boolean | ReadonlyArray<string | number | boolean> | null | undefined
): void => {
  if (rawValue === null) {
    finalHeaders.delete(key)
    return
  }

  if (rawValue === undefined) {
    return
  }

  if (Array.isArray(rawValue)) {
    for (const value of rawValue) {
      finalHeaders.append(key, String(value))
    }
    return
  }

  finalHeaders.set(key, String(rawValue))
}

/** Serialize body object to string */
export const defaultBodySerializer = (
  body: unknown,
  headers?: Headers | Record<string, string>
): unknown => {
  let serialized: unknown

  if (body instanceof FormData) {
    serialized = body
  } else if (
    headers !== undefined &&
    readHeader(headers, "Content-Type") === "application/x-www-form-urlencoded" &&
    isUrlEncodedBody(body)
  ) {
    serialized = new URLSearchParams(body).toString()
  } else {
    serialized = JSON.stringify(body ?? null)
  }

  return serialized
}

/** Construct URL string from baseUrl and handle path and query params */
export const createFinalURL = (
  pathname: string,
  options: {
    baseUrl: string
    params: { query?: Record<string, unknown>; path?: Record<string, unknown> }
    querySerializer: QuerySerializer<Record<string, unknown>>
  }
): string => {
  const pathURL = options.params.path === undefined
    ? `${options.baseUrl}${pathname}`
    : defaultPathSerializer(`${options.baseUrl}${pathname}`, options.params.path)

  let search = options.querySerializer(options.params.query ?? {})
  if (search.startsWith("?")) {
    search = search.slice(1)
  }

  return search.length > 0 ? `${pathURL}?${search}` : pathURL
}

/** Merge headers a and b, with b taking priority */
export const mergeHeaders = (...allHeaders: ReadonlyArray<HeadersOptions | undefined>): Headers => {
  const finalHeaders = new Headers()

  for (const headerInput of allHeaders) {
    if (headerInput === undefined) {
      continue
    }

    for (const [key, rawValue] of toHeaderEntries(headerInput)) {
      appendHeaderValue(finalHeaders, key, rawValue)
    }
  }

  return finalHeaders
}

/** Remove trailing slash from url */
export const removeTrailingSlash = (url: string): string => {
  return url.endsWith("/") ? url.slice(0, -1) : url
}

export { createQuerySerializer } from "./serialize-params.js"
export { defaultPathSerializer } from "./serialize-path.js"
