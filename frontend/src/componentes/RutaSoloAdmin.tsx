import { Navigate, Outlet } from 'react-router-dom'
import { useSesion } from '../contexto/SesionContext'

/**
 * ADR-005 / RBAC: oculta la ruta a quien no sea ADMIN. Es solo experiencia de
 * usuario — la autorización real la aplica el backend en cada endpoint.
 */
export function RutaSoloAdmin() {
  const { sesion } = useSesion()

  if (sesion?.rol !== 'ADMIN') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
