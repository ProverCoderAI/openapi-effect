# openapi-effect

Drop-in replacement for `openapi-fetch` with an opt-in Effect API.

## Install

```bash
pnpm add @prover-coder-ai/openapi-effect
```

## Usage (Promise API)

This package implements an `openapi-fetch` compatible API, so most code can be migrated by changing only the import.

```ts
import createClient from "@prover-coder-ai/openapi-effect"
import type { paths } from "./openapi"

const client = createClient<paths>({ baseUrl: "https://api.example.com" })

const { data, error } = await client.GET("/pets", {
  params: { query: { limit: 10 } }
})

if (error) {
  // handle error
}
```

## Usage (Effect API)

Effect-based client is available as an opt-in API.

```ts
import { createClientEffect, FetchHttpClient } from "@prover-coder-ai/openapi-effect"
```
