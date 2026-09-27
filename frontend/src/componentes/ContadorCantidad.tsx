interface Props {
  id: string
  valor: number
  onCambiar: (valor: number) => void
  minimo?: number
  deshabilitado?: boolean
}

/**
 * E-08 (Lote de correcciones 3): contador "−/número/+" para cantidad, sin
 * decimales en la interfaz. El campo `cantidad` sigue siendo DECIMAL en el
 * backend (ERD: negocios que vendan por peso en el futuro) — esto es solo
 * una restricción de la UI de Aroma & Co, que vende por unidades.
 */
export function ContadorCantidad({ id, valor, onCambiar, minimo = 1, deshabilitado = false }: Props) {
  function ajustar(delta: number) {
    onCambiar(Math.max(minimo, Math.round(valor) + delta))
  }

  return (
    <div className="contador-cantidad">
      <button
        type="button"
        className="boton-secundario"
        onClick={() => ajustar(-1)}
        disabled={deshabilitado || valor <= minimo}
        aria-label="Disminuir cantidad"
      >
        −
      </button>
      <span id={id} className="contador-cantidad-valor" aria-live="polite">
        {Math.round(valor)}
      </span>
      <button
        type="button"
        className="boton-secundario"
        onClick={() => ajustar(1)}
        disabled={deshabilitado}
        aria-label="Aumentar cantidad"
      >
        +
      </button>
    </div>
  )
}
