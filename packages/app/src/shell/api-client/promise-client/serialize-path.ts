// CHANGE: OpenAPI path serializer extracted from query serializer module
// WHY: Keep files under lint line limits while preserving path-style behavior
// SOURCE: behavior aligned with openapi-fetch@0.15.x (MIT)
// PURITY: CORE helpers
// COMPLEXITY: O(n)

import { serializeArrayParam, serializeObjectParam, serializePrimitiveParam } from "./serialize-params.js"
import { isPrimitive, isPrimitiveArray, isPrimitiveRecord, type Primitive } from "./serialize-shared.js"

const PATH_PARAM_RE = /\{[^{}]+\}/g

type PathStyle = "simple" | "label" | "matrix"

type ParsedPath = {
  name: string
  explode: boolean
  style: PathStyle
}

const withStylePrefix = (style: PathStyle, value: string): string => {
  if (style === "label") {
    return `.${value}`
  }

  if (style === "matrix") {
    return `;${value}`
  }

  return value
}

const parsePathToken = (rawName: string): ParsedPath => {
  const explode = rawName.endsWith("*")
  const cleanName = explode ? rawName.slice(0, -1) : rawName

  if (cleanName.startsWith(".")) {
    return { name: cleanName.slice(1), explode, style: "label" }
  }

  if (cleanName.startsWith(";")) {
    return { name: cleanName.slice(1), explode, style: "matrix" }
  }

  return { name: cleanName, explode, style: "simple" }
}

const serializePathPrimitive = (parsed: ParsedPath, value: Primitive): string => {
  const encoded = encodeURIComponent(String(value))

  if (parsed.style === "matrix") {
    return withStylePrefix("matrix", serializePrimitiveParam(parsed.name, String(value)))
  }

  if (parsed.style === "label") {
    return withStylePrefix("label", encoded)
  }

  return encoded
}

const serializePathValue = (parsed: ParsedPath, value: unknown): string | undefined => {
  if (isPrimitive(value)) {
    return serializePathPrimitive(parsed, value)
  }

  if (isPrimitiveArray(value)) {
    return serializeArrayParam(parsed.name, value, {
      style: parsed.style,
      explode: parsed.explode
    })
  }

  if (isPrimitiveRecord(value)) {
    return serializeObjectParam(parsed.name, value, {
      style: parsed.style,
      explode: parsed.explode
    })
  }

  return undefined
}

/** Handle OpenAPI path serialization styles */
export const defaultPathSerializer = (pathname: string, pathParams: Record<string, unknown>): string => {
  let nextURL = pathname

  for (const match of pathname.match(PATH_PARAM_RE) ?? []) {
    const token = match.slice(1, -1)
    const parsed = parsePathToken(token)
    const replacement = serializePathValue(parsed, pathParams[parsed.name])

    if (replacement !== undefined) {
      nextURL = nextURL.replace(match, replacement)
    }
  }

  return nextURL
}
