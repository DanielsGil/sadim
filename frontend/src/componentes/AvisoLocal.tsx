/** Aviso de lectura desde la copia local (HU-030): visible solo sin conexión. */
export function AvisoCopiaLocal({ enLinea }: { enLinea: boolean }) {
  if (enLinea) return null
  return (
    <p className="campo-solo-lectura">
      Sin conexión: mostrando la copia local. Los datos pueden no estar actualizados.
    </p>
  )
}

/** Marca un valor calculado en el dispositivo (saldo, utilidad, stock): el servidor lo recalcula al sincronizar (D22). */
export function EtiquetaProvisional({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <span className="etiqueta-provisional" title="Se recalcula en el servidor al sincronizar">
      provisional
    </span>
  )
}
