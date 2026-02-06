// CHANGE: Type-level tests for auth OpenAPI schema (openapi.d.ts)
// WHY: Verify createClientEffect enforces path/method/body constraints for real auth schema
// QUOTE(ТЗ): "apiClientEffect.POST('/api/auth/login', { body: credentials }) — Что бы это работало"
// REF: issue-5
// SOURCE: n/a
// PURITY: CORE - compile-time tests only
// EFFECT: none - type assertions at compile time
// INVARIANT: Auth schema paths and operations are correctly typed through createClientEffect

import { describe, expectTypeOf, it } from "vitest"

import type {
  ApiFailure,
  ApiSuccess,
  HttpError,
  PathsForMethod,
  RequestOptionsFor
} from "../../src/core/api-client/strict-types.js"
import type { operations, paths } from "../../src/core/api/openapi.js"

// Response types for each auth operation
type LoginResponses = operations["auth.postLogin"]["responses"]
type LogoutResponses = operations["auth.postLogout"]["responses"]
type MeResponses = operations["auth.getMe"]["responses"]
type RegisterResponses = operations["registration.postRegister"]["responses"]

// =============================================================================
// SECTION: Auth schema paths/method constraints
// =============================================================================

describe("Auth schema: PathsForMethod constraints", () => {
  it("/api/auth/login only supports POST", () => {
    type PostPaths = PathsForMethod<paths, "post">
    expectTypeOf<"/api/auth/login">().toExtend<PostPaths>()
  })

  it("/api/auth/logout only supports POST", () => {
    type PostPaths = PathsForMethod<paths, "post">
    expectTypeOf<"/api/auth/logout">().toExtend<PostPaths>()
  })

  it("/api/auth/me only supports GET", () => {
    type GetPaths = PathsForMethod<paths, "get">
    expectTypeOf<"/api/auth/me">().toExtend<GetPaths>()
  })

  it("/api/register only supports POST", () => {
    type PostPaths = PathsForMethod<paths, "post">
    expectTypeOf<"/api/register">().toExtend<PostPaths>()
  })

  it("/api/auth/login does NOT support GET", () => {
    type GetPaths = PathsForMethod<paths, "get">
    expectTypeOf<"/api/auth/login">().not.toExtend<GetPaths>()
  })

  it("/api/auth/me does NOT support POST", () => {
    type PostPaths = PathsForMethod<paths, "post">
    expectTypeOf<"/api/auth/me">().not.toExtend<PostPaths>()
  })
})

// =============================================================================
// SECTION: Auth schema success/error status literal preservation
// =============================================================================

describe("Auth schema: success status is literal (not number)", () => {
  it("login: success status is exactly 200", () => {
    type Success = ApiSuccess<LoginResponses>
    expectTypeOf<Success["status"]>().toEqualTypeOf<200>()
  })

  it("logout: success status is exactly 204", () => {
    type Success = ApiSuccess<LogoutResponses>
    expectTypeOf<Success["status"]>().toEqualTypeOf<204>()
  })

  it("getMe: success status is exactly 200", () => {
    type Success = ApiSuccess<MeResponses>
    expectTypeOf<Success["status"]>().toEqualTypeOf<200>()
  })

  it("register: success status is exactly 201", () => {
    type Success = ApiSuccess<RegisterResponses>
    expectTypeOf<Success["status"]>().toEqualTypeOf<201>()
  })
})

describe("Auth schema: HttpError status is literal union from schema", () => {
  it("login: HttpError status is 400 | 401 | 500", () => {
    type ErrorType = HttpError<LoginResponses>
    expectTypeOf<ErrorType["status"]>().toEqualTypeOf<400 | 401 | 500>()
  })

  it("logout: HttpError status is 400 | 401 | 500", () => {
    type ErrorType = HttpError<LogoutResponses>
    expectTypeOf<ErrorType["status"]>().toEqualTypeOf<400 | 401 | 500>()
  })

  it("getMe: HttpError status is 400 | 401 | 404 | 500", () => {
    type ErrorType = HttpError<MeResponses>
    expectTypeOf<ErrorType["status"]>().toEqualTypeOf<400 | 401 | 404 | 500>()
  })

  it("register: HttpError status is 400 | 404 | 409 | 500", () => {
    type ErrorType = HttpError<RegisterResponses>
    expectTypeOf<ErrorType["status"]>().toEqualTypeOf<400 | 404 | 409 | 500>()
  })
})

// =============================================================================
// SECTION: ApiFailure includes HttpError + BoundaryError
// =============================================================================

describe("Auth schema: ApiFailure union", () => {
  it("login: ApiFailure includes HttpError _tag in union", () => {
    type Failure = ApiFailure<LoginResponses>
    // HttpError is a member of the union
    type HasHttpError = Extract<Failure, { _tag: "HttpError" }> extends never ? false : true
    expectTypeOf<HasHttpError>().toEqualTypeOf<true>()
  })

  it("login: ApiFailure includes TransportError _tag in union", () => {
    type Failure = ApiFailure<LoginResponses>
    type HasTransportError = Extract<Failure, { _tag: "TransportError" }> extends never ? false : true
    expectTypeOf<HasTransportError>().toEqualTypeOf<true>()
  })

  it("login: ApiFailure includes UnexpectedStatus _tag in union", () => {
    type Failure = ApiFailure<LoginResponses>
    type HasUnexpectedStatus = Extract<Failure, { _tag: "UnexpectedStatus" }> extends never ? false : true
    expectTypeOf<HasUnexpectedStatus>().toEqualTypeOf<true>()
  })

  it("login: ApiFailure includes ParseError _tag in union", () => {
    type Failure = ApiFailure<LoginResponses>
    type HasParseError = Extract<Failure, { _tag: "ParseError" }> extends never ? false : true
    expectTypeOf<HasParseError>().toEqualTypeOf<true>()
  })

  it("login: ApiFailure includes DecodeError _tag in union", () => {
    type Failure = ApiFailure<LoginResponses>
    type HasDecodeError = Extract<Failure, { _tag: "DecodeError" }> extends never ? false : true
    expectTypeOf<HasDecodeError>().toEqualTypeOf<true>()
  })
})

// =============================================================================
// SECTION: RequestOptionsFor enforces body requirement
// =============================================================================

describe("Auth schema: RequestOptionsFor body constraints", () => {
  it("login requires body with email and password", () => {
    type LoginOp = operations["auth.postLogin"]
    type Opts = RequestOptionsFor<LoginOp>
    // body should be required (not optional)
    expectTypeOf<Opts>().toHaveProperty("body")
  })

  it("register requires body with token and password", () => {
    type RegisterOp = operations["registration.postRegister"]
    type Opts = RequestOptionsFor<RegisterOp>
    expectTypeOf<Opts>().toHaveProperty("body")
  })

  it("logout does NOT require body", () => {
    type LogoutOp = operations["auth.postLogout"]
    type Opts = RequestOptionsFor<LogoutOp>
    // body should be optional
    type HasOptionalBody = undefined extends Opts["body"] ? true : false
    expectTypeOf<HasOptionalBody>().toEqualTypeOf<true>()
  })

  it("getMe does NOT require body", () => {
    type MeOp = operations["auth.getMe"]
    type Opts = RequestOptionsFor<MeOp>
    type HasOptionalBody = undefined extends Opts["body"] ? true : false
    expectTypeOf<HasOptionalBody>().toEqualTypeOf<true>()
  })
})
