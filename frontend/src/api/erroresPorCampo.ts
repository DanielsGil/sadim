import { ErrorApi } from './errorApi'

/**
 * E-06 (Lote de correcciones 3): el Contrato §14 devuelve {code, message,
 * details}, y `details` de un error de validación es {campo: [mensajes]}
 * (DRF ValidationError). Esto extrae el primer mensaje de cada campo para
 * mostrarlo debajo de su casilla. Si `details` no tiene esa forma (por
 * ejemplo {productos:[...]} de STOCK_INSUFICIENTE), no aporta nada aquí —
 * ese caso lo sigue resolviendo `mensajeErrorApi`.
 */
export function erroresPorCampo(err: unknown): Record<string, string> {
  if (!(err instanceof ErrorApi)) return {}
  const resultado: Record<string, string> = {}
  for (const [campo, valor] of Object.entries(err.details)) {
    if (Array.isArray(valor) && typeof valor[0] === 'string') {
      resultado[campo] = valor[0]
    } else if (typeof valor === 'string') {
      resultado[campo] = valor
    }
  }
  return resultado
}
