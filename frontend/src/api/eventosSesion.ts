// Puente simple entre el cliente HTTP (fuera de React) y SesionContext: el
// cliente no conoce React, así que avisa por evento cuando cierra la sesión
// (falló la renovación del token) para que la UI reaccione y redirija a
// /login.
export const EVENTO_SESION_CERRADA = 'sadim:sesion-cerrada'

export function emitirSesionCerrada(): void {
  window.dispatchEvent(new Event(EVENTO_SESION_CERRADA))
}
