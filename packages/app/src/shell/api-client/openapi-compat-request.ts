import type { HeadersOptions, PathSerializer, QuerySerializer } from "./create-client-types.js"

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === "object" && !Array.isArray(value)
)

const toFormRecord = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) {
    return {}
  }

  const formRecord: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    formRecord[key] = String(item)
  }

  return formRecord
}

type HeaderRecord = Record<
  string,
  string | number | boolean | Array<string | number | boolean> | null | undefined
>

const isHeaderRecord = (headers: HeadersOptions): headers is HeaderRecord => (
  !(headers instanceof Headers) && !Array.isArray(headers)
)

const getHeaderValue = (headers: Headers | HeadersOptions | undefined, key: string): string | undefined => {
  if (headers === undefined) {
    return
  }

  if (headers instanceof Headers) {
    return headers.get(key) ?? undefined
  }

  if (!isHeaderRecord(headers)) {
    return
  }

  const value = headers[key]
  if (value === undefined || value === null || Array.isArray(value)) {
    return
  }

  return String(value)
}

const stringifyBody = (body: unknown): string => {
  return JSON.stringify(body)
}

export const defaultBodySerializer = (
  body: unknown,
  headers?: Headers | HeadersOptions
): string => {
  if (body === undefined) {
    return ""
  }

  const contentType = getHeaderValue(headers, "Content-Type") ?? getHeaderValue(headers, "content-type")
  if (contentType === "application/x-www-form-urlencoded") {
    return new URLSearchParams(toFormRecord(body)).toString()
  }

  return stringifyBody(body)
}

export const createFinalURL = (
  pathname: string,
  options: {
    baseUrl: string
    params: {
      query?: Record<string, unknown>
      path?: Record<string, unknown>
    }
    querySerializer: QuerySerializer<object>
    pathSerializer: PathSerializer
  }
): string => {
  let finalURL = `${options.baseUrl}${pathname}`

  if (options.params.path) {
    finalURL = options.pathSerializer(finalURL, options.params.path)
  }

  let queryString = options.querySerializer(options.params.query ?? {})
  if (queryString.startsWith("?")) {
    queryString = queryString.slice(1)
  }

  if (queryString.length > 0) {
    finalURL = `${finalURL}?${queryString}`
  }

  return finalURL
}

const applyHeaderValue = (target: Headers, key: string, value: HeaderRecord[string]): void => {
  if (value === null) {
    target.delete(key)
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      target.append(key, String(item))
    }
    return
  }

  if (value !== undefined) {
    target.set(key, String(value))
  }
}

const mergeHeaderSource = (target: Headers, source: HeadersOptions): void => {
  if (source instanceof Headers) {
    for (const [key, value] of source.entries()) {
      target.set(key, value)
    }
    return
  }

  if (!isHeaderRecord(source)) {
    return
  }

  for (const [key, value] of Object.entries(source)) {
    applyHeaderValue(target, key, value)
  }
}

export const mergeHeaders = (
  ...allHeaders: Array<HeadersOptions | undefined>
): Headers => {
  const finalHeaders = new Headers()

  for (const source of allHeaders) {
    if (source === undefined || typeof source !== "object") {
      continue
    }

    mergeHeaderSource(finalHeaders, source)
  }

  return finalHeaders
}

export const removeTrailingSlash = (url: string): string => (
  url.endsWith("/") ? url.slice(0, Math.max(0, url.length - 1)) : url
)
