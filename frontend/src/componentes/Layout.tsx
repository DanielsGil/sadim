import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { IndicadorConectividad } from './IndicadorConectividad'
import { useSesion } from '../contexto/SesionContext'

/**
 * Estructura de escritorio con navegación lateral (criterio de diseño de los
 * wireframes, §"Criterio de diseño"). El OPERADOR solo ve "Inicio"; el ADMIN
 * ve además "Catálogo", "Usuarios" y "Configuración". Nada que el rol no
 * pueda usar se muestra como acción ejecutable (ADR-005) — aunque la
 * autorización real está en el backend.
 *
 * HU-042: el catálogo, usuarios y configuración son rutas del núcleo y no
 * dependen de ninguna bandera (Contrato v2 §12); Ventas/Mesas, Inventario y
 * Caja sí se ocultan cuando su bandera está desactivada (`modulos?.x_activo`).
 * Antes de que `modulos` termine de cargar (null) se muestran de más en vez de
 * ocultar por error: el backend igual aplica la regla real (ADR-005/006).
 */
export function Layout() {
  const { sesion, cerrarSesion, modulos } = useSesion()
  const navigate = useNavigate()
  const [errorCierre, setErrorCierre] = useState<string | null>(null)
  const ventasActivo = modulos?.ventas_activo ?? true
  const inventarioActivo = modulos?.inventario_activo ?? true
  const serviciosActivo = modulos?.servicios_activo ?? true
  const finanzasActivo = modulos?.finanzas_activo ?? true

  async function manejarCerrarSesion() {
    try {
      setErrorCierre(null)
      await cerrarSesion()
      navigate('/login', { replace: true })
    } catch (error) {
      setErrorCierre(error instanceof Error ? error.message : 'No se pudo cerrar sesión.')
    }
  }

  return (
    <div className="app-shell">
      <aside className="barra-lateral">
        <div className="marca">SADIM</div>
        <nav className="navegacion-lateral">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          {ventasActivo && <NavLink to="/ventas">Ventas</NavLink>}
          {ventasActivo && sesion?.rol === 'ADMIN' && <NavLink to="/mesas">Mesas</NavLink>}
          {inventarioActivo && <NavLink to="/inventario">Inventario</NavLink>}
          {inventarioActivo && <NavLink to="/inventario/ingreso">Ingreso de mercancía</NavLink>}
          {serviciosActivo && <NavLink to="/ordenes">Órdenes</NavLink>}
          {finanzasActivo && <NavLink to="/caja">Caja</NavLink>}
          {finanzasActivo && sesion?.rol === 'ADMIN' && <NavLink to="/caja/cierre">Cierre de caja</NavLink>}
          <NavLink to="/novedades">Novedades</NavLink>
          {sesion?.rol === 'ADMIN' && <NavLink to="/catalogo">Catálogo</NavLink>}
          {sesion?.rol === 'ADMIN' && <NavLink to="/usuarios">Usuarios</NavLink>}
          {sesion?.rol === 'ADMIN' && <NavLink to="/configuracion">Configuración</NavLink>}
          {sesion?.rol === 'ADMIN' && <NavLink to="/dispositivos">Dispositivos</NavLink>}
        </nav>
        <div className="barra-lateral-pie">
          <IndicadorConectividad />
          <span className="rol-actual">
            {sesion?.rol === 'ADMIN' ? 'Administrador' : 'Operador'}
          </span>
          {errorCierre && (
            <p className="mensaje-error" role="alert">
              {errorCierre}
            </p>
          )}
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
