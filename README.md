# openapi-effect

Drop-in replacement for `openapi-fetch` with an opt-in Effect API.

## Install

```bash
pnpm add @prover-coder-ai/openapi-effect
```

## Usage (Envelope API)

This package implements `openapi-fetch` compatible method inputs and response envelopes.

```ts
import { Effect } from "effect"
import createClient from "@prover-coder-ai/openapi-effect"
import type { paths } from "./openapi"

const client = createClient<paths>({ baseUrl: "https://api.example.com" })

const program = Effect.gen(function* () {
  const { data, error } = yield* client.GET("/pets", {
    params: { query: { limit: 10 } }
  })

  return error ?? data
})
```

## Usage (Effect API)

`createClientEffect` keeps the same method inputs but moves non-2xx responses into the Effect error channel.

```ts
import { Effect } from "effect"
import { createClientEffect } from "@prover-coder-ai/openapi-effect"
import type { paths } from "./openapi"

const client = createClientEffect<paths>({ baseUrl: "https://api.example.com" })

const program = Effect.gen(function* () {
  const result = yield* client.GET("/pets", {
    params: { query: { limit: 10 } }
  })

  return result.body
})
```
