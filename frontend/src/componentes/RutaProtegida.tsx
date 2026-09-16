import { Navigate, Outlet } from 'react-router-dom'
import { useSesion } from '../contexto/SesionContext'

/** Exige sesión iniciada (CU-17); si no hay, redirige a /login. */
export function RutaProtegida() {
  const { sesion, cargando } = useSesion()

  if (cargando) {
    return <p className="cargando">Cargando…</p>
  }
  if (!sesion) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
