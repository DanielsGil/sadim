import { useState, type FormEvent } from 'react'
import { crearCategoria, editarCategoria } from '../api/catalogo'
import { ErrorApi } from '../api/errorApi'
import { erroresPorCampo } from '../api/erroresPorCampo'
import type { Categoria } from '../tipos/dominio'

interface Props {
  categoriaInicial?: Categoria
  onGuardado: (categoria: Categoria) => void
  onCancelar: () => void
}

/** Crear/editar categoría — CU-05. Solo se llega aquí como ADMIN. */
export function FormularioCategoria({ categoriaInicial, onGuardado, onCancelar }: Props) {
  const [nombre, setNombre] = useState(categoriaInicial?.nombre ?? '')
  const [error, setError] = useState<string | null>(null)
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setErroresCampo({})
    setGuardando(true)
    try {
      const categoria = categoriaInicial
        ? await editarCategoria(categoriaInicial.id, nombre)
        : await crearCategoria(nombre)
      onGuardado(categoria)
    } catch (err) {
      setErroresCampo(erroresPorCampo(err))
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar la categoría.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario-panel" onSubmit={manejarEnvio}>
      <h3>{categoriaInicial ? 'Editar categoría' : 'Nueva categoría'}</h3>

      <label htmlFor="categoria-nombre">Nombre</label>
      <input
        id="categoria-nombre"
        value={nombre}
        onChange={(evento) => setNombre(evento.target.value)}
        required
      />
      {erroresCampo.nombre && <p className="mensaje-error-campo">{erroresCampo.nombre}</p>}

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
