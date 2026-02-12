// CHANGE: Serializer module split into focused helpers
// WHY: Keep openapi-fetch-compatible API while satisfying strict lint limits
// SOURCE: n/a
// PURITY: CORE (re-export)
// COMPLEXITY: O(1)

export {
  createFinalURL,
  createQuerySerializer,
  defaultBodySerializer,
  defaultPathSerializer,
  mergeHeaders,
  removeTrailingSlash
} from "./serialize-core.js"

export { serializeArrayParam, serializeObjectParam, serializePrimitiveParam } from "./serialize-params.js"
