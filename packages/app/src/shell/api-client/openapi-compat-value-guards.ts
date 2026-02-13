export type Primitive = string | number | boolean

export const isPrimitive = (value: unknown): value is Primitive => (
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
)

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === "object" && !Array.isArray(value)
)
