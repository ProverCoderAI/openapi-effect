// CHANGE: Promise-client compatibility entrypoint
// WHY: Keep openapi-fetch-compatible public API exported from openapi-effect
// PURITY: SHELL re-export module
// COMPLEXITY: O(1)

import type { MediaType } from "openapi-typescript-helpers"

import { createClient } from "./create-client.js"
import { wrapAsPathBasedClient } from "./path-based.js"
import type { ClientOptions, PathBasedClient } from "./types.js"

export { createClient, createClient as default } from "./create-client.js"
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
export type * from "./types.js"

export const createPathBasedClient = <Paths extends object, Media extends MediaType = MediaType>(
  clientOptions?: ClientOptions
): PathBasedClient<Paths, Media> => {
  return wrapAsPathBasedClient(createClient<Paths, Media>(clientOptions))
}
