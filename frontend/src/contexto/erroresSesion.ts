/**
 * A4 (F-3): D21 — la cola de sincronización tiene operaciones de OTRO
 * usuario, así que no se admite este login. Es un tipo propio para que la
 * pantalla de inicio de sesión lo distinga sin comparar textos.
 */
export class ErrorColaDeOtroUsuario extends Error {
  constructor() {
    super('Hay operaciones sin sincronizar de otro usuario en este dispositivo. Inicia sesión con esa cuenta primero.')
    this.name = 'ErrorColaDeOtroUsuario'
  }
}
