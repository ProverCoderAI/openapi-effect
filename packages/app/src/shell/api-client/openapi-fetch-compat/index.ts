// CHANGE: openapi-fetch compatible surface exported from openapi-effect
// WHY: Consumers must be able to swap `openapi-fetch` -> `openapi-effect` with near-zero code changes
// NOTE: Promise-based API is intentional (drop-in). Effect is used internally and via opt-in APIs.

import type { MediaType } from "openapi-typescript-helpers"
import { createClient } from "./create-client.js"
import { wrapAsPathBasedClient } from "./path-based.js"
import type { ClientOptions, PathBasedClient } from "./types.js"

export { createClient, default } from "./create-client.js"
export type * from "./types.js"

export {
  createFinalURL,
  createQuerySerializer,
  defaultBodySerializer,
  defaultPathSerializer,
  mergeHeaders,
  removeTrailingSlash,
  serializeArrayParam,
  serializeObjectParam,
  serializePrimitiveParam
} from "./serialize.js"

export { wrapAsPathBasedClient } from "./path-based.js"

export const createPathBasedClient = <Paths extends {}, Media extends MediaType = MediaType>(
  clientOptions?: ClientOptions
): PathBasedClient<Paths, Media> => {
  return wrapAsPathBasedClient(createClient<Paths, Media>(clientOptions)) as any
}
