import { useEffect, useRef, useState } from 'react'
import { guardarBandejaLocal, obtenerBandejaLocal } from '../db/baseLocal'
import type { ItemBandeja } from './bandeja'

/**
 * E-19: la bandeja de selección vive en el estado de la pantalla y, a la
 * vez, en Dexie (una por `clave`: `mesa:<id>` o `venta-rapida`). Al volver a
 * la mesa —incluso tras el botón «atrás» o cerrar la app— se restaura tal
 * cual. Vaciarla (al enviarla con éxito o a mano) la borra del dispositivo.
 * Ejemplo: el mesero toca 2 capuchinos en la Mesa 4, usa el gesto «atrás»
 * sin querer y vuelve a entrar: los 2 capuchinos siguen en la bandeja.
 */
export function useBandejaPersistente(clave: string | null) {
  const [items, setItems] = useState<ItemBandeja[]>([])
  const [restaurada, setRestaurada] = useState(false)
  const claveCargada = useRef<string | null>(null)

  useEffect(() => {
    if (!clave) return
    let activo = true
    claveCargada.current = null
    obtenerBandejaLocal<ItemBandeja>(clave)
      .then((guardados) => {
        if (!activo) return
        setItems(guardados)
        claveCargada.current = clave
        setRestaurada(true)
      })
      .catch(() => {
        // Sin almacenamiento local disponible: la bandeja funciona solo en memoria.
        if (activo) {
          claveCargada.current = clave
          setRestaurada(true)
        }
      })
    return () => {
      activo = false
    }
  }, [clave])

  useEffect(() => {
    // No escribir hasta haber leído lo guardado: si no, una bandeja vacía
    // inicial borraría la que se quería restaurar.
    if (!clave || claveCargada.current !== clave) return
    void guardarBandejaLocal(clave, items).catch(() => undefined)
  }, [clave, items, restaurada])

  /** Vacía la bandeja y la borra del dispositivo YA (antes de salir de la pantalla). */
  async function vaciar() {
    setItems([])
    if (clave) await guardarBandejaLocal(clave, []).catch(() => undefined)
  }

  return [items, setItems, vaciar] as const
}
