import { useEffect, useRef, useState } from 'react'
import type { Producto } from '../tipos/dominio'

/** E-10: tiempo de espera desde el último clic antes de enviar la cantidad acumulada. */
export const ESPERA_AGRUPAR_CLICS_MS = 1000

export interface ProductoAcumulado {
  producto: Producto
  cantidad: number
}

/**
 * E-10 (Lote de correcciones 4): cada clic sobre la tarjeta de un producto
 * suma una unidad; los clics seguidos sobre el MISMO producto (y los «−»/«+»
 * del contador) se juntan y, ~1 s después de la última interacción, se
 * confirman como UNA sola línea con la cantidad acumulada. Ejemplo: tres
 * clics rápidos sobre "Capuchino" = una línea de 3, no tres de 1.
 * Clic sobre otro producto: el acumulado anterior se confirma de inmediato.
 */
export function useAcumuladorClics(onConfirmar: (producto: Producto, cantidad: number) => void) {
  const [pendiente, setPendiente] = useState<ProductoAcumulado | null>(null)
  const pendienteRef = useRef<ProductoAcumulado | null>(null)
  const temporizadorRef = useRef<number | null>(null)
  const onConfirmarRef = useRef(onConfirmar)

  useEffect(() => {
    onConfirmarRef.current = onConfirmar
  })

  function limpiarTemporizador() {
    if (temporizadorRef.current !== null) {
      window.clearTimeout(temporizadorRef.current)
      temporizadorRef.current = null
    }
  }

  function fijar(valor: ProductoAcumulado | null) {
    pendienteRef.current = valor
    setPendiente(valor)
  }

  function confirmarYa() {
    limpiarTemporizador()
    const actual = pendienteRef.current
    if (!actual) return
    fijar(null)
    onConfirmarRef.current(actual.producto, actual.cantidad)
  }

  function programar() {
    limpiarTemporizador()
    temporizadorRef.current = window.setTimeout(confirmarYa, ESPERA_AGRUPAR_CLICS_MS)
  }

  function sumar(producto: Producto) {
    if (pendienteRef.current && pendienteRef.current.producto.id !== producto.id) confirmarYa()
    const cantidad = (pendienteRef.current?.cantidad ?? 0) + 1
    fijar({ producto, cantidad })
    programar()
  }

  function ajustar(cantidad: number) {
    if (!pendienteRef.current) return
    fijar({ ...pendienteRef.current, cantidad })
    programar()
  }

  function descartar() {
    limpiarTemporizador()
    fijar(null)
  }

  // Al salir de la pantalla no se pierden los clics que aún no se enviaron.
  useEffect(() => () => confirmarYa(), [])

  return { pendiente, sumar, ajustar, confirmarYa, descartar }
}
