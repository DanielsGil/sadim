import type { ReactNode } from 'react'
import { ContadorCantidad } from './ContadorCantidad'
import { unidadesEnBandeja, type ItemBandeja } from './bandeja'

interface Props {
  items: ItemBandeja[]
  onCambiarCantidad: (productoId: string, cantidad: number) => void
  onQuitar: (productoId: string) => void
  /** Texto del botón; se le agrega el número de unidades, p. ej. «Agregar a la mesa (3)». */
  textoBoton: string
  textoProcesando: string
  onConfirmar: () => void
  procesando?: boolean
  deshabilitado?: boolean
  /** Campos extra antes del botón (el medio de pago en la venta rápida). */
  children?: ReactNode
}

/**
 * E-12 (Lote de correcciones 5, reemplaza E-10): bandeja de selección. Cada
 * clic en una tarjeta suma 1 aquí; NADA se envía por tiempo ni al salir de la
 * pantalla — solo con el botón. Ejemplo: tres clics en "Capuchino" y uno en
 * "Croissant" dejan dos líneas (3 y 1) y el botón dice «Agregar a la mesa (4)».
 * En escritorio va al lado del selector; en celular, fija abajo, encima de la
 * barra de navegación.
 */
export function BandejaSeleccion({
  items,
  onCambiarCantidad,
  onQuitar,
  textoBoton,
  textoProcesando,
  onConfirmar,
  procesando = false,
  deshabilitado = false,
  children,
}: Props) {
  const unidades = unidadesEnBandeja(items)
  const totalEstimado = items.reduce(
    (suma, item) => suma + Number(item.producto.precio_venta) * item.cantidad,
    0,
  )

  return (
    <aside className={`bandeja-seleccion ${items.length === 0 ? 'bandeja-vacia' : ''}`} aria-label="Selección">
      <h3>Selección</h3>
      {items.length === 0 ? (
        <p className="texto-vacio">Toca un producto para agregarlo aquí.</p>
      ) : (
        <ul className="bandeja-lista">
          {items.map((item) => (
            <li key={item.producto.id} className="bandeja-item">
              <div className="bandeja-item-encabezado">
                <span className="bandeja-item-nombre">{item.producto.nombre}</span>
                <span className="bandeja-item-precio">{item.producto.precio_venta}</span>
              </div>
              <div className="bandeja-item-controles">
                <ContadorCantidad
                  id={`bandeja-cantidad-${item.producto.id}`}
                  valor={item.cantidad}
                  onCambiar={(cantidad) => onCambiarCantidad(item.producto.id, cantidad)}
                  deshabilitado={procesando}
                />
                <button
                  type="button"
                  className="boton-secundario"
                  disabled={procesando}
                  onClick={() => onQuitar(item.producto.id)}
                >
                  Quitar
                </button>
              </div>
              {item.aviso && <p className="campo-solo-lectura">{item.aviso}</p>}
              {item.error && (
                <p className="mensaje-error-campo" role="alert">
                  {item.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="campo-solo-lectura">
        Total estimado: <strong>{totalEstimado.toFixed(2)}</strong> (lo confirma el servidor)
      </p>

      {children}

      <div className="acciones-formulario">
        <button type="button" disabled={procesando || deshabilitado || items.length === 0} onClick={onConfirmar}>
          {procesando ? textoProcesando : `${textoBoton} (${unidades})`}
        </button>
      </div>
    </aside>
  )
}
