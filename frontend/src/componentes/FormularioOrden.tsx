import { useState, type FormEvent } from 'react'
import { crearOrden } from '../api/ordenesTrabajo'
import { ErrorApi } from '../api/errorApi'
import type { OrdenTrabajo } from '../tipos/dominio'

interface Props {
  onGuardado: (orden: OrdenTrabajo) => void
  onCancelar: () => void
}

/** Nuevo pedido — CU-06, HU-020. */
export function FormularioOrden({ onGuardado, onCancelar }: Props) {
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [costoTotal, setCostoTotal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const orden = await crearOrden({
        cliente_nombre: clienteNombre,
        cliente_telefono: clienteTelefono || undefined,
        descripcion,
        fecha_entrega_estimada: fechaEntrega,
        costo_total: Number(costoTotal),
      })
      onGuardado(orden)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo registrar el pedido.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario-panel" onSubmit={manejarEnvio}>
      <h3>Nuevo pedido</h3>

      <label htmlFor="orden-cliente-nombre">Cliente</label>
      <input
        id="orden-cliente-nombre"
        value={clienteNombre}
        onChange={(evento) => setClienteNombre(evento.target.value)}
        required
      />

      <label htmlFor="orden-cliente-telefono">Teléfono (opcional)</label>
      <input
        id="orden-cliente-telefono"
        value={clienteTelefono}
        onChange={(evento) => setClienteTelefono(evento.target.value)}
      />

      <label htmlFor="orden-descripcion">Descripción del encargo</label>
      <textarea
        id="orden-descripcion"
        value={descripcion}
        onChange={(evento) => setDescripcion(evento.target.value)}
        required
      />

      <label htmlFor="orden-fecha-entrega">Fecha de entrega estimada</label>
      <input
        id="orden-fecha-entrega"
        type="date"
        value={fechaEntrega}
        onChange={(evento) => setFechaEntrega(evento.target.value)}
        required
      />

      <label htmlFor="orden-costo-total">Costo total acordado</label>
      <input
        id="orden-costo-total"
        type="number"
        min="0"
        step="0.01"
        value={costoTotal}
        onChange={(evento) => setCostoTotal(evento.target.value)}
        required
      />

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      <div className="acciones-formulario">
        <button type="button" className="boton-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
