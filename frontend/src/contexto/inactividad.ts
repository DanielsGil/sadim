/**
 * D27 (E-11, Lote de correcciones 4): cierre de sesión por inactividad.
 * ÚNICA constante para cambiar los tiempos: 30 minutos sin interacción y
 * aviso 1 minuto antes. `reintentoMs` es cada cuánto se vuelve a intentar
 * el cierre si en el momento de expirar no se pudo (sin conexión, con cola o sin respuesta del servidor).
 */
export const INACTIVIDAD_SESION = {
  limiteMs: 30 * 60 * 1000,
  avisoMs: 60 * 1000,
  reintentoMs: 15 * 1000,
} as const

/**
 * ACTIVA: todo normal. AVISO: falta un minuto; cualquier interacción lo cancela.
 * EXPIRADA_PENDIENTE: se cumplió el tiempo pero no se pudo cerrar (sin
 * conexión, con operaciones en la cola o con el servidor sin responder,
 * D21/D23/F-19); se reintenta hasta poder,
 * salvo que el usuario vuelva a interactuar (E-15): ahí la cuenta empieza de nuevo.
 */
export type EstadoInactividad = 'ACTIVA' | 'AVISO' | 'EXPIRADA_PENDIENTE'

interface Opciones {
  limiteMs?: number
  avisoMs?: number
  reintentoMs?: number
  /**
   * true si se puede cerrar: hay red, la cola de sincronización está vacía y
   * el servidor responde (F-19). Es asíncrona: mientras corre, el temporizador
   * no lanza otra comprobación ni cierra si hubo actividad entretanto.
   */
  puedeCerrar: () => Promise<boolean>
  /** Cierra la sesión (borra tokens, nunca la cola ni la copia local) y lleva al login. */
  cerrar: () => Promise<void> | void
  alCambiarEstado: (estado: EstadoInactividad) => void
}

/**
 * Lógica pura del temporizador, sin React ni DOM, para poder probarla con
 * relojes simulados. Ejemplo en la cafetería: el operador deja la tablet en el
 * mostrador a las 3:00 p. m.; a las 3:29 aparece el aviso y a las 3:30 la app
 * vuelve al login — salvo que haya ventas sin sincronizar, no haya internet o
 * el servidor no conteste (por ejemplo, wifi del local sin salida a internet):
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
  /** F-19: hay una comprobación de `puedeCerrar` en curso; evita cierres dobles. */
  private comprobando = false
  /** Cambia con cada reinicio de la cuenta; si cambió durante la comprobación, no se cierra. */
  private ciclo = 0

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

  /**
   * Cualquier interacción del usuario reinicia la cuenta y cancela el aviso,
   * también después de expirar (E-15): un operador que sigue vendiendo sin
   * conexión no debe perder la sesión a mitad de una venta cuando la cola se vacíe.
   */
  registrarActividad(): void {
    if (this.detenido) return
    this.programar()
  }

  /** Para el evento 'online' o una cola que se vació: no esperar al siguiente reintento. */
  reintentarAhora(): void {
    if (this.detenido || this.estado !== 'EXPIRADA_PENDIENTE' || this.comprobando) return
    this.limpiar()
    void this.intentarCerrar()
  }

  private programar(): void {
    this.limpiar()
    this.ciclo += 1
    this.cambiarEstado('ACTIVA')
    this.temporizadores.push(
      setTimeout(() => this.cambiarEstado('AVISO'), Math.max(0, this.limiteMs - this.avisoMs)),
      setTimeout(() => void this.intentarCerrar(), this.limiteMs),
    )
  }

  private async intentarCerrar(): Promise<void> {
    if (this.comprobando) return
    this.comprobando = true
    const ciclo = this.ciclo
    let puede = false
    try {
      puede = await this.opciones.puedeCerrar()
    } catch {
      puede = false
    } finally {
      this.comprobando = false
    }
    // E-15: si el usuario tocó la pantalla mientras se comprobaba (hasta 5 s
    // esperando al servidor), la cuenta ya empezó de nuevo: no se cierra.
    if (this.detenido || ciclo !== this.ciclo) return
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
