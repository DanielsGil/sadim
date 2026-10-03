import { useSesion } from '../contexto/SesionContext'

export interface ElementoNavegacion {
  to: string
  /**
   * Coincidencia exacta de ruta (NavLink `end`). Se calcula sola: un
   * elemento la necesita cuando su ruta es prefijo de la de OTRO elemento
   * del menú (p. ej. "/caja" de
   * "/caja/cierre") — si no, React Router marca activos a los dos a la vez
   * (E-03). Cuando el prefijo compartido es con una ruta de DETALLE que no
   * está en el menú (p. ej. "/ventas/mesas/:id" o "/ordenes/:id"), el
   * elemento del menú se deja con coincidencia por prefijo a propósito, para
   * que siga resaltado al entrar al detalle de esa sección.
   */
  fin?: boolean
  /** Texto tal como se mostraba en la barra lateral de escritorio. */
  etiqueta: string
  /** Etiqueta corta para la barra inferior en móvil. */
  etiquetaCorta: string
  icono: string
}

function marcarCoincidenciaExacta(
  elementos: ElementoNavegacion[],
): ElementoNavegacion[] {
  const rutas = elementos.map((elemento) => elemento.to)
  return elementos.map((elemento) => ({
    ...elemento,
    fin:
      elemento.to === '/' ||
      rutas.some((otra) => otra !== elemento.to && otra.startsWith(`${elemento.to}/`)),
  }))
}

/**
 * Única fuente de verdad de qué secciones se muestran, en qué orden, y con
 * qué texto — antes vivía inline en `Layout`. La reutilizan `Layout` (barra
 * lateral en escritorio, barra inferior + hoja "Más" en móvil) e `Inicio`
 * (accesos rápidos, E-02), así que ocultar por rol o por módulo desactivado
 * queda en un solo lugar (HU-042, ADR-005/006: la autorización real está en
 * el backend, esto es solo presentación).
 */
export function useElementosNavegacion(): ElementoNavegacion[] {
  const { sesion, modulos } = useSesion()
  const ventasActivo = modulos?.ventas_activo ?? true
  const inventarioActivo = modulos?.inventario_activo ?? true
  const serviciosActivo = modulos?.servicios_activo ?? true
  const finanzasActivo = modulos?.finanzas_activo ?? true
  const esAdmin = sesion?.rol === 'ADMIN'

  const elementos: Array<ElementoNavegacion | false> = [
    { to: '/', etiqueta: 'Inicio', etiquetaCorta: 'Inicio', icono: '🏠' },
    ventasActivo && { to: '/ventas', etiqueta: 'Ventas', etiquetaCorta: 'Ventas', icono: '🛒' },
    ventasActivo &&
      esAdmin && { to: '/mesas', etiqueta: 'Mesas', etiquetaCorta: 'Mesas', icono: '🍽️' },
    inventarioActivo &&
      { to: '/inventario', etiqueta: 'Inventario', etiquetaCorta: 'Stock', icono: '📦' },
    serviciosActivo &&
      { to: '/ordenes', etiqueta: 'Órdenes', etiquetaCorta: 'Órdenes', icono: '🧾' },
    finanzasActivo && { to: '/caja', etiqueta: 'Caja', etiquetaCorta: 'Caja', icono: '💵' },
    finanzasActivo &&
      esAdmin &&
      { to: '/caja/cierre', etiqueta: 'Cierre de caja', etiquetaCorta: 'Cierre', icono: '🔒' },
    { to: '/novedades', etiqueta: 'Novedades', etiquetaCorta: 'Avisos', icono: '🔔' },
    esAdmin && { to: '/catalogo', etiqueta: 'Catálogo', etiquetaCorta: 'Catálogo', icono: '📋' },
    esAdmin && { to: '/usuarios', etiqueta: 'Usuarios', etiquetaCorta: 'Usuarios', icono: '👤' },
    esAdmin &&
      { to: '/configuracion', etiqueta: 'Configuración', etiquetaCorta: 'Config.', icono: '⚙️' },
    esAdmin &&
      { to: '/dispositivos', etiqueta: 'Dispositivos', etiquetaCorta: 'Equipos', icono: '📱' },
  ]

  const visibles = elementos.filter(
    (elemento): elemento is ElementoNavegacion => elemento !== false,
  )
  return marcarCoincidenciaExacta(visibles)
}
