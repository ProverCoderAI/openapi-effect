// CHANGE: Auto-generated dispatchers for all operations
// WHY: Maintain compile-time correlation between status codes and body types
// QUOTE(ТЗ): "реализует switch(status) по всем статусам схемы"
// REF: issue-2, section 5.2
// SOURCE: Generated from tests/fixtures/petstore.openapi.json
// FORMAT THEOREM: ∀ op ∈ Operations: dispatcher(op) handles all statuses in schema
// PURITY: SHELL
// EFFECT: Effect<Success | HttpError, BoundaryError, never>
// INVARIANT: Exhaustive coverage of all schema statuses and content-types
// COMPLEXITY: O(1) per dispatch (switch lookup)

import { Effect } from "effect"
import { createDispatcher, parseJSON, unexpectedContentType, unexpectedStatus } from "../shell/api-client/strict-client.js"
import * as Decoders from "./decoders.js"

/**
 * Dispatcher for listPets
 * Handles statuses: 200, 500
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatcherlistPets = createDispatcher((status, contentType, text) => {
    switch (status) {
        case 200:
            if (contentType?.includes("application/json")) {
                return Effect.gen(function*() {
                    const parsed = yield* parseJSON(status, "application/json", text)
                    const decoded = yield* Decoders.decodelistPets_200(status, "application/json", text, parsed)
                    return {
                        status: 200,
                        contentType: "application/json" as const,
                        body: decoded
                    } as const
                })
            }
            return Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))
        case 500:
            if (contentType?.includes("application/json")) {
                return Effect.gen(function*() {
                    const parsed = yield* parseJSON(status, "application/json", text)
                    const decoded = yield* Decoders.decodelistPets_500(status, "application/json", text, parsed)
                    return {
                        status: 500,
                        contentType: "application/json" as const,
                        body: decoded
                    } as const
                })
            }
            return Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))
        default:
            return Effect.fail(unexpectedStatus(status, text))
    }
})

/**
 * Dispatcher for createPet
 * Handles statuses: 201, 400, 500
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatchercreatePet = createDispatcher((status, contentType, text) => {
    switch (status) {
        case 201:
            if (contentType?.includes("application/json")) {
                return Effect.gen(function*() {
                    const parsed = yield* parseJSON(status, "application/json", text)
                    const decoded = yield* Decoders.decodecreatePet_201(status, "application/json", text, parsed)
                    return {
                        status: 201,
                        contentType: "application/json" as const,
                        body: decoded
                    } as const
                })
            }
            return Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))
        case 400:
            if (contentType?.includes("application/json")) {
                return Effect.gen(function*() {
                    const parsed = yield* parseJSON(status, "application/json", text)
                    const decoded = yield* Decoders.decodecreatePet_400(status, "application/json", text, parsed)
                    return {
                        status: 400,
                        contentType: "application/json" as const,
                        body: decoded
                    } as const
                })
            }
            return Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))
        case 500:
            if (contentType?.includes("application/json")) {
                return Effect.gen(function*() {
                    const parsed = yield* parseJSON(status, "application/json", text)
                    const decoded = yield* Decoders.decodecreatePet_500(status, "application/json", text, parsed)
                    return {
                        status: 500,
                        contentType: "application/json" as const,
                        body: decoded
                    } as const
                })
            }
            return Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))
        default:
            return Effect.fail(unexpectedStatus(status, text))
    }
})

/**
 * Dispatcher for getPet
 * Handles statuses: 200, 404, 500
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatchergetPet = createDispatcher((status, contentType, text) => {
    switch (status) {
        case 200:
            if (contentType?.includes("application/json")) {
                return Effect.gen(function*() {
                    const parsed = yield* parseJSON(status, "application/json", text)
                    const decoded = yield* Decoders.decodegetPet_200(status, "application/json", text, parsed)
                    return {
                        status: 200,
                        contentType: "application/json" as const,
                        body: decoded
                    } as const
                })
            }
            return Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))
        case 404:
            if (contentType?.includes("application/json")) {
                return Effect.gen(function*() {
                    const parsed = yield* parseJSON(status, "application/json", text)
                    const decoded = yield* Decoders.decodegetPet_404(status, "application/json", text, parsed)
                    return {
                        status: 404,
                        contentType: "application/json" as const,
                        body: decoded
                    } as const
                })
            }
            return Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))
        case 500:
            if (contentType?.includes("application/json")) {
                return Effect.gen(function*() {
                    const parsed = yield* parseJSON(status, "application/json", text)
                    const decoded = yield* Decoders.decodegetPet_500(status, "application/json", text, parsed)
                    return {
                        status: 500,
                        contentType: "application/json" as const,
                        body: decoded
                    } as const
                })
            }
            return Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))
        default:
            return Effect.fail(unexpectedStatus(status, text))
    }
})

/**
 * Dispatcher for deletePet
 * Handles statuses: 204, 404, 500
 *
 * @pure false - applies decoders
 * @invariant Exhaustive coverage of all schema statuses
 */
export const dispatcherdeletePet = createDispatcher((status, contentType, text) => {
    switch (status) {
        case 204:
            return Effect.succeed({
                status: 204,
                contentType: "none" as const,
                body: undefined as void
            } as const)
        case 404:
            if (contentType?.includes("application/json")) {
                return Effect.gen(function*() {
                    const parsed = yield* parseJSON(status, "application/json", text)
                    const decoded = yield* Decoders.decodedeletePet_404(status, "application/json", text, parsed)
                    return {
                        status: 404,
                        contentType: "application/json" as const,
                        body: decoded
                    } as const
                })
            }
            return Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))
        case 500:
            if (contentType?.includes("application/json")) {
                return Effect.gen(function*() {
                    const parsed = yield* parseJSON(status, "application/json", text)
                    const decoded = yield* Decoders.decodedeletePet_500(status, "application/json", text, parsed)
                    return {
                        status: 500,
                        contentType: "application/json" as const,
                        body: decoded
                    } as const
                })
            }
            return Effect.fail(unexpectedContentType(status, ["application/json"], contentType, text))
        default:
            return Effect.fail(unexpectedStatus(status, text))
    }
})
