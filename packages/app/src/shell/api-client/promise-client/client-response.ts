// CHANGE: Response parsing and FetchResponse shaping for promise-compatible client
// WHY: Isolate body parsing and no-content handling from create-client orchestration
// SOURCE: n/a
// PURITY: SHELL
// COMPLEXITY: O(|body|)

import { Effect } from "effect"
import type { MediaType } from "openapi-typescript-helpers"

import type { FetchResponse, ParseAs } from "./types.js"

const identity = <A>(value: A): A => value

const readText = (response: Response): Effect.Effect<string, unknown> => {
  return Effect.tryPromise({ try: () => response.text(), catch: identity })
}

const parseJsonText = (raw: string): Effect.Effect<unknown, unknown> => {
  if (raw === "") {
    return Effect.void
  }

  return Effect.try({
    try: (): unknown => JSON.parse(raw),
    catch: identity
  })
}

const parseAsJson = (response: Response): Effect.Effect<unknown, unknown> => {
  return readText(response).pipe(Effect.flatMap((raw) => parseJsonText(raw)))
}

const parseByMode = (response: Response, parseAs: ParseAs): Effect.Effect<unknown, unknown> => {
  if (parseAs === "stream") {
    return Effect.succeed(response.body)
  }

  if (parseAs === "json") {
    return parseAsJson(response)
  }

  if (parseAs === "text") {
    return readText(response)
  }

  if (parseAs === "blob") {
    return Effect.tryPromise({ try: () => response.blob(), catch: identity })
  }

  return Effect.tryPromise({ try: () => response.arrayBuffer(), catch: identity })
}

const isNoContentResponse = (response: Response, request: Request): boolean => {
  const contentLength = response.headers.get("Content-Length")
  return response.status === 204 || request.method === "HEAD" || contentLength === "0"
}

const toFetchResponse = <
  Responses extends Record<string | number, unknown>,
  Options,
  Media extends MediaType
>(value: { data?: unknown; error?: unknown; response: Response }): FetchResponse<Responses, Options, Media> => {
  return value as FetchResponse<Responses, Options, Media>
}

export const parseErrorBody = (response: Response): Effect.Effect<unknown, unknown> => {
  return readText(response).pipe(
    Effect.flatMap((raw) =>
      Effect.try({
        try: (): unknown => JSON.parse(raw),
        catch: () => raw
      })
    )
  )
}

export const toParsedFetchResponse = <
  Responses extends Record<string | number, unknown>,
  Options,
  Media extends MediaType
>(
  response: Response,
  request: Request,
  parseAs: ParseAs
): Effect.Effect<FetchResponse<Responses, Options, Media>, unknown> => {
  if (isNoContentResponse(response, request)) {
    return response.ok
      ? Effect.succeed(toFetchResponse({ data: undefined, response }))
      : Effect.succeed(toFetchResponse({ error: undefined, response }))
  }

  if (response.ok) {
    return parseByMode(response, parseAs).pipe(
      Effect.map((data) => toFetchResponse({ data, response }))
    )
  }

  return parseErrorBody(response).pipe(
    Effect.map((error) => toFetchResponse({ error, response }))
  )
}
