export interface paths {
  "/api/auth/login": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations["auth.postLogin"]
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  "/api/auth/logout": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations["auth.postLogout"]
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  "/api/auth/me": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get: operations["auth.getMe"]
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  "/api/register": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post: operations["registration.postRegister"]
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
}

export interface operations {
  "auth.postLogin": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        "application/json": {
          /** Format: email */
          email: string
          /** Format: password */
          password: string
        }
      }
    }
    responses: {
      /** @description Success */
      200: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            id: components["schemas"]["UUID"]
            /** Format: email */
            email: string
            firstName: string
            lastName: string
            profileImageUrl: string | null
            emailVerified: boolean
            phoneVerified: boolean
          }
        }
      }
      /** @description The request did not match the expected schema */
      400: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json":
            | components["schemas"]["HttpApiDecodeError"]
            | {
              /** @enum {string} */
              error: "invalid_payload"
            }
        }
      }
      /** @description Error */
      401: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            /** @enum {string} */
            error: "invalid_credentials"
          }
        }
      }
      /** @description Error */
      500: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            /** @enum {string} */
            error: "internal_error"
          }
        }
      }
    }
  }
  "auth.postLogout": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Success */
      204: {
        headers: {
          [name: string]: string
        }
        content?: never
      }
      /** @description The request did not match the expected schema */
      400: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": components["schemas"]["HttpApiDecodeError"]
        }
      }
      /** @description Error */
      401: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            /** @enum {string} */
            error: "unauthorized"
          }
        }
      }
      /** @description Error */
      500: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json":
            | {
              /** @enum {string} */
              error: "internal_error"
            }
            | {
              /** @enum {string} */
              error: "logout_failed"
            }
        }
      }
    }
  }
  "auth.getMe": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Success */
      200: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            id: components["schemas"]["UUID"]
            /** Format: email */
            email: string
            firstName: string
            lastName: string
            profileImageUrl: string | null
            emailVerified: boolean
            phoneVerified: boolean
            birthDate: string | null
            about: string | null
            messengers: Array<{
              /** @enum {string} */
              platform: "telegram" | "whatsapp"
              handle: string
            }>
            memberships: Array<{
              projectId: components["schemas"]["UUID"]
              departmentId: components["schemas"]["UUID"]
              positionId: components["schemas"]["UUID"]
              /** @enum {string} */
              role: "super_admin" | "admin" | "manager"
            }>
            adminProjectIds: Array<components["schemas"]["UUID"]>
            workEmail: string | null
            workPhone: string | null
          }
        }
      }
      /** @description The request did not match the expected schema */
      400: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": components["schemas"]["HttpApiDecodeError"]
        }
      }
      /** @description Error */
      401: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            /** @enum {string} */
            error: "unauthorized"
          }
        }
      }
      /** @description Error */
      404: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            /** @enum {string} */
            error: "profile_not_found"
          }
        }
      }
      /** @description Error */
      500: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            /** @enum {string} */
            error: "internal_error"
          }
        }
      }
    }
  }
  "registration.postRegister": {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        "application/json": {
          token: string
          /** Format: password */
          password: string
        }
      }
    }
    responses: {
      /** @description Success */
      201: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            id: components["schemas"]["UUID"]
            /** Format: email */
            email: string
            firstName: string
            lastName: string
            profileImageUrl: string | null
          }
        }
      }
      /** @description The request did not match the expected schema */
      400: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json":
            | components["schemas"]["HttpApiDecodeError"]
            | {
              /** @enum {string} */
              error: "invalid_payload"
            }
            | {
              /** @enum {string} */
              error: "weak_password"
              policy: {
                /** @enum {boolean} */
                ok: false
                tooShort: boolean
                missingLower: boolean
                missingUpper: boolean
                missingDigit: boolean
                missingSymbol: boolean
              }
            }
        }
      }
      /** @description Error */
      404: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            /** @enum {string} */
            error: "invitation_not_found_or_expired"
          }
        }
      }
      /** @description Error */
      409: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json": {
            /** @enum {string} */
            error: "user_exists"
          }
        }
      }
      /** @description Error */
      500: {
        headers: {
          [name: string]: string
        }
        content: {
          "application/json":
            | {
              /** @enum {string} */
              error: "internal_error"
            }
            | {
              /** @enum {string} */
              error: "user_creation_failed"
            }
        }
      }
    }
  }
}

export interface components {
  schemas: {
    /**
     * Format: uuid
     * @description a Universally Unique Identifier
     */
    UUID: string
    /** @description The request did not match the expected schema */
    HttpApiDecodeError: {
      issues: Array<components["schemas"]["Issue"]>
      message: string
      /** @enum {string} */
      _tag: "HttpApiDecodeError"
    }
    /** @description Represents an error encountered while parsing a value to match the schema */
    Issue: {
      /**
       * @description The tag identifying the type of parse issue
       * @enum {string}
       */
      _tag:
        | "Pointer"
        | "Unexpected"
        | "Missing"
        | "Composite"
        | "Refinement"
        | "Transformation"
        | "Type"
        | "Forbidden"
      /** @description The path to the property where the issue occurred */
      path: Array<components["schemas"]["PropertyKey"]>
      /** @description A descriptive message explaining the issue */
      message: string
    }
    PropertyKey:
      | string
      | number
      | {
        /** @enum {string} */
        _tag: "symbol"
        key: string
      }
  }
  responses: never
  parameters: never
  requestBodies: never
  headers: never
  pathItems: never
}
