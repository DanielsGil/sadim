import { useSesion } from '../contexto/SesionContext'

export interface ElementoNavegacion {
  to: string
  /** true solo para "Inicio": coincidencia exacta de ruta (NavLink `end`). */
  fin?: boolean
  /** Texto tal como se mostraba en la barra lateral de escritorio. */
  etiqueta: string
  /** Etiqueta corta para la barra inferior en móvil. */
  etiquetaCorta: string
  icono: string
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
    { to: '/', fin: true, etiqueta: 'Inicio', etiquetaCorta: 'Inicio', icono: '🏠' },
    ventasActivo && { to: '/ventas', etiqueta: 'Ventas', etiquetaCorta: 'Ventas', icono: '🛒' },
    ventasActivo &&
      esAdmin && { to: '/mesas', etiqueta: 'Mesas', etiquetaCorta: 'Mesas', icono: '🍽️' },
    inventarioActivo &&
      { to: '/inventario', etiqueta: 'Inventario', etiquetaCorta: 'Stock', icono: '📦' },
    inventarioActivo &&
      {
        to: '/inventario/ingreso',
        etiqueta: 'Ingreso de mercancía',
        etiquetaCorta: 'Ingreso',
        icono: '📥',
      },
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

  return elementos.filter((elemento): elemento is ElementoNavegacion => elemento !== false)
}
