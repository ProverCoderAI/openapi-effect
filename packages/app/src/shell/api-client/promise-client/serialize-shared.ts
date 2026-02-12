// CHANGE: Shared primitive guards for serializer modules
// WHY: Avoid duplicate guard logic across query/path serializers
// SOURCE: n/a
// PURITY: CORE helpers
// COMPLEXITY: O(n)

export type Primitive = string | number | boolean
export type PrimitiveRecord = Record<string, Primitive>

export const isPrimitive = (value: unknown): value is Primitive => {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
}

export const isPrimitiveArray = (value: unknown): value is ReadonlyArray<Primitive> => {
  return Array.isArray(value) && value.every((item) => isPrimitive(item))
}

export const isPrimitiveRecord = (value: unknown): value is PrimitiveRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every((item) => isPrimitive(item))
}
