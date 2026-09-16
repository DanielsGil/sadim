import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSesion } from '../contexto/SesionContext'

/**
 * Estructura de escritorio con navegación lateral (criterio de diseño de los
 * wireframes, §"Criterio de diseño"). El OPERADOR solo ve "Inicio"; el ADMIN
 * ve además "Catálogo" (CU-05). Nada que el rol no pueda usar se muestra como
 * acción ejecutable (ADR-005) — aunque la autorización real está en el
 * backend.
 */
export function Layout() {
  const { sesion, cerrarSesion } = useSesion()
  const navigate = useNavigate()

  async function manejarCerrarSesion() {
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="barra-lateral">
        <div className="marca">SADIM</div>
        <nav className="navegacion-lateral">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          {sesion?.rol === 'ADMIN' && <NavLink to="/catalogo">Catálogo</NavLink>}
        </nav>
        <div className="barra-lateral-pie">
          <span className="rol-actual">
            {sesion?.rol === 'ADMIN' ? 'Administrador' : 'Operador'}
          </span>
          <button type="button" className="boton-secundario" onClick={manejarCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="contenido-principal">
        <Outlet />
      </main>
    </div>
  )
}
