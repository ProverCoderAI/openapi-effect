// Consumer proof: external project imports createClientEffect and compiles with tsc --noEmit.
// This file must compile cleanly with no local module declaration overrides.
import { createClientEffect } from "@prover-coder-ai/openapi-effect"

type Paths = {
  "/health": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": { ok: boolean }
          }
        }
      }
    }
  }
}

const client = createClientEffect<Paths>()

// Verify .GET exists and returns something (compile-time only)
client.GET("/health")
