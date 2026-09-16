/** Espejo de la forma de error del Contrato API §14: {code, message, details}. */
export class ErrorApi extends Error {
  code: string
  details: Record<string, unknown>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ErrorApi'
    this.code = code
    this.details = details
  }
}
