/**
 * D27 (E-11, Lote de correcciones 4): cierre de sesión por inactividad.
 * ÚNICA constante para cambiar los tiempos: 30 minutos sin interacción y
 * aviso 1 minuto antes. `reintentoMs` es cada cuánto se vuelve a intentar
 * el cierre si en el momento de expirar no se pudo (sin conexión o con cola).
 */
export const INACTIVIDAD_SESION = {
  limiteMs: 30 * 60 * 1000,
  avisoMs: 60 * 1000,
  reintentoMs: 15 * 1000,
} as const

/**
 * ACTIVA: todo normal. AVISO: falta un minuto; cualquier interacción lo cancela.
 * EXPIRADA_PENDIENTE: se cumplió el tiempo pero no se pudo cerrar (sin
 * conexión o con operaciones en la cola, D21/D23); se reintenta hasta poder.
 */
export type EstadoInactividad = 'ACTIVA' | 'AVISO' | 'EXPIRADA_PENDIENTE'

interface Opciones {
  limiteMs?: number
  avisoMs?: number
  reintentoMs?: number
  /** true si hay conexión y la cola de sincronización está vacía. */
  puedeCerrar: () => Promise<boolean>
  /** Cierra la sesión (borra tokens, nunca la cola ni la copia local) y lleva al login. */
  cerrar: () => Promise<void> | void
  alCambiarEstado: (estado: EstadoInactividad) => void
}

/**
 * Lógica pura del temporizador, sin React ni DOM, para poder probarla con
 * relojes simulados. Ejemplo en la cafetería: el operador deja la tablet en el
 * mostrador a las 3:00 p. m.; a las 3:29 aparece el aviso y a las 3:30 la app
 * vuelve al login — salvo que haya ventas sin sincronizar o no haya internet:
 * en ese caso solo avisa y cierra apenas todo quede sincronizado.
 */
export class TemporizadorInactividad {
  private readonly limiteMs: number
  private readonly avisoMs: number
  private readonly reintentoMs: number
  private readonly opciones: Opciones
  private estado: EstadoInactividad = 'ACTIVA'
  private temporizadores: ReturnType<typeof setTimeout>[] = []
  private detenido = true

  constructor(opciones: Opciones) {
    this.opciones = opciones
    this.limiteMs = opciones.limiteMs ?? INACTIVIDAD_SESION.limiteMs
    this.avisoMs = opciones.avisoMs ?? INACTIVIDAD_SESION.avisoMs
    this.reintentoMs = opciones.reintentoMs ?? INACTIVIDAD_SESION.reintentoMs
  }

  get estadoActual(): EstadoInactividad {
    return this.estado
  }

  iniciar(): void {
    this.detenido = false
    this.programar()
  }

  detener(): void {
    this.detenido = true
    this.limpiar()
  }

  /** Cualquier interacción del usuario reinicia la cuenta y cancela el aviso. */
  registrarActividad(): void {
    // Una vez expirada, la sesión se cierra apenas se pueda: la actividad no la revive.
    if (this.detenido || this.estado === 'EXPIRADA_PENDIENTE') return
    this.programar()
  }

  /** Para el evento 'online' o una cola que se vació: no esperar al siguiente reintento. */
  reintentarAhora(): void {
    if (this.detenido || this.estado !== 'EXPIRADA_PENDIENTE') return
    this.limpiar()
    void this.intentarCerrar()
  }

  private programar(): void {
    this.limpiar()
    this.cambiarEstado('ACTIVA')
    this.temporizadores.push(
      setTimeout(() => this.cambiarEstado('AVISO'), Math.max(0, this.limiteMs - this.avisoMs)),
      setTimeout(() => void this.intentarCerrar(), this.limiteMs),
    )
  }

  private async intentarCerrar(): Promise<void> {
    let puede = false
    try {
      puede = await this.opciones.puedeCerrar()
    } catch {
      puede = false
    }
    if (this.detenido) return
    if (puede) {
      this.detener()
      await this.opciones.cerrar()
      return
    }
    this.cambiarEstado('EXPIRADA_PENDIENTE')
    this.temporizadores.push(setTimeout(() => void this.intentarCerrar(), this.reintentoMs))
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
