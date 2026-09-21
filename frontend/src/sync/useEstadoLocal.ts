import { useEffect, useState } from 'react'
import { contarOperacionesPendientes } from './enrutador'

/**
 * Estado de conectividad y de cola para las pantallas (HU-030, D22).
 * `provisional` es true cuando lo que se muestra puede diferir de lo que el
 * servidor va a calcular: sin conexión, o con operaciones aún sin sincronizar.
 */
export function useEstadoLocal(): { enLinea: boolean; pendientes: number; provisional: boolean } {
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    let activo = true
    const actualizar = () => {
      void contarOperacionesPendientes().then((total) => {
        if (activo) setPendientes(total)
      })
    }
    const alConectar = () => {
      setEnLinea(true)
      actualizar()
    }
    const alDesconectar = () => setEnLinea(false)

    actualizar()
    window.addEventListener('online', alConectar)
    window.addEventListener('offline', alDesconectar)
    const intervalo = window.setInterval(actualizar, 5000)
    return () => {
      activo = false
      window.removeEventListener('online', alConectar)
      window.removeEventListener('offline', alDesconectar)
      window.clearInterval(intervalo)
    }
  }, [])

  return { enLinea, pendientes, provisional: !enLinea || pendientes > 0 }
}
