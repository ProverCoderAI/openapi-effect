// CHANGE: Type-level tests proving literal union preservation and request-side constraints
// WHY: Verify types enforce all invariants - requirement from blocking review
// QUOTE(ТЗ): "expectTypeOf<A["status"]>().toEqualTypeOf<200>()" and "@ts-expect-error" tests
// REF: PR#3 blocking review sections 3.1, 3.2, 4.2
// SOURCE: n/a
// PURITY: CORE - compile-time tests only
// EFFECT: none - type assertions at compile time
// INVARIANT: status is literal union, not number; path/method constraints enforced

import { describe, expectTypeOf, it } from "vitest"

import type {
  ApiFailure,
  ApiSuccess,
  DecodeError,
  HttpError,
  Is2xx,
  ParseError,
  PathsForMethod,
  TransportError,
  UnexpectedContentType,
  UnexpectedStatus
} from "../../src/core/api-client/strict-types.js"
import type { CustomOperations } from "../fixtures/custom-2xx.openapi.js"
import type { Operations, Paths } from "../fixtures/petstore.openapi.js"

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
// SECTION 3.2: Negative tests - success status cannot be error status
// Using expectTypeOf().not.toExtend() instead of @ts-expect-error
// =============================================================================

describe("3.2: Negative tests - success status cannot be error status", () => {
  it("success status cannot be 404", () => {
    type Success = ApiSuccess<GetPetResponses>

    // 404 is not a valid success status for getPet
    expectTypeOf<404>().not.toExtend<Success["status"]>()
  })

  it("success status cannot be 500", () => {
    type Success = ApiSuccess<GetPetResponses>

    // 500 is not a valid success status
    expectTypeOf<500>().not.toExtend<Success["status"]>()
  })

  it("success status cannot be 400", () => {
    type Success = ApiSuccess<CreatePetResponses>

    // 400 is not a valid success status for createPet
    expectTypeOf<400>().not.toExtend<Success["status"]>()
  })

  it("listPets success status cannot be 500", () => {
    type Success = ApiSuccess<ListPetsResponses>

    // 500 is not a valid success status for listPets
    expectTypeOf<500>().not.toExtend<Success["status"]>()
  })
})

describe("3.2: Negative tests - error status cannot be success status", () => {
  it("HttpError status cannot be 200 for getPet", () => {
    type ErrorType = HttpError<GetPetResponses>

    // 200 is not in HttpError for getPet
    expectTypeOf<200>().not.toExtend<ErrorType["status"]>()
  })

  it("HttpError status cannot be 201 for createPet", () => {
    type ErrorType = HttpError<CreatePetResponses>

    // 201 is not in HttpError for createPet
    expectTypeOf<201>().not.toExtend<ErrorType["status"]>()
  })
})

// =============================================================================
// SECTION: ApiFailure includes HttpError and BoundaryError
// =============================================================================

describe("ApiFailure type structure", () => {
  it("ApiFailure is union of HttpError and BoundaryError", () => {
    type Failure = ApiFailure<GetPetResponses>

    // Should include HttpError
    expectTypeOf<HttpError<GetPetResponses>>().toExtend<Failure>()

    // Should include all BoundaryError variants
    expectTypeOf<TransportError>().toExtend<Failure>()
    expectTypeOf<UnexpectedStatus>().toExtend<Failure>()
    expectTypeOf<UnexpectedContentType>().toExtend<Failure>()
    expectTypeOf<ParseError>().toExtend<Failure>()
    expectTypeOf<DecodeError>().toExtend<Failure>()
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
    expectTypeOf<TransportError["error"]>().toExtend<Error>()
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
    expectTypeOf<Body>().toExtend<{ id: string; name: string; tag?: string }>()
  })

  it("404 error body is Error type for getPet", () => {
    type ErrorType = HttpError<GetPetResponses>
    // 404 body should be Error type (with code, message)
    type Body = ErrorType["body"]

    // Verify error body structure
    expectTypeOf<Body>().toExtend<{ code: number; message: string }>()
  })

  it("listPets 200 body is array of pets", () => {
    type Success = ApiSuccess<ListPetsResponses>
    type Body = Success["body"]

    // Body should be array
    expectTypeOf<Body>().toExtend<Array<{ id: string; name: string; tag?: string }>>()
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

// =============================================================================
// SECTION 4.1: Is2xx generic type (no hardcoded status list)
// =============================================================================

describe("4.1: Is2xx generic type works without hardcoded status list", () => {
  it("Is2xx<200> = true", () => {
    expectTypeOf<Is2xx<200>>().toEqualTypeOf<true>()
  })

  it("Is2xx<201> = true", () => {
    expectTypeOf<Is2xx<201>>().toEqualTypeOf<true>()
  })

  it("Is2xx<204> = true", () => {
    expectTypeOf<Is2xx<204>>().toEqualTypeOf<true>()
  })

  it("Is2xx<250> = true (non-standard 2xx)", () => {
    // This proves no hardcoded 2xx list - 250 is recognized as 2xx
    expectTypeOf<Is2xx<250>>().toEqualTypeOf<true>()
  })

  it("Is2xx<299> = true (boundary)", () => {
    expectTypeOf<Is2xx<299>>().toEqualTypeOf<true>()
  })

  it("Is2xx<400> = false", () => {
    expectTypeOf<Is2xx<400>>().toEqualTypeOf<false>()
  })

  it("Is2xx<404> = false", () => {
    expectTypeOf<Is2xx<404>>().toEqualTypeOf<false>()
  })

  it("Is2xx<500> = false", () => {
    expectTypeOf<Is2xx<500>>().toEqualTypeOf<false>()
  })

  it("Is2xx<100> = false (1xx)", () => {
    expectTypeOf<Is2xx<100>>().toEqualTypeOf<false>()
  })

  it("Is2xx<300> = false (3xx)", () => {
    expectTypeOf<Is2xx<300>>().toEqualTypeOf<false>()
  })
})

// =============================================================================
// SECTION 4.2: Request-side constraints (path/method enforcement)
// =============================================================================

describe("4.2: PathsForMethod constrains valid paths", () => {
  it("PathsForMethod for GET includes /pets and /pets/{petId}", () => {
    // Both /pets and /pets/{petId} have GET methods
    type GetPaths = PathsForMethod<Paths, "get">

    // Should include both paths
    expectTypeOf<"/pets">().toExtend<GetPaths>()
    expectTypeOf<"/pets/{petId}">().toExtend<GetPaths>()
  })

  it("PathsForMethod for POST includes only /pets", () => {
    // Only /pets has POST method
    type PostPaths = PathsForMethod<Paths, "post">

    expectTypeOf<"/pets">().toExtend<PostPaths>()
  })

  it("PathsForMethod for DELETE includes only /pets/{petId}", () => {
    // Only /pets/{petId} has DELETE method
    type DeletePaths = PathsForMethod<Paths, "delete">

    expectTypeOf<"/pets/{petId}">().toExtend<DeletePaths>()
  })

  it("/pets does NOT have DELETE method", () => {
    type DeletePaths = PathsForMethod<Paths, "delete">

    // /pets does not have delete method
    expectTypeOf<"/pets">().not.toExtend<DeletePaths>()
  })

  it("/pets/{petId} does NOT have POST method", () => {
    type PostPaths = PathsForMethod<Paths, "post">

    // /pets/{petId} does not have post method
    expectTypeOf<"/pets/{petId}">().not.toExtend<PostPaths>()
  })

  it("PathsForMethod for PUT is never (no PUT in schema)", () => {
    // No paths have PUT method in petstore schema
    type PutPaths = PathsForMethod<Paths, "put">

    expectTypeOf<PutPaths>().toEqualTypeOf<never>()
  })
})

// =============================================================================
// SECTION 4.3: Non-standard 2xx status (250) is treated as success
// This proves Is2xx is generic and doesn't hardcode standard statuses
// =============================================================================

describe("4.3: Schema with non-standard 250 status", () => {
  // This type represents a schema where 250 is a success status
  type CustomGetResponses = CustomOperations["customGet"]["responses"]

  it("250 is treated as success status (not error)", () => {
    // ApiSuccess should include 250 because Is2xx<250> = true
    type Success = ApiSuccess<CustomGetResponses>

    // Status should be exactly 250
    expectTypeOf<Success["status"]>().toEqualTypeOf<250>()
  })

  it("250 success body has correct type", () => {
    type Success = ApiSuccess<CustomGetResponses>
    type Body = Success["body"]

    // Body should be CustomResponse type
    expectTypeOf<Body>().toExtend<{ message: string }>()
  })

  it("400 is treated as error status", () => {
    type ErrorType = HttpError<CustomGetResponses>

    // Only 400 should be in error channel
    expectTypeOf<ErrorType["status"]>().toEqualTypeOf<400>()
  })

  it("250 is NOT in HttpError", () => {
    type ErrorType = HttpError<CustomGetResponses>

    // 250 is success, not error
    expectTypeOf<250>().not.toExtend<ErrorType["status"]>()
  })
})
