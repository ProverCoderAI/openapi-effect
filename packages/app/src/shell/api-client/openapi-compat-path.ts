import { serializeArrayParam, serializeObjectParam, serializePrimitiveParam } from "./openapi-compat-serializers.js"
import { isPrimitive, isRecord } from "./openapi-compat-value-guards.js"

const PATH_PARAM_RE = /\{[^{}]+\}/g

type PathStyle = "simple" | "label" | "matrix"

type PathTokenMeta = {
  name: string
  explode: boolean
  style: PathStyle
}

const toPathTokenMeta = (rawName: string): PathTokenMeta => {
  let name = rawName
  let explode = false
  let style: PathStyle = "simple"

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

  return { name, explode, style }
}

const serializePathValue = (
  name: string,
  value: unknown,
  meta: PathTokenMeta
): string | undefined => {
  if (Array.isArray(value)) {
    return serializeArrayParam(name, value, { style: meta.style, explode: meta.explode })
  }

  if (isRecord(value)) {
    return serializeObjectParam(name, value, { style: meta.style, explode: meta.explode })
  }

  if (!isPrimitive(value)) {
    return
  }

  if (meta.style === "matrix") {
    return `;${serializePrimitiveParam(name, value)}`
  }

  const encoded = encodeURIComponent(String(value))
  return meta.style === "label" ? `.${encoded}` : encoded
}

export const defaultPathSerializer = (
  pathname: string,
  pathParams: Record<string, unknown>
): string => {
  let nextURL = pathname

  for (const match of pathname.match(PATH_PARAM_RE) ?? []) {
    const rawName = match.slice(1, -1)
    const meta = toPathTokenMeta(rawName)
    const value = pathParams[meta.name]

    if (value === undefined || value === null) {
      continue
    }

    const serializedValue = serializePathValue(meta.name, value, meta)
    if (serializedValue !== undefined) {
      nextURL = nextURL.replace(match, serializedValue)
    }
  }

  return nextURL
}
