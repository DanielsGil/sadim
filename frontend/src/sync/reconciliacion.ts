import { listarCategorias, listarProductos } from '../api/catalogo'
import { obtenerConfiguracionModulos, obtenerConfiguracionPagos } from '../api/configuracion'
import { listarMesas } from '../api/mesas'
import { listarOrdenes } from '../api/ordenesTrabajo'
import { listarVentas } from '../api/ventas'
import { guardarModulosLocal, guardarUltimaSincronizacion, baseLocal } from '../db/baseLocal'

/**
 * Al terminar un lote de sincronización con éxito: descarga catálogo, stock,
 * mesas, ventas abiertas, órdenes no entregadas y configuración de módulos y
 * pagos, y reemplaza la copia local (Bloque 5b, requisito explícito).
 * catalogo/productos/mesas ya se cachean solos al llamarlos (api/catalogo.ts,
 * api/mesas.ts); aquí solo se guarda lo que no tiene almacén dedicado.
 */
export async function reconciliar(): Promise<void> {
  const [, , , ventasAbiertas, ordenesNoEntregadas, modulos, pagos] = await Promise.all([
    listarCategorias(),
    listarProductos(),
    listarMesas(),
    listarVentas({ estado: 'ABIERTA' }),
    listarOrdenes(),
    obtenerConfiguracionModulos(),
    obtenerConfiguracionPagos(),
  ])

  await guardarModulosLocal(modulos)
  await baseLocal.meta.put({ clave: 'ventas_abiertas', valor: ventasAbiertas })
  await baseLocal.meta.put({
    clave: 'ordenes_no_entregadas',
    valor: ordenesNoEntregadas.filter((orden) => orden.estado !== 'ENTREGADO'),
  })
  await baseLocal.meta.put({ clave: 'configuracion_pagos', valor: pagos })
  await guardarUltimaSincronizacion(new Date().toISOString())
}
