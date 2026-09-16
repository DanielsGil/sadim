import { useSesion } from '../contexto/SesionContext'

/**
 * Inicio (dashboard) — wireframe 2, versión mínima. Las tarjetas KPI, los
 * accesos rápidos y el mapa de mesas del wireframe dependen de Ventas
 * (HU-013 en adelante, Sprint 3) y no existen todavía: no se muestran
 * acciones que el usuario no puede ejecutar.
 */
export function Inicio() {
  const { sesion } = useSesion()

  return (
    <div className="pagina-inicio">
      <h1>Inicio</h1>
      <p>
        Bienvenido{sesion?.rol === 'ADMIN' ? ', Administrador' : ', Operador'}. Las operaciones
        de ventas, sesiones dinámicas y órdenes de trabajo se habilitan en los próximos pasos
        del Sprint 3.
      </p>
    </div>
  )
}
