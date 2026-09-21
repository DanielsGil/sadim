import { useEffect, useState } from 'react'
import { contarOperacionesPendientes, dispararSincronizacion } from '../sync/enrutador'
import { UMBRAL_ADVERTENCIA_COLA } from '../sync/motor'

/**
 * Indicador visible y permanente de conectividad + operaciones pendientes
 * (Bloque 5b, HU-032 lado cliente). Se actualiza al conectar/desconectar,
 * cada 15s mientras haya cola, y dispara una sincronización oportunista.
 */
export function IndicadorConectividad() {
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    let activo = true

    async function actualizar() {
      const total = await contarOperacionesPendientes()
      if (activo) setPendientes(total)
    }

    function alConectar() {
      setEnLinea(true)
      void dispararSincronizacion().then(actualizar)
    }
    function alDesconectar() {
      setEnLinea(false)
    }

    void actualizar()
    window.addEventListener('online', alConectar)
    window.addEventListener('offline', alDesconectar)
    // Sincronización periódica mientras haya cola (requisito explícito del Bloque 5b).
    const intervalo = window.setInterval(() => {
      void dispararSincronizacion().then(actualizar)
    }, 15000)

    return () => {
      activo = false
      window.removeEventListener('online', alConectar)
      window.removeEventListener('offline', alDesconectar)
      window.clearInterval(intervalo)
    }
  }, [])

  return (
    <div className={`indicador-conectividad ${enLinea ? 'en-linea' : 'sin-conexion'}`}>
      <span>{enLinea ? 'En línea' : 'Sin conexión'}</span>
      {pendientes > 0 && (
        <span className={pendientes > UMBRAL_ADVERTENCIA_COLA ? 'texto-advertencia' : ''}>
          {pendientes} operación{pendientes === 1 ? '' : 'es'} pendiente{pendientes === 1 ? '' : 's'} de sincronizar
        </span>
      )}
    </div>
  )
}
