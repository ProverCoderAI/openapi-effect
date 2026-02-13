import { Effect } from "effect"

import { asJson } from "../../core/axioms.js"
import type { ParseAs } from "./create-client-types.js"

type RuntimeFetchResponse = {
  data?: unknown
  error?: unknown
  response: Response
}

export const toError = (error: unknown): Error => (
  error instanceof Error ? error : new Error(String(error))
)

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
