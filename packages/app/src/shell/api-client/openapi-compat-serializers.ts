import type { QuerySerializer, QuerySerializerOptions } from "./create-client-types.js"
import { isPrimitive, isRecord, type Primitive } from "./openapi-compat-value-guards.js"

type PathStyle = "simple" | "label" | "matrix"
type ObjectParamStyle = PathStyle | "form" | "deepObject"
type ArrayParamStyle = PathStyle | "form" | "spaceDelimited" | "pipeDelimited"

const OBJECT_JOINER_BY_STYLE: Readonly<Record<ObjectParamStyle, string>> = {
  simple: ",",
  label: ".",
  matrix: ";",
  form: "&",
  deepObject: "&"
}

const ARRAY_JOINER_BY_STYLE: Readonly<
  Record<ArrayParamStyle, { explodeFalse: string; explodeTrue: string }>
> = {
  simple: { explodeFalse: ",", explodeTrue: "," },
  label: { explodeFalse: ",", explodeTrue: "." },
  matrix: { explodeFalse: ",", explodeTrue: ";" },
  form: { explodeFalse: ",", explodeTrue: "&" },
  spaceDelimited: { explodeFalse: "%20", explodeTrue: "&" },
  pipeDelimited: { explodeFalse: "|", explodeTrue: "&" }
}

const encodeValue = (value: Primitive, allowReserved: boolean): string => (
  allowReserved ? String(value) : encodeURIComponent(String(value))
)

const formatExplodeFalse = (
  name: string,
  style: ObjectParamStyle | ArrayParamStyle,
  value: string
): string => {
  if (style === "simple") {
    return value
  }
  if (style === "label") {
    return `.${value}`
  }
  if (style === "matrix") {
    return `;${name}=${value}`
  }
  return `${name}=${value}`
}

const formatExplodeTrue = (
  style: ObjectParamStyle | ArrayParamStyle,
  joiner: string,
  value: string
): string => (
  style === "label" || style === "matrix" ? `${joiner}${value}` : value
)

const toPrimitiveList = (value: Array<unknown>): Array<Primitive> => {
  const items: Array<Primitive> = []
  for (const item of value) {
    if (isPrimitive(item)) {
      items.push(item)
    }
  }
  return items
}

const getQueryEntries = (queryParams: unknown): Array<[string, unknown]> => (
  isRecord(queryParams) ? Object.entries(queryParams) : []
)

const toObjectPairs = (
  name: string,
  value: Record<string, unknown>,
  allowReserved: boolean,
  explode: boolean,
  style: ObjectParamStyle
): Array<string> => {
  const entries: Array<string> = []

  for (const [key, rawValue] of Object.entries(value)) {
    if (!isPrimitive(rawValue)) {
      continue
    }

    if (!explode) {
      entries.push(key, encodeValue(rawValue, allowReserved))
      continue
    }

    const nextName = style === "deepObject" ? `${name}[${key}]` : key
    entries.push(
      serializePrimitiveParam(nextName, rawValue, {
        allowReserved
      })
    )
  }

  return entries
}

const toArrayValues = (
  name: string,
  value: Array<unknown>,
  style: ArrayParamStyle,
  allowReserved: boolean,
  explode: boolean
): Array<string> => {
  const entries: Array<string> = []

  for (const item of toPrimitiveList(value)) {
    if (explode && style !== "simple" && style !== "label") {
      entries.push(
        serializePrimitiveParam(name, item, {
          allowReserved
        })
      )
      continue
    }

    entries.push(encodeValue(item, allowReserved))
  }

  return entries
}

const finalizeSerializedParam = (options: {
  name: string
  style: ObjectParamStyle | ArrayParamStyle
  explode: boolean
  values: Array<string>
  joinerWhenExplodeFalse: string
  joinerWhenExplodeTrue: string
}): string => {
  const joiner = options.explode ? options.joinerWhenExplodeTrue : options.joinerWhenExplodeFalse
  const serializedValue = options.values.join(joiner)

  return options.explode
    ? formatExplodeTrue(options.style, options.joinerWhenExplodeTrue, serializedValue)
    : formatExplodeFalse(options.name, options.style, serializedValue)
}

export const serializePrimitiveParam = (
  name: string,
  value: Primitive,
  options?: { allowReserved?: boolean }
): string => (
  `${name}=${encodeValue(value, options?.allowReserved === true)}`
)

export const serializeObjectParam = (
  name: string,
  value: unknown,
  options: {
    style: ObjectParamStyle
    explode: boolean
    allowReserved?: boolean
  }
): string => {
  if (!isRecord(value)) {
    return ""
  }

  const pairs = toObjectPairs(
    name,
    value,
    options.allowReserved === true,
    options.explode,
    options.style
  )

  return finalizeSerializedParam({
    name,
    style: options.style,
    explode: options.explode,
    values: pairs,
    joinerWhenExplodeFalse: ",",
    joinerWhenExplodeTrue: OBJECT_JOINER_BY_STYLE[options.style]
  })
}

export const serializeArrayParam = (
  name: string,
  value: Array<unknown>,
  options: {
    style: ArrayParamStyle
    explode: boolean
    allowReserved?: boolean
  }
): string => {
  if (!Array.isArray(value)) {
    return ""
  }

  const values = toArrayValues(
    name,
    value,
    options.style,
    options.allowReserved === true,
    options.explode
  )

  return finalizeSerializedParam({
    name,
    style: options.style,
    explode: options.explode,
    values,
    joinerWhenExplodeFalse: ARRAY_JOINER_BY_STYLE[options.style].explodeFalse,
    joinerWhenExplodeTrue: ARRAY_JOINER_BY_STYLE[options.style].explodeTrue
  })
}

const serializeQueryEntry = (
  name: string,
  value: unknown,
  options?: QuerySerializerOptions
): string | undefined => {
  if (value === undefined || value === null) {
    return
  }

  return Array.isArray(value)
    ? serializeArrayQueryEntry(name, value, options)
    : serializeNonArrayQueryEntry(name, value, options)
}

const serializeArrayQueryEntry = (
  name: string,
  value: Array<unknown>,
  options?: QuerySerializerOptions
): string | undefined => {
  if (value.length === 0) {
    return
  }

  return serializeArrayParam(name, value, {
    style: "form",
    explode: true,
    ...options?.array,
    allowReserved: options?.allowReserved === true
  })
}

const serializeNonArrayQueryEntry = (
  name: string,
  value: unknown,
  options?: QuerySerializerOptions
): string | undefined => {
  if (isRecord(value)) {
    return serializeObjectParam(name, value, {
      style: "deepObject",
      explode: true,
      ...options?.object,
      allowReserved: options?.allowReserved === true
    })
  }

  if (isPrimitive(value)) {
    return serializePrimitiveParam(name, value, options)
  }

  return undefined
}

export const createQuerySerializer = <T = unknown>(
  options?: QuerySerializerOptions
): QuerySerializer<T> =>
(queryParams) => {
  const serialized: Array<string> = []

  for (const [name, value] of getQueryEntries(queryParams)) {
    const entry = serializeQueryEntry(name, value, options)
    if (entry !== undefined) {
      serialized.push(entry)
    }
  }

  return serialized.join("&")
}
