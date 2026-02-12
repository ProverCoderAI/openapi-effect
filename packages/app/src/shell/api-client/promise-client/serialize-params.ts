// CHANGE: Query/path serialization helpers for promise-compatible client
// WHY: Keep openapi-fetch-compatible URL behavior with lint-clean small functions
// SOURCE: behavior aligned with openapi-fetch@0.15.x (MIT)
// PURITY: CORE helpers
// COMPLEXITY: O(n)

import {
  isPrimitive,
  isPrimitiveArray,
  isPrimitiveRecord,
  type Primitive,
  type PrimitiveRecord
} from "./serialize-shared.js"
import type { QuerySerializer, QuerySerializerOptions } from "./types.js"

type PathStyle = "simple" | "label" | "matrix"
type ObjectStyle = PathStyle | "form" | "deepObject"
type ArrayStyle = PathStyle | "form" | "spaceDelimited" | "pipeDelimited"
type Encoder = (value: string) => string

type ObjectSerializeOptions = {
  style: ObjectStyle
  explode: boolean
  allowReserved?: boolean
}

type ArraySerializeOptions = {
  style: ArrayStyle
  explode: boolean
  allowReserved?: boolean
}

const passthroughEncoder: Encoder = (value) => value
const urlEncoder: Encoder = (value) => encodeURIComponent(value)

const objectJoiners: Record<ObjectStyle, string> = {
  simple: ",",
  label: ".",
  matrix: ";",
  form: "&",
  deepObject: "&"
}

const collapsedArrayJoiners: Record<ArrayStyle, string> = {
  simple: ",",
  label: ",",
  matrix: ",",
  form: ",",
  spaceDelimited: "%20",
  pipeDelimited: "|"
}

const explodedArrayJoiners: Record<ArrayStyle, string> = {
  simple: ",",
  label: ".",
  matrix: ";",
  form: "&",
  spaceDelimited: "&",
  pipeDelimited: "&"
}

const resolveEncoder = (options: { allowReserved?: boolean } | undefined): Encoder => {
  return options?.allowReserved === true ? passthroughEncoder : urlEncoder
}

function withAllowReserved(
  options: Omit<ArraySerializeOptions, "allowReserved">,
  allowReserved: boolean | undefined
): ArraySerializeOptions
function withAllowReserved(
  options: Omit<ObjectSerializeOptions, "allowReserved">,
  allowReserved: boolean | undefined
): ObjectSerializeOptions
function withAllowReserved(
  options: Omit<ArraySerializeOptions, "allowReserved"> | Omit<ObjectSerializeOptions, "allowReserved">,
  allowReserved: boolean | undefined
): ArraySerializeOptions | ObjectSerializeOptions {
  if (allowReserved === undefined) {
    return options
  }

  return { ...options, allowReserved }
}

const renderDottedOrMatrix = (name: string, style: PathStyle | ArrayStyle | ObjectStyle, packed: string): string => {
  if (style === "label") {
    return `.${packed}`
  }

  if (style === "matrix") {
    return `;${name}=${packed}`
  }

  return `${name}=${packed}`
}

const renderCollapsedObject = (name: string, style: ObjectStyle, packed: string): string => {
  if (style === "form") {
    return `${name}=${packed}`
  }

  if (style === "simple" || style === "deepObject") {
    return packed
  }

  return renderDottedOrMatrix(name, style, packed)
}

const renderCollapsedArray = (name: string, style: ArrayStyle, packed: string): string => {
  if (style === "simple") {
    return packed
  }

  return renderDottedOrMatrix(name, style, packed)
}

const serializePrimitiveWithEncoder = (name: string, value: Primitive, encoder: Encoder): string => {
  return `${name}=${encoder(String(value))}`
}

const serializeObjectCollapsed = (
  name: string,
  value: PrimitiveRecord,
  options: ObjectSerializeOptions,
  encoder: Encoder
): string => {
  const flattened = Object.entries(value).flatMap(([key, currentValue]) => [
    key,
    encoder(String(currentValue))
  ])

  return renderCollapsedObject(name, options.style, flattened.join(","))
}

const serializeObjectExploded = (
  name: string,
  value: PrimitiveRecord,
  options: ObjectSerializeOptions,
  encoder: Encoder
): string => {
  const entries = Object.entries(value).map(([key, currentValue]) => {
    const finalName = options.style === "deepObject" ? `${name}[${key}]` : key
    return serializePrimitiveWithEncoder(finalName, currentValue, encoder)
  })

  const joiner = objectJoiners[options.style]
  const joined = entries.join(joiner)
  return options.style === "label" || options.style === "matrix" ? `${joiner}${joined}` : joined
}

const serializeArrayCollapsed = (
  name: string,
  value: ReadonlyArray<Primitive>,
  options: ArraySerializeOptions,
  encoder: Encoder
): string => {
  const packed = value.map((item) => encoder(String(item))).join(collapsedArrayJoiners[options.style])
  return renderCollapsedArray(name, options.style, packed)
}

const serializeArrayExploded = (
  name: string,
  value: ReadonlyArray<Primitive>,
  options: ArraySerializeOptions,
  encoder: Encoder
): string => {
  const parts = value.map((item) => {
    if (options.style === "simple" || options.style === "label") {
      return encoder(String(item))
    }

    return serializePrimitiveWithEncoder(name, item, encoder)
  })

  const joiner = explodedArrayJoiners[options.style]
  const joined = parts.join(joiner)
  return options.style === "label" || options.style === "matrix" ? `${joiner}${joined}` : joined
}

const serializePrimitiveQuery = (
  name: string,
  rawValue: unknown,
  encoder: Encoder
): string | undefined => {
  return isPrimitive(rawValue) ? serializePrimitiveWithEncoder(name, rawValue, encoder) : undefined
}

const serializeArrayQuery = (
  name: string,
  rawValue: unknown,
  options: QuerySerializerOptions | undefined
): string | undefined => {
  if (!isPrimitiveArray(rawValue) || rawValue.length === 0) {
    return undefined
  }

  return serializeArrayParam(
    name,
    rawValue,
    withAllowReserved(
      {
        style: "form",
        explode: true,
        ...options?.array
      },
      options?.allowReserved
    )
  )
}

const serializeObjectQuery = (
  name: string,
  rawValue: unknown,
  options: QuerySerializerOptions | undefined
): string | undefined => {
  if (!isPrimitiveRecord(rawValue)) {
    return undefined
  }

  return serializeObjectParam(
    name,
    rawValue,
    withAllowReserved(
      {
        style: "deepObject",
        explode: true,
        ...options?.object
      },
      options?.allowReserved
    )
  )
}

const serializeQueryValue = (
  name: string,
  rawValue: unknown,
  options: QuerySerializerOptions | undefined
): string | undefined => {
  if (rawValue === undefined || rawValue === null) {
    return undefined
  }

  const encoder = resolveEncoder(options)
  const primitive = serializePrimitiveQuery(name, rawValue, encoder)
  if (primitive !== undefined) {
    return primitive
  }

  const serializedArray = serializeArrayQuery(name, rawValue, options)
  if (serializedArray !== undefined) {
    return serializedArray
  }

  return serializeObjectQuery(name, rawValue, options)
}

/** Serialize primitive params to string */
export const serializePrimitiveParam = (
  name: string,
  value: string,
  options?: { allowReserved?: boolean }
): string => {
  const encoder = resolveEncoder(options)
  return `${name}=${encoder(value)}`
}

/** Serialize object param to string */
export const serializeObjectParam = (
  name: string,
  value: PrimitiveRecord,
  options: ObjectSerializeOptions
): string => {
  const encoder = resolveEncoder(options)

  if (options.style === "deepObject" || options.explode) {
    return serializeObjectExploded(name, value, options, encoder)
  }

  return serializeObjectCollapsed(name, value, options, encoder)
}

/** Serialize array param to string */
export const serializeArrayParam = (
  name: string,
  value: ReadonlyArray<Primitive>,
  options: ArraySerializeOptions
): string => {
  const encoder = resolveEncoder(options)
  return options.explode
    ? serializeArrayExploded(name, value, options, encoder)
    : serializeArrayCollapsed(name, value, options, encoder)
}

/** Serialize query params to string */
export const createQuerySerializer = (
  options?: QuerySerializerOptions
): QuerySerializer<Record<string, unknown>> => {
  return (queryParams) => {
    return Object.entries(queryParams)
      .map(([name, rawValue]) => serializeQueryValue(name, rawValue, options))
      .filter((value): value is string => value !== undefined)
      .join("&")
  }
}
