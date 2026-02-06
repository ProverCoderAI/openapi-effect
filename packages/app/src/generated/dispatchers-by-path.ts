// CHANGE: Auto-generated dispatcher map by path+method
// WHY: Provide a single dispatcher registry without manual wiring in examples
// QUOTE(ТЗ): "Этого в плане вообще не должно быть"
// REF: user-msg-3
// SOURCE: Generated from tests/fixtures/petstore.openapi.json
// FORMAT THEOREM: ∀ path, method: dispatchersByPath[path][method] = dispatcher(op)
// PURITY: SHELL
// EFFECT: none
// INVARIANT: dispatcher map is total for all operations in Paths
// COMPLEXITY: O(1)

import type { Paths } from "../../tests/fixtures/petstore.openapi.js"
import { type DispatchersFor, registerDefaultDispatchers } from "../shell/api-client/create-client.js"
import { dispatchercreatePet, dispatcherdeletePet, dispatchergetPet, dispatcherlistPets } from "./dispatch.js"

/**
 * Dispatcher map keyed by OpenAPI path and HTTP method
 */
export const dispatchersByPath: DispatchersFor<Paths> = {
  "/pets": {
    get: dispatcherlistPets,
    post: dispatchercreatePet
  },
  "/pets/{petId}": {
    get: dispatchergetPet,
    delete: dispatcherdeletePet
  }
}

// CHANGE: Register default dispatchers at module load
// WHY: Enable createClient(options) without passing dispatcher map
// QUOTE(ТЗ): "const apiClient = createClient<Paths>(clientOptions)"
// REF: user-msg-4
// SOURCE: n/a
// FORMAT THEOREM: ∀ call: createClient(options) uses dispatchersByPath
// PURITY: SHELL
// EFFECT: none
// INVARIANT: registerDefaultDispatchers is called exactly once per module load
// COMPLEXITY: O(1)
registerDefaultDispatchers(dispatchersByPath)
