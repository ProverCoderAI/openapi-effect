// CHANGE: Type-level tests proving literal union preservation for status codes
// WHY: Verify status types don't degrade to 'number' - requirement from blocking review
// QUOTE(ТЗ): "expectTypeOf<A["status"]>().toEqualTypeOf<200>()" and "@ts-expect-error" tests
// REF: PR#3 blocking review sections 3.1, 3.2
// SOURCE: n/a
// PURITY: CORE - compile-time tests only
// EFFECT: none - type assertions at compile time
// INVARIANT: status is literal union, not number

import { describe, expectTypeOf, it } from "vitest"

import type {
  ApiFailure,
  ApiSuccess,
  HttpError,
  TransportError,
  UnexpectedStatus,
  UnexpectedContentType,
  ParseError,
  DecodeError
} from "../../src/core/api-client/strict-types.js"
import type { Operations } from "../fixtures/petstore.openapi.js"

// Response types for each operation
type ListPetsResponses = Operations["listPets"]["responses"]
type CreatePetResponses = Operations["createPet"]["responses"]
type GetPetResponses = Operations["getPet"]["responses"]
type DeletePetResponses = Operations["deletePet"]["responses"]

// =============================================================================
// SECTION 3.1: Type tests for literal union preservation (from review)
// =============================================================================

describe("3.1: GET returns only 2xx in success channel with literal status", () => {
  it("listPets: success status is exactly 200 (not number)", () => {
    // For listPets, only 200 is a success status
    type Success = ApiSuccess<ListPetsResponses>

    // Status should be exactly 200, not 'number'
    expectTypeOf<Success["status"]>().toEqualTypeOf<200>()
  })

  it("getPet: success status is exactly 200 (not number)", () => {
    type Success = ApiSuccess<GetPetResponses>
    expectTypeOf<Success["status"]>().toEqualTypeOf<200>()
  })

  it("createPet: success status is exactly 201 (not number)", () => {
    type Success = ApiSuccess<CreatePetResponses>
    expectTypeOf<Success["status"]>().toEqualTypeOf<201>()
  })

  it("deletePet: success status is exactly 204 (not number)", () => {
    type Success = ApiSuccess<DeletePetResponses>
    expectTypeOf<Success["status"]>().toEqualTypeOf<204>()
  })
})

describe("3.1: HttpError status is literal union from schema", () => {
  it("getPet: HttpError status is 404 | 500 (not number)", () => {
    type ErrorType = HttpError<GetPetResponses>
    // getPet has 404 and 500 as error responses
    expectTypeOf<ErrorType["status"]>().toEqualTypeOf<404 | 500>()
  })

  it("createPet: HttpError status is 400 | 500 (not number)", () => {
    type ErrorType = HttpError<CreatePetResponses>
    // createPet has 400 and 500 as error responses
    expectTypeOf<ErrorType["status"]>().toEqualTypeOf<400 | 500>()
  })

  it("listPets: HttpError status is 500 (not number)", () => {
    type ErrorType = HttpError<ListPetsResponses>
    // listPets only has 500 as error response
    expectTypeOf<ErrorType["status"]>().toEqualTypeOf<500>()
  })

  it("deletePet: HttpError status is 404 | 500 (not number)", () => {
    type ErrorType = HttpError<DeletePetResponses>
    expectTypeOf<ErrorType["status"]>().toEqualTypeOf<404 | 500>()
  })
})

describe("3.1: HttpError has _tag discriminator", () => {
  it("HttpError._tag is literal 'HttpError'", () => {
    type ErrorType = HttpError<GetPetResponses>
    expectTypeOf<ErrorType["_tag"]>().toEqualTypeOf<"HttpError">()
  })
})

// =============================================================================
// SECTION 3.2: Negative @ts-expect-error tests (from review)
// =============================================================================

describe("3.2: Negative tests - success status cannot be error status", () => {
  it("success status cannot be 404", () => {
    type Success = ApiSuccess<GetPetResponses>

    // @ts-expect-error - 404 is not a valid success status for getPet
    const _bad404: 404 = null as unknown as Success["status"]
    void _bad404
  })

  it("success status cannot be 500", () => {
    type Success = ApiSuccess<GetPetResponses>

    // @ts-expect-error - 500 is not a valid success status
    const _bad500: 500 = null as unknown as Success["status"]
    void _bad500
  })

  it("success status cannot be 400", () => {
    type Success = ApiSuccess<CreatePetResponses>

    // @ts-expect-error - 400 is not a valid success status for createPet
    const _bad400: 400 = null as unknown as Success["status"]
    void _bad400
  })

  it("listPets success status cannot be 500", () => {
    type Success = ApiSuccess<ListPetsResponses>

    // @ts-expect-error - 500 is not a valid success status for listPets
    const _bad: 500 = null as unknown as Success["status"]
    void _bad
  })
})

describe("3.2: Negative tests - error status cannot be success status", () => {
  it("HttpError status cannot be 200 for getPet", () => {
    type ErrorType = HttpError<GetPetResponses>

    // @ts-expect-error - 200 is not in HttpError for getPet
    const _bad200: 200 = null as unknown as ErrorType["status"]
    void _bad200
  })

  it("HttpError status cannot be 201 for createPet", () => {
    type ErrorType = HttpError<CreatePetResponses>

    // @ts-expect-error - 201 is not in HttpError for createPet
    const _bad201: 201 = null as unknown as ErrorType["status"]
    void _bad201
  })
})

// =============================================================================
// SECTION: ApiFailure includes HttpError and BoundaryError
// =============================================================================

describe("ApiFailure type structure", () => {
  it("ApiFailure is union of HttpError and BoundaryError", () => {
    type Failure = ApiFailure<GetPetResponses>

    // Should include HttpError
    expectTypeOf<HttpError<GetPetResponses>>().toMatchTypeOf<Failure>()

    // Should include all BoundaryError variants
    expectTypeOf<TransportError>().toMatchTypeOf<Failure>()
    expectTypeOf<UnexpectedStatus>().toMatchTypeOf<Failure>()
    expectTypeOf<UnexpectedContentType>().toMatchTypeOf<Failure>()
    expectTypeOf<ParseError>().toMatchTypeOf<Failure>()
    expectTypeOf<DecodeError>().toMatchTypeOf<Failure>()
  })

  it("BoundaryError has all required _tag discriminators", () => {
    expectTypeOf<TransportError["_tag"]>().toEqualTypeOf<"TransportError">()
    expectTypeOf<UnexpectedStatus["_tag"]>().toEqualTypeOf<"UnexpectedStatus">()
    expectTypeOf<UnexpectedContentType["_tag"]>().toEqualTypeOf<"UnexpectedContentType">()
    expectTypeOf<ParseError["_tag"]>().toEqualTypeOf<"ParseError">()
    expectTypeOf<DecodeError["_tag"]>().toEqualTypeOf<"DecodeError">()
  })

  it("TransportError has message via error.message", () => {
    // Reviewer requirement: TransportError should have message
    expectTypeOf<TransportError["error"]>().toMatchTypeOf<Error>()
  })
})

// =============================================================================
// SECTION: Body type correlation (status -> body mapping)
// =============================================================================

describe("Body type correlation", () => {
  it("200 success body is correct type for getPet", () => {
    type Success = ApiSuccess<GetPetResponses>
    // Body should be Pet type (with id, name, optional tag)
    type Body = Success["body"]

    // Verify body structure matches schema
    expectTypeOf<Body>().toMatchTypeOf<{ id: string; name: string; tag?: string }>()
  })

  it("404 error body is Error type for getPet", () => {
    type ErrorType = HttpError<GetPetResponses>
    // 404 body should be Error type (with code, message)
    type Body = ErrorType["body"]

    // Verify error body structure
    expectTypeOf<Body>().toMatchTypeOf<{ code: number; message: string }>()
  })

  it("listPets 200 body is array of pets", () => {
    type Success = ApiSuccess<ListPetsResponses>
    type Body = Success["body"]

    // Body should be array
    expectTypeOf<Body>().toMatchTypeOf<Array<{ id: string; name: string; tag?: string }>>()
  })
})

// =============================================================================
// SECTION: ContentType correlation
// =============================================================================

describe("ContentType correlation", () => {
  it("JSON responses have 'application/json' contentType", () => {
    type Success = ApiSuccess<GetPetResponses>
    expectTypeOf<Success["contentType"]>().toEqualTypeOf<"application/json">()
  })

  it("204 no-content has 'none' contentType", () => {
    type Success = ApiSuccess<DeletePetResponses>
    expectTypeOf<Success["contentType"]>().toEqualTypeOf<"none">()
  })
})
