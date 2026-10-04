import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listarMesas } from '../api/mesas'
import { ErrorApi } from '../api/errorApi'
import { listarVentas } from '../api/ventas'
import { FormularioVentaRapida } from '../componentes/FormularioVentaRapida'
import type { Mesa, Venta } from '../tipos/dominio'
import { formatoMoneda } from '../utilidades/formato'

/** Ventas — mapa de mesas y venta rápida (CU-01, CU-02, HU-012..HU-019). */
export function Ventas() {
  const navigate = useNavigate()
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [ventasAbiertas, setVentasAbiertas] = useState<Venta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarVentaRapida, setMostrarVentaRapida] = useState(false)

  function recargar() {
    setCargando(true)
    setError(null)
    Promise.all([listarMesas({ activa: true }), listarVentas({ estado: 'ABIERTA' })])
      .then(([mesasObtenidas, ventasObtenidas]) => {
        setMesas(mesasObtenidas)
        setVentasAbiertas(ventasObtenidas)
      })
      .catch((err: unknown) => {
        setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el mapa de mesas.')
      })
      .finally(() => setCargando(false))
  }

  useEffect(recargar, [])

  // D26 (E-09, Lote de correcciones 3): tocar una mesa libre solo abre la
  // pantalla de sesión en este dispositivo — no envía nada al servidor
  // todavía. La sesión se crea al agregar el primer producto (DetalleSesion).
  function manejarClicMesa(mesa: Mesa) {
    navigate(`/ventas/mesas/${mesa.id}`)
  }

  return (
    <div className="pagina-ventas">
      <div className="encabezado-seccion">
        <h1>Ventas</h1>
        <button type="button" onClick={() => setMostrarVentaRapida(true)}>
          Venta rápida
        </button>
      </div>

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      {mostrarVentaRapida && (
        <FormularioVentaRapida
          onCancelar={() => setMostrarVentaRapida(false)}
          onGuardado={() => {
            setMostrarVentaRapida(false)
            recargar()
          }}
        />
      )}

      {cargando ? (
        <p className="cargando">Cargando mesas…</p>
      ) : (
        <div className="cuadricula-mesas">
          {mesas.map((mesa) => {
            const venta = ventasAbiertas.find((v) => v.mesa_id === mesa.id)
            return (
              <button
                key={mesa.id}
                type="button"
                className={`tarjeta-mesa ${mesa.estado === 'OCUPADA' ? 'tarjeta-mesa-ocupada' : 'tarjeta-mesa-disponible'}`}
                onClick={() => manejarClicMesa(mesa)}
              >
                <span className="tarjeta-mesa-numero">Mesa {mesa.numero}</span>
                <span>{mesa.estado === 'OCUPADA' ? 'Ocupada' : 'Disponible'}</span>
                {venta && <span>Total: {formatoMoneda(venta.total)}</span>}
              </button>
            )
          })}
          {mesas.length === 0 && (
            <p className="texto-vacio">No hay mesas activas todavía.</p>
          )}
        </div>
      )}
    </div>
  )
}
