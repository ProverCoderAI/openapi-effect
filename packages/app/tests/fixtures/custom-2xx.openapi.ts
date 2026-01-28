/**
 * This file represents an OpenAPI schema with a non-standard 2xx status code (250).
 * Used to prove that Is2xx is generic and doesn't hardcode standard statuses.
 */

export interface CustomPaths {
  "/custom": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Custom endpoint with 250 success */
    get: CustomOperations["customGet"]
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
}

export interface CustomComponents {
  schemas: {
    CustomResponse: {
      message: string
    }
    CustomError: {
      code: number
      error: string
    }
  }
}

export interface CustomOperations {
  customGet: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Custom success with non-standard 250 status */
      250: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": CustomComponents["schemas"]["CustomResponse"]
        }
      }
      /** @description Standard error */
      400: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": CustomComponents["schemas"]["CustomError"]
        }
      }
    }
  }
}
