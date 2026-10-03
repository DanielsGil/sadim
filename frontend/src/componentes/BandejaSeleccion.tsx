import { useState, type ReactNode } from 'react'
import { ContadorCantidad } from './ContadorCantidad'
import { unidadesEnBandeja, type ItemBandeja } from './bandeja'

interface Props {
  items: ItemBandeja[]
  onCambiarCantidad: (productoId: string, cantidad: number) => void
  onQuitar: (productoId: string) => void
  /** Texto del botón; se le agrega el número de unidades, p. ej. «Agregar a la mesa (3)». */
  textoBoton: string
  /** E-17: texto del botón en la barra compacta de celular («Agregar», «Cobrar»). */
  textoBotonCorto: string
  /**
   * E-17: si es false, el botón de la barra compacta solo expande la hoja
   * (la venta rápida necesita elegir el medio de pago antes de cobrar).
   */
  confirmarDesdeBarra?: boolean
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
 * E-17: en celular es por defecto una barra compacta («n productos · total ·
 * Agregar») y al tocarla se expande como hoja de máximo ~media pantalla, con
 * la lista desplazable por dentro; así el selector siempre queda usable.
 */
export function BandejaSeleccion({
  items,
  onCambiarCantidad,
  onQuitar,
  textoBoton,
  textoBotonCorto,
  confirmarDesdeBarra = true,
  textoProcesando,
  onConfirmar,
  procesando = false,
  deshabilitado = false,
  children,
}: Props) {
  const [expandida, setExpandida] = useState(false)
  const unidades = unidadesEnBandeja(items)
  const conError = items.filter((item) => item.error).length
  const totalEstimado = items.reduce(
    (suma, item) => suma + Number(item.producto.precio_venta) * item.cantidad,
    0,
  )

  return (
    <aside
      className={`bandeja-seleccion ${items.length === 0 ? 'bandeja-vacia' : ''} ${expandida ? 'bandeja-expandida' : ''}`}
      aria-label="Selección"
    >
      {/* E-17: barra compacta, solo visible en celular mientras la hoja está recogida. */}
      <div className="bandeja-barra-compacta">
        <button
          type="button"
          className="bandeja-barra-resumen"
          aria-expanded={expandida}
          onClick={() => setExpandida(true)}
        >
          <strong>
            {unidades} producto{unidades === 1 ? '' : 's'}
          </strong>
          {` · ${totalEstimado.toFixed(2)}`}
          {conError > 0 && <span className="bandeja-barra-error">{` · ${conError} con error`}</span>}
        </button>
        <button
          type="button"
          disabled={procesando || deshabilitado || items.length === 0}
          onClick={confirmarDesdeBarra ? onConfirmar : () => setExpandida(true)}
        >
          {procesando ? textoProcesando : textoBotonCorto}
        </button>
      </div>

      <div className="bandeja-encabezado">
        <h3>Selección</h3>
        <button type="button" className="boton-secundario bandeja-ocultar" onClick={() => setExpandida(false)}>
          Ocultar
        </button>
      </div>
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

      <div className="bandeja-pie">
      <p className="campo-solo-lectura">
        Total estimado: <strong>{totalEstimado.toFixed(2)}</strong> (lo confirma el servidor)
      </p>

      {children}

      <div className="acciones-formulario">
        <button type="button" disabled={procesando || deshabilitado || items.length === 0} onClick={onConfirmar}>
          {procesando ? textoProcesando : `${textoBoton} (${unidades})`}
        </button>
      </div>
      </div>
    </aside>
  )
}
