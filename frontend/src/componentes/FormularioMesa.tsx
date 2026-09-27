import { useState, type FormEvent } from 'react'
import { crearMesa } from '../api/mesas'
import { ErrorApi } from '../api/errorApi'
import { erroresPorCampo } from '../api/erroresPorCampo'
import type { Mesa } from '../tipos/dominio'

interface Props {
  onGuardado: (mesa: Mesa) => void
  onCancelar: () => void
}

/** Crear mesa — CU-19, HU-043. numero va de 1 a 15 (ERD §5.7). */
export function FormularioMesa({ onGuardado, onCancelar }: Props) {
  const [numero, setNumero] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setErroresCampo({})
    setGuardando(true)
    try {
      const mesa = await crearMesa(Number(numero))
      onGuardado(mesa)
    } catch (err) {
      setErroresCampo(erroresPorCampo(err))
      setError(err instanceof ErrorApi ? err.message : 'No se pudo crear la mesa.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario-panel" onSubmit={manejarEnvio}>
      <h3>Nueva mesa</h3>

      <label htmlFor="mesa-numero">Número (1 a 15)</label>
      <input
        id="mesa-numero"
        type="number"
        min="1"
        max="15"
        value={numero}
        onChange={(evento) => setNumero(evento.target.value)}
        required
      />
      {erroresCampo.numero && <p className="mensaje-error-campo">{erroresCampo.numero}</p>}

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
