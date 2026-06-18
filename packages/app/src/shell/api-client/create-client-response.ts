import { Effect } from "effect"

import type {
  BoundaryError,
  ParseError,
  TransportError,
  UnexpectedContentType
} from "../../core/api-client/strict-types.js"
import { asJson } from "../../core/axioms.js"
import type { RuntimeApiSuccess, RuntimeEffectFailure, RuntimeHttpError } from "./create-client-runtime-types.js"
import type { ParseAs } from "./create-client-types.js"

type RuntimeFetchResponse = {
  data?: unknown
  error?: unknown
  response: Response
}

export const toError = (error: unknown): Error => (
  error instanceof Error ? error : new Error(String(error))
)

export const toTransportError = (error: unknown): TransportError => ({
  _tag: "TransportError",
  error: toError(error)
})

const parseJsonText = (rawText: string): Effect.Effect<unknown, Error> => (
  rawText.length === 0
    ? Effect.void
    : Effect.try({
      try: () => asJson(JSON.parse(rawText)),
      catch: toError
    })
)

const readResponseText = (response: Response): Effect.Effect<string, Error> => (
  Effect.tryPromise({
    try: () => response.text(),
    catch: toError
  })
)

const readResponseTextStrict = (response: Response): Effect.Effect<string, TransportError> => (
  Effect.tryPromise({
    try: () => response.text(),
    catch: toTransportError
  })
)

const parseSuccessData = (
  response: Response,
  parseAs: ParseAs,
  contentLength: string | null
): Effect.Effect<unknown, Error> => {
  if (parseAs === "stream") {
    return Effect.succeed(response.body)
  }

  if (parseAs === "text") {
    return Effect.tryPromise({ try: () => response.text(), catch: toError })
  }

  if (parseAs === "blob") {
    return Effect.tryPromise({ try: () => response.blob(), catch: toError })
  }

  if (parseAs === "arrayBuffer") {
    return Effect.tryPromise({ try: () => response.arrayBuffer(), catch: toError })
  }

  if (contentLength === null) {
    return readResponseText(response).pipe(
      Effect.flatMap((rawText) => parseJsonText(rawText))
    )
  }

  return Effect.tryPromise({ try: () => response.json(), catch: toError })
}

const parseErrorData = (response: Response): Effect.Effect<unknown, Error> => (
  readResponseText(response).pipe(
    Effect.flatMap((rawText) =>
      Effect.match(
        Effect.try({
          try: () => asJson(JSON.parse(rawText)),
          catch: toError
        }),
        {
          onFailure: () => rawText,
          onSuccess: (parsed) => parsed
        }
      )
    )
  )
)

const hasChunkedTransferEncoding = (response: Response): boolean => (
  response.headers.get("Transfer-Encoding")?.includes("chunked") === true
)

const isEmptyResponse = (
  request: Request,
  response: Response,
  contentLength: string | null
): boolean => (
  response.status === 204
  || request.method === "HEAD"
  || (contentLength === "0" && !hasChunkedTransferEncoding(response))
)

export const createResponseEnvelope = (
  request: Request,
  response: Response,
  parseAs: ParseAs
): Effect.Effect<RuntimeFetchResponse, Error> => {
  const contentLength = response.headers.get("Content-Length")

  if (isEmptyResponse(request, response, contentLength)) {
    return response.ok
      ? Effect.succeed({ data: undefined, response })
      : Effect.succeed({ error: undefined, response })
  }

  if (response.ok) {
    return parseSuccessData(response, parseAs, contentLength).pipe(
      Effect.map((data) => ({ data, response }))
    )
  }

  return parseErrorData(response).pipe(
    Effect.map((error) => ({ error, response }))
  )
}

const normalizeContentType = (value: string | null): string | undefined => (
  value?.split(";")[0]?.trim().toLowerCase()
)

const resolveContentType = (response: Response, fallback: string): string => (
  normalizeContentType(response.headers.get("content-type")) ?? fallback
)

const createParseError = (
  status: number,
  contentType: string,
  body: string,
  error: unknown
): ParseError => ({
  _tag: "ParseError",
  status,
  contentType,
  error: toError(error),
  body
})

const createUnexpectedContentType = (
  response: Response,
  body: string
): UnexpectedContentType => ({
  _tag: "UnexpectedContentType",
  status: response.status,
  expected: ["application/json"],
  actual: response.headers.get("content-type") ?? undefined,
  body
})

const parseJsonStrict = (
  response: Response,
  body: string
): Effect.Effect<unknown, ParseError | UnexpectedContentType> => {
  const contentType = response.headers.get("content-type")
  if (normalizeContentType(contentType) !== "application/json") {
    return Effect.fail(createUnexpectedContentType(response, body))
  }

  if (body.length === 0) {
    return Effect.void
  }

  return Effect.try({
    try: () => asJson(JSON.parse(body)),
    catch: (error) => createParseError(response.status, "application/json", body, error)
  })
}

type StrictParsedBody = {
  readonly contentType: string
  readonly body: unknown
}

const mapStrictBinary = (
  response: Response,
  bodyEffect: Effect.Effect<Blob | ArrayBuffer, TransportError>
): Effect.Effect<StrictParsedBody, TransportError> =>
  bodyEffect.pipe(
    Effect.map((body) => ({
      contentType: resolveContentType(response, "application/octet-stream"),
      body
    }))
  )

const parseStrictBlob = (response: Response): Effect.Effect<StrictParsedBody, TransportError> =>
  mapStrictBinary(
    response,
    Effect.tryPromise({
      try: () => response.blob(),
      catch: toTransportError
    })
  )

const parseStrictArrayBuffer = (response: Response): Effect.Effect<StrictParsedBody, TransportError> =>
  mapStrictBinary(
    response,
    Effect.tryPromise({
      try: () => response.arrayBuffer(),
      catch: toTransportError
    })
  )

const parseStrictData = (
  response: Response,
  parseAs: ParseAs
): Effect.Effect<StrictParsedBody, BoundaryError> => {
  if (parseAs === "stream") {
    return Effect.succeed({
      contentType: resolveContentType(response, "stream"),
      body: response.body
    })
  }

  if (parseAs === "text") {
    return readResponseTextStrict(response).pipe(
      Effect.map((body) => ({
        contentType: resolveContentType(response, "text/plain"),
        body
      }))
    )
  }

  if (parseAs === "blob") {
    return parseStrictBlob(response)
  }

  if (parseAs === "arrayBuffer") {
    return parseStrictArrayBuffer(response)
  }

  return readResponseTextStrict(response).pipe(
    Effect.flatMap((body) =>
      parseJsonStrict(response, body).pipe(
        Effect.map((parsed) => ({
          contentType: "application/json",
          body: parsed
        }))
      )
    )
  )
}

const createStrictVariant = (
  response: Response,
  parsed: StrictParsedBody
): RuntimeApiSuccess => ({
  status: response.status,
  contentType: parsed.contentType,
  body: parsed.body
})

const createStrictHttpError = (success: RuntimeApiSuccess): RuntimeHttpError => ({
  _tag: "HttpError",
  ...success
})

export const createStrictResponseEffect = (
  request: Request,
  response: Response,
  parseAs: ParseAs
): Effect.Effect<RuntimeApiSuccess, RuntimeEffectFailure> => {
  const contentLength = response.headers.get("Content-Length")

  if (isEmptyResponse(request, response, contentLength)) {
    const variant: RuntimeApiSuccess = {
      status: response.status,
      contentType: "none",
      body: undefined
    }

    return response.ok
      ? Effect.succeed(variant)
      : Effect.fail(createStrictHttpError(variant))
  }

  return parseStrictData(response, parseAs).pipe(
    Effect.flatMap((parsed) => {
      const variant = createStrictVariant(response, parsed)
      return response.ok
        ? Effect.succeed(variant)
        : Effect.fail(createStrictHttpError(variant))
    })
  )
}
