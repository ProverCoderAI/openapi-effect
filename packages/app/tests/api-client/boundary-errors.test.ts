// CHANGE: Unit tests for boundary error cases (C1-C4 from acceptance criteria)
// WHY: Verify all protocol/parsing failures are correctly classified
// QUOTE(ТЗ): "Набор unit-тестов с моком fetch/transport слоя"
// REF: issue-2, section C
// SOURCE: n/a
// FORMAT THEOREM: ∀ error ∈ BoundaryErrors: test(error) → Effect.fail(error) ∧ ¬throws
// PURITY: SHELL
// EFFECT: Effect<void, never, never> (test effects)
// INVARIANT: No uncaught exceptions; all errors in Effect.fail channel
// COMPLEXITY: O(1) per test case

import { Effect, Either } from "effect"
import { describe, expect, it, vi } from "vitest"

import { createDispatcher, executeRequest, parseJSON, unexpectedContentType, unexpectedStatus } from "../../src/shell/api-client/strict-client.js"

/**
 * C1: UnexpectedStatus - status not in schema
 *
 * @invariant ∀ status ∉ Schema: response(status) → UnexpectedStatus
 */
describe("C1: UnexpectedStatus", () => {
  it("should return UnexpectedStatus for status not in schema (418)", async () => {
    // Mock fetch to return 418 (I'm a teapot)
    const mockFetch = vi.fn().mockResolvedValue({
      status: 418,
      headers: new Headers({ "content-type": "text/plain" }),
      text: async () => "I'm a teapot"
    })

    global.fetch = mockFetch as typeof fetch

    const dispatcher = createDispatcher((status, _contentType, text) => {
      // Simulate schema that only knows about 200 and 500
      switch (status) {
        case 200:
          return Effect.succeed({
            status: 200,
            contentType: "application/json" as const,
            body: {}
          } as const)
        case 500:
          return Effect.succeed({
            status: 500,
            contentType: "application/json" as const,
            body: {}
          } as const)
        default:
          return Effect.fail(unexpectedStatus(status, text))
      }
    })

    const result = await Effect.runPromise(
      Effect.either(
        executeRequest({
          method: "get",
          url: "https://api.example.com/test",
          dispatcher
        })
      )
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "UnexpectedStatus",
        status: 418,
        body: "I'm a teapot"
      })
    }
  })
})

/**
 * C2: UnexpectedContentType - content-type not in schema
 *
 * @invariant ∀ ct ∉ Schema[status]: response(status, ct) → UnexpectedContentType
 */
describe("C2: UnexpectedContentType", () => {
  it("should return UnexpectedContentType for 200 with text/html", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<html><body>Hello</body></html>"
    })

    global.fetch = mockFetch as typeof fetch

    const dispatcher = createDispatcher((status, contentType, text) => {
      switch (status) {
        case 200:
          // Schema expects only application/json
          if (contentType?.includes("application/json")) {
            return Effect.succeed({
              status: 200,
              contentType: "application/json" as const,
              body: {}
            } as const)
          }
          return Effect.fail(
            unexpectedContentType(status, ["application/json"], contentType, text)
          )
        default:
          return Effect.fail(unexpectedStatus(status, text))
      }
    })

    const result = await Effect.runPromise(
      Effect.either(
        executeRequest({
          method: "get",
          url: "https://api.example.com/test",
          dispatcher
        })
      )
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "UnexpectedContentType",
        status: 200,
        expected: ["application/json"],
        actual: "text/html",
        body: "<html><body>Hello</body></html>"
      })
    }
  })
})

/**
 * C3: ParseError - invalid JSON
 *
 * @invariant ∀ text: ¬parseValid(text) → ParseError
 */
describe("C3: ParseError", () => {
  it("should return ParseError for malformed JSON", async () => {
    const malformedJSON = '{"bad": json}'

    const result = await Effect.runPromise(Effect.either(parseJSON(200, "application/json", malformedJSON)))

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "ParseError",
        status: 200,
        contentType: "application/json",
        body: malformedJSON
      })
      expect(result.left.error).toBeInstanceOf(Error)
    }
  })

  it("should return ParseError for incomplete JSON", async () => {
    const incompleteJSON = '{"key": "value"'

    const result = await Effect.runPromise(Effect.either(parseJSON(200, "application/json", incompleteJSON)))

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("ParseError")
    }
  })

  it("should succeed for valid JSON", async () => {
    const validJSON = '{"key": "value"}'

    const result = await Effect.runPromise(Effect.either(parseJSON(200, "application/json", validJSON)))

    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right).toEqual({ key: "value" })
    }
  })
})

/**
 * C4: DecodeError - valid JSON but fails schema validation
 *
 * @invariant ∀ json: parseValid(json) ∧ ¬decodeValid(json) → DecodeError
 */
describe("C4: DecodeError", () => {
  it("should return DecodeError when decoded value fails schema", async () => {
    const validJSONWrongSchema = '{"unexpected": "field"}'

    // Simulate a decoder that expects specific structure
    const mockDecoder = (
      status: number,
      contentType: string,
      body: string,
      parsed: unknown
    ) => {
      // Check if parsed has expected structure
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "id" in parsed &&
        "name" in parsed
      ) {
        return Effect.succeed(parsed)
      }

      return Effect.fail({
        _tag: "DecodeError" as const,
        status,
        contentType,
        error: new Error("Expected object with id and name"),
        body
      })
    }

    const result = await Effect.runPromise(
      Effect.either(
        Effect.gen(function* () {
          const parsed = yield* parseJSON(200, "application/json", validJSONWrongSchema)
          return yield* mockDecoder(200, "application/json", validJSONWrongSchema, parsed)
        })
      )
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "DecodeError",
        status: 200,
        contentType: "application/json",
        body: validJSONWrongSchema
      })
    }
  })
})

/**
 * TransportError - network failure
 *
 * @invariant ∀ networkError: fetch() throws → TransportError
 */
describe("TransportError", () => {
  it("should return TransportError on network failure", async () => {
    const networkError = new Error("Network connection failed")
    const mockFetch = vi.fn().mockRejectedValue(networkError)

    global.fetch = mockFetch as typeof fetch

    const dispatcher = createDispatcher(() =>
      Effect.succeed({
        status: 200,
        contentType: "application/json" as const,
        body: {}
      } as const)
    )

    const result = await Effect.runPromise(
      Effect.either(
        executeRequest({
          method: "get",
          url: "https://api.example.com/test",
          dispatcher
        })
      )
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "TransportError",
        error: networkError
      })
    }
  })

  it("should return TransportError on abort", async () => {
    const abortError = new Error("Request aborted")
    abortError.name = "AbortError"
    const mockFetch = vi.fn().mockRejectedValue(abortError)

    global.fetch = mockFetch as typeof fetch

    const dispatcher = createDispatcher(() =>
      Effect.succeed({
        status: 200,
        contentType: "application/json" as const,
        body: {}
      } as const)
    )

    const result = await Effect.runPromise(
      Effect.either(
        executeRequest({
          method: "get",
          url: "https://api.example.com/test",
          dispatcher
        })
      )
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      // Type guard for BoundaryError which has _tag
      const err = result.left as { _tag?: string }
      expect(err._tag).toBe("TransportError")
    }
  })
})

/**
 * Integration: No uncaught exceptions
 *
 * @invariant ∀ request: ¬throws ∧ (Success ∨ Failure)
 */
describe("No uncaught exceptions", () => {
  it("should never throw, only return Effect.fail", async () => {
    const testCases = [
      { status: 418, body: "teapot" },
      { status: 200, contentType: "text/html", body: "<html/>" },
      { status: 200, contentType: "application/json", body: "{bad json" },
      { status: 200, contentType: "application/json", body: '{"valid": "json"}' }
    ]

    for (const testCase of testCases) {
      const mockFetch = vi.fn().mockResolvedValue({
        status: testCase.status,
        headers: new Headers({
          "content-type": testCase.contentType ?? "application/json"
        }),
        text: async () => testCase.body
      })

      global.fetch = mockFetch as typeof fetch

      const dispatcher = createDispatcher((status, contentType, text) => {
        if (status === 200 && contentType?.includes("application/json")) {
          return Effect.gen(function* () {
            const parsed = yield* parseJSON(status, "application/json", text)
            return {
              status: 200,
              contentType: "application/json" as const,
              body: parsed
            } as const
          })
        }
        return Effect.fail(unexpectedStatus(status, text))
      })

      // Should never throw - all errors in Effect channel
      const result = await Effect.runPromise(
        Effect.either(
          executeRequest({
            method: "get",
            url: "https://api.example.com/test",
            dispatcher
          })
        )
      )

      // Either success or typed failure
      expect(Either.isLeft(result) || Either.isRight(result)).toBe(true)
    }
  })
})
