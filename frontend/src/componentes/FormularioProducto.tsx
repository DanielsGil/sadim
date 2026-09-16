import { useState, type FormEvent } from 'react'
import { crearProducto, editarProducto, type DatosProducto } from '../api/catalogo'
import { ErrorApi } from '../api/errorApi'
import type { Categoria, Producto, TipoProducto } from '../tipos/dominio'

interface Props {
  categorias: Categoria[]
  productoInicial?: Producto
  onGuardado: (producto: Producto) => void
  onCancelar: () => void
}

/**
 * Crear/editar producto — CU-05. stock_actual se muestra pero nunca se
 * envía: lo calcula el backend (ERD §5.6, Contrato §6).
 */
export function FormularioProducto({ categorias, productoInicial, onGuardado, onCancelar }: Props) {
  const [categoriaId, setCategoriaId] = useState(
    productoInicial?.categoria_id ?? categorias[0]?.id ?? '',
  )
  const [nombre, setNombre] = useState(productoInicial?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoProducto>(productoInicial?.tipo ?? 'REVENTA_DIRECTA')
  const [precioVenta, setPrecioVenta] = useState(String(productoInicial?.precio_venta ?? ''))
  const [costoProduccion, setCostoProduccion] = useState(
    productoInicial?.costo_produccion != null ? String(productoInicial.costo_produccion) : '',
  )
  const [unidadMedida, setUnidadMedida] = useState(productoInicial?.unidad_medida ?? '')
  const [stockMinimo, setStockMinimo] = useState(String(productoInicial?.stock_minimo ?? '0'))
  const [controlaStock, setControlaStock] = useState(productoInicial?.controla_stock ?? true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const datos: DatosProducto = {
        categoria_id: categoriaId,
        nombre,
        tipo,
        precio_venta: Number(precioVenta),
        costo_produccion: costoProduccion === '' ? null : Number(costoProduccion),
        unidad_medida: unidadMedida,
        stock_minimo: Number(stockMinimo),
        controla_stock: controlaStock,
      }
      const producto = productoInicial
        ? await editarProducto(productoInicial.id, datos)
        : await crearProducto(datos)
      onGuardado(producto)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el producto.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario-panel" onSubmit={manejarEnvio}>
      <h3>{productoInicial ? 'Editar producto' : 'Nuevo producto'}</h3>

      <label htmlFor="producto-categoria">Categoría</label>
      <select
        id="producto-categoria"
        value={categoriaId}
        onChange={(evento) => setCategoriaId(evento.target.value)}
        required
      >
        {categorias.map((categoria) => (
          <option key={categoria.id} value={categoria.id}>
            {categoria.nombre}
          </option>
        ))}
      </select>

      <label htmlFor="producto-nombre">Nombre</label>
      <input
        id="producto-nombre"
        value={nombre}
        onChange={(evento) => setNombre(evento.target.value)}
        required
      />

      <label htmlFor="producto-tipo">Tipo</label>
      <select
        id="producto-tipo"
        value={tipo}
        onChange={(evento) => setTipo(evento.target.value as TipoProducto)}
      >
        <option value="REVENTA_DIRECTA">Reventa directa</option>
        <option value="INSUMO_PRODUCCION">Insumo de producción</option>
      </select>

      <label htmlFor="producto-precio">Precio de venta (COP)</label>
      <input
        id="producto-precio"
        type="number"
        min="0"
        step="0.01"
        value={precioVenta}
        onChange={(evento) => setPrecioVenta(evento.target.value)}
        required
      />

      <label htmlFor="producto-costo">Costo de producción (COP, opcional)</label>
      <input
        id="producto-costo"
        type="number"
        min="0"
        step="0.01"
        value={costoProduccion}
        onChange={(evento) => setCostoProduccion(evento.target.value)}
      />

      <label htmlFor="producto-unidad">Unidad de medida</label>
      <input
        id="producto-unidad"
        value={unidadMedida}
        onChange={(evento) => setUnidadMedida(evento.target.value)}
        placeholder="unidad, kg, litro…"
        required
      />

      <label className="etiqueta-checkbox">
        <input
          type="checkbox"
          checked={controlaStock}
          onChange={(evento) => setControlaStock(evento.target.checked)}
        />
        Controla existencias propias
      </label>

      {controlaStock && (
        <>
          <label htmlFor="producto-stock-minimo">Stock mínimo</label>
          <input
            id="producto-stock-minimo"
            type="number"
            min="0"
            step="0.01"
            value={stockMinimo}
            onChange={(evento) => setStockMinimo(evento.target.value)}
          />
        </>
      )}

      {productoInicial && (
        <p className="campo-solo-lectura">
          Stock actual: <strong>{productoInicial.stock_actual}</strong> (lo calcula el backend;
          no se edita aquí)
        </p>
      )}

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
