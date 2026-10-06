/**
 * D30 (E-22, Lote de correcciones 7; reemplaza a D27, incluidos F-19 y F-20):
 * la app ya no cierra la sesión sola, se BLOQUEA. ÚNICA constante con los dos
 * tiempos: se bloquea al volver a la app (abrirla o traerla al frente) si
 * pasaron más de `regresoMs` desde la última interacción, y con la app
 * abierta a los `inactividadMs` sin interacción, con un aviso `avisoMs` antes.
 */
export const BLOQUEO_SESION = {
  regresoMs: 5 * 60 * 1000,
  inactividadMs: 15 * 60 * 1000,
  avisoMs: 60 * 1000,
} as const

/** ACTIVA: todo normal. AVISO: falta un minuto para bloquear; cualquier interacción lo cancela. */
export type EstadoInactividad = 'ACTIVA' | 'AVISO'

/**
 * Caso 1 de D30: al abrir la app o traerla al frente, ¿pasaron más de
 * `regresoMs` desde la última interacción (`meta.ultima_actividad`, F-20)?
 * Función pura para poder probarla. Sin valor guardado (sesión de antes de
 * F-20) no se bloquea; un valor en el futuro (reloj cambiado) se toma como ahora.
 * Ejemplo: el operador guarda la tablet a las 3:00 p. m. y la saca a las 3:04 —
 * sigue trabajando; si la saca a las 3:06, ve la pantalla de bloqueo.
 */
export function debeBloquearAlVolver(
  ultimaActividadMs: number | undefined,
  ahoraMs: number,
  regresoMs: number = BLOQUEO_SESION.regresoMs,
): boolean {
  if (ultimaActividadMs === undefined || !Number.isFinite(ultimaActividadMs)) return false
  return ahoraMs - ultimaActividadMs > regresoMs
}

interface Opciones {
  inactividadMs?: number
  avisoMs?: number
  /** Bloquea la app (nunca borra la cola, la copia local ni las bandejas). */
  bloquear: () => void
  alCambiarEstado: (estado: EstadoInactividad) => void
}

/**
 * Caso 2 de D30: temporizador de inactividad con la app abierta. Lógica pura,
 * sin React ni DOM, para poder probarla con relojes simulados. Ejemplo: la
 * tablet queda en el mostrador a las 3:00 p. m.; a las 3:14 aparece el aviso y
 * a las 3:15 la app se bloquea — sin cerrar la sesión ni tocar la cola.
 */
export class TemporizadorInactividad {
  private readonly inactividadMs: number
  private readonly avisoMs: number
  private readonly opciones: Opciones
  private estado: EstadoInactividad = 'ACTIVA'
  private temporizadores: ReturnType<typeof setTimeout>[] = []
  private detenido = true

  constructor(opciones: Opciones) {
    this.opciones = opciones
    this.inactividadMs = opciones.inactividadMs ?? BLOQUEO_SESION.inactividadMs
    this.avisoMs = opciones.avisoMs ?? BLOQUEO_SESION.avisoMs
  }

  get estadoActual(): EstadoInactividad {
    return this.estado
  }

  /** `transcurridoMs`: tiempo que ya pasó sin actividad; la cuenta sigue desde ahí. */
  iniciar(transcurridoMs = 0): void {
    this.detenido = false
    this.programar(transcurridoMs)
  }

  detener(): void {
    this.detenido = true
    this.limpiar()
  }

  /** Cualquier interacción reinicia la cuenta y cancela el aviso. */
  registrarActividad(): void {
    if (this.detenido) return
    this.programar()
  }

  private programar(transcurridoMs = 0): void {
    this.limpiar()
    this.cambiarEstado('ACTIVA')
    const restanteMs = this.inactividadMs - Math.max(0, transcurridoMs)
    if (restanteMs <= 0) {
      this.bloquear()
      return
    }
    const hastaAvisoMs = restanteMs - this.avisoMs
    if (hastaAvisoMs <= 0) {
      this.cambiarEstado('AVISO')
    } else {
      this.temporizadores.push(setTimeout(() => this.cambiarEstado('AVISO'), hastaAvisoMs))
    }
    this.temporizadores.push(setTimeout(() => this.bloquear(), restanteMs))
  }

  private bloquear(): void {
    this.detener()
    this.cambiarEstado('ACTIVA')
    this.opciones.bloquear()
  }

  private cambiarEstado(estado: EstadoInactividad): void {
    if (this.estado === estado) return
    this.estado = estado
    this.opciones.alCambiarEstado(estado)
  }

  private limpiar(): void {
    for (const temporizador of this.temporizadores) clearTimeout(temporizador)
    this.temporizadores = []
  }
}
