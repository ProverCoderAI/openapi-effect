// CHANGE: Local openapi-fetch compatible URL/body/header serialization helpers
// WHY: openapi-effect must ship openapi-fetch API without depending on openapi-fetch package
// SOURCE: Behavior-compatible with openapi-fetch@0.15.x (MIT). Re-implemented with minimal changes.
// PURITY: CORE (pure helpers)
// COMPLEXITY: O(n)

import type { HeadersOptions, QuerySerializer, QuerySerializerOptions } from "./types.js"

const PATH_PARAM_RE = /\{[^{}]+\}/g

/** Serialize primitive params to string */
export const serializePrimitiveParam = (
  name: string,
  value: string,
  options?: { allowReserved?: boolean }
): string => {
  if (value === undefined || value === null) {
    return ""
  }

  // Disallow deep objects here (users can provide custom querySerializer)
  if (typeof value === "object") {
    throw new TypeError(
      "Deeply-nested arrays/objects aren't supported. Provide your own `querySerializer()` to handle these."
    )
  }

  return `${name}=${options?.allowReserved === true ? value : encodeURIComponent(value)}`
}

/** Serialize object param to string */
export const serializeObjectParam = (
  name: string,
  value: Record<string, unknown>,
  options: {
    style: "simple" | "label" | "matrix" | "form" | "deepObject"
    explode: boolean
    allowReserved?: boolean
  }
): string => {
  if (!value || typeof value !== "object") {
    return ""
  }

  const values: Array<string> = []
  const joiner = ({ simple: ",", label: ".", matrix: ";" } as Record<string, string>)[options.style] ?? "&"

  if (options.style !== "deepObject" && !options.explode) {
    for (const k in value) {
      values.push(k, options.allowReserved === true ? String(value[k]) : encodeURIComponent(String(value[k])))
    }
    const final2 = values.join(",")
    switch (options.style) {
      case "form": {
        return `${name}=${final2}`
      }
      case "label": {
        return `.${final2}`
      }
      case "matrix": {
        return `;${name}=${final2}`
      }
      default: {
        return final2
      }
    }
  }

  for (const k in value) {
    const finalName = options.style === "deepObject" ? `${name}[${k}]` : k
    values.push(serializePrimitiveParam(finalName, String(value[k]), options))
  }

  const final = values.join(joiner)
  return options.style === "label" || options.style === "matrix" ? `${joiner}${final}` : final
}

/** Serialize array param to string */
export const serializeArrayParam = (
  name: string,
  value: Array<unknown>,
  options: {
    style: "simple" | "label" | "matrix" | "form" | "spaceDelimited" | "pipeDelimited"
    explode: boolean
    allowReserved?: boolean
  }
): string => {
  if (!Array.isArray(value)) {
    return ""
  }

  if (!options.explode) {
    const joiner2 =
      ({ form: ",", spaceDelimited: "%20", pipeDelimited: "|" } as Record<string, string>)[options.style] ?? ","
    const final = (options.allowReserved === true ? value : value.map((v) => encodeURIComponent(String(v)))).join(
      joiner2
    )

    switch (options.style) {
      case "simple": {
        return final
      }
      case "label": {
        return `.${final}`
      }
      case "matrix": {
        return `;${name}=${final}`
      }
      default: {
        return `${name}=${final}`
      }
    }
  }

  const joiner = ({ simple: ",", label: ".", matrix: ";" } as Record<string, string>)[options.style] ?? "&"
  const values: Array<string> = []

  for (const v of value) {
    if (options.style === "simple" || options.style === "label") {
      values.push(options.allowReserved === true ? String(v) : encodeURIComponent(String(v)))
    } else {
      values.push(serializePrimitiveParam(name, String(v), options))
    }
  }

  const joined = values.join(joiner)
  return options.style === "label" || options.style === "matrix" ? `${joiner}${joined}` : joined
}

/** Serialize query params to string */
export const createQuerySerializer = <T = unknown>(
  options?: QuerySerializerOptions
): (queryParams: T) => string => {
  return function querySerializer(queryParams: T): string {
    const search: Array<string> = []

    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams as any) {
        const value = (queryParams as any)[name]
        if (value === undefined || value === null) {
          continue
        }

        if (Array.isArray(value)) {
          if (value.length === 0) {
            continue
          }
          search.push(
            serializeArrayParam(name, value, {
              style: "form",
              explode: true,
              ...options?.array,
              allowReserved: options?.allowReserved || false
            })
          )
          continue
        }

        if (typeof value === "object") {
          search.push(
            serializeObjectParam(name, value, {
              style: "deepObject",
              explode: true,
              ...options?.object,
              allowReserved: options?.allowReserved || false
            })
          )
          continue
        }

        search.push(serializePrimitiveParam(name, String(value), options))
      }
    }

    return search.join("&")
  }
}

/**
 * Handle OpenAPI 3.x serialization styles for path params
 * @see https://swagger.io/docs/specification/serialization/#path
 */
export const defaultPathSerializer = (pathname: string, pathParams: Record<string, unknown>): string => {
  let nextURL = pathname

  for (const match of pathname.match(PATH_PARAM_RE) ?? []) {
    let name = match.substring(1, match.length - 1)
    let explode = false
    let style: "simple" | "label" | "matrix" = "simple"

    if (name.endsWith("*")) {
      explode = true
      name = name.slice(0, Math.max(0, name.length - 1))
    }

    if (name.startsWith(".")) {
      style = "label"
      name = name.slice(1)
    } else if (name.startsWith(";")) {
      style = "matrix"
      name = name.slice(1)
    }

    if (!pathParams || pathParams[name] === undefined || pathParams[name] === null) {
      continue
    }

    const value = pathParams[name]
    if (Array.isArray(value)) {
      nextURL = nextURL.replace(match, serializeArrayParam(name, value, { style, explode }))
      continue
    }

    if (typeof value === "object") {
      nextURL = nextURL.replace(match, serializeObjectParam(name, value as any, { style, explode }))
      continue
    }

    if (style === "matrix") {
      nextURL = nextURL.replace(match, `;${serializePrimitiveParam(name, String(value))}`)
      continue
    }

    nextURL = nextURL.replace(
      match,
      style === "label" ? `.${encodeURIComponent(String(value))}` : encodeURIComponent(String(value))
    )
  }

  return nextURL
}

/** Serialize body object to string */
export const defaultBodySerializer = <T>(body: T, headers?: Headers | Record<string, string>): any => {
  if (body instanceof FormData) {
    return body
  }

  if (headers) {
    const contentType = typeof (headers as any).get === "function"
      ? ((headers as any).get("Content-Type") ?? (headers as any).get("content-type"))
      : (headers as any)["Content-Type"] ?? (headers as any)["content-type"]

    if (contentType === "application/x-www-form-urlencoded") {
      return new URLSearchParams(body as any).toString()
    }
  }

  return JSON.stringify(body)
}

/** Construct URL string from baseUrl and handle path and query params */
export const createFinalURL = <O>(
  pathname: string,
  options: {
    baseUrl: string
    params: { query?: Record<string, unknown>; path?: Record<string, unknown> }
    querySerializer: QuerySerializer<O>
  }
): string => {
  let finalURL = `${options.baseUrl}${pathname}`

  if (options.params?.path) {
    finalURL = defaultPathSerializer(finalURL, options.params.path)
  }

  let search = options.querySerializer((options.params.query ?? {}) as any)
  if (search.startsWith("?")) {
    search = search.slice(1)
  }

  if (search) {
    finalURL += `?${search}`
  }

  return finalURL
}

/** Merge headers a and b, with b taking priority */
export const mergeHeaders = (...allHeaders: Array<HeadersOptions | undefined>): Headers => {
  const finalHeaders = new Headers()

  for (const h of allHeaders) {
    if (!h || typeof h !== "object") {
      continue
    }

    const iterator = h instanceof Headers ? h.entries() : Object.entries(h)
    for (const [k, v] of iterator) {
      if (v === null) {
        finalHeaders.delete(k)
      } else if (Array.isArray(v)) {
        for (const v2 of v) {
          finalHeaders.append(k, String(v2))
        }
      } else if (v !== undefined) {
        finalHeaders.set(k, String(v))
      }
    }
  }

  return finalHeaders
}

/** Remove trailing slash from url */
export const removeTrailingSlash = (url: string): string => {
  return url.endsWith("/") ? url.slice(0, Math.max(0, url.length - 1)) : url
}
