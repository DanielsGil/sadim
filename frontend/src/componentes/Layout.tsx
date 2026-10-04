import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { servidorDisponible } from '../api/salud'
import { IndicadorConectividad } from './IndicadorConectividad'
import { useElementosNavegacion } from './navegacion'
import {
  calcularInicioInactividad,
  INACTIVIDAD_SESION,
  TemporizadorInactividad,
  type EstadoInactividad,
} from '../contexto/inactividad'
import { useSesion } from '../contexto/SesionContext'
import { guardarUltimaActividad, obtenerUltimaActividad } from '../db/baseLocal'
import { contarOperacionesPendientes } from '../sync/enrutador'

const EVENTOS_ACTIVIDAD = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
/** F-20: cada cuánto, como máximo, se escribe `meta.ultima_actividad` en Dexie. */
const INTERVALO_GUARDADO_ACTIVIDAD_MS = 30 * 1000

/**
 * Estructura de escritorio con navegación lateral (criterio de diseño de los
 * wireframes, §"Criterio de diseño"), y en pantallas <768px una barra de
 * navegación inferior fija con hoja "Más" (E-01, lote de correcciones 1):
 * la lista de secciones y su ocultamiento por rol/módulo es la MISMA en
 * ambos casos (`useElementosNavegacion`), solo cambia la presentación.
 *
 * HU-042: el catálogo, usuarios y configuración son rutas del núcleo y no
 * dependen de ninguna bandera (Contrato v2 §12); Ventas/Mesas, Inventario y
 * Caja sí se ocultan cuando su bandera está desactivada (`modulos?.x_activo`).
 * Antes de que `modulos` termine de cargar (null) se muestran de más en vez de
 * ocultar por error: el backend igual aplica la regla real (ADR-005/006).
 */
export function Layout() {
  const { sesion, cerrarSesion } = useSesion()
  const elementos = useElementosNavegacion()
  const navigate = useNavigate()
  const [errorCierre, setErrorCierre] = useState<string | null>(null)
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const [cuentaAbierta, setCuentaAbierta] = useState(false)
  const [estadoInactividad, setEstadoInactividad] = useState<EstadoInactividad>('ACTIVA')
  const cerrarSesionRef = useRef(cerrarSesion)

  useEffect(() => {
    cerrarSesionRef.current = cerrarSesion
  })

  // D27 (E-11): cierre por inactividad para ambos roles. Solo se cierra con
  // red, con la cola vacía (D21/D23) y con el servidor respondiendo (F-19:
  // navigator.onLine no basta con wifi sin internet o Render dormido);
  // cerrarSesion borra los tokens, nunca la cola ni la copia local.
  useEffect(() => {
    const temporizador = new TemporizadorInactividad({
      puedeCerrar: async () =>
        navigator.onLine && (await contarOperacionesPendientes()) === 0 && (await servidorDisponible()),
      cerrar: async () => {
        try {
          await cerrarSesionRef.current()
          navigate('/login', { replace: true })
        } catch {
          // Entró una operación a la cola justo ahora: se sigue contando.
          temporizador.iniciar()
        }
      },
      alCambiarEstado: setEstadoInactividad,
    })
    let cancelado = false
    let ultimaActividad = 0
    let ultimoGuardado = 0
    const alInteractuar = () => {
      const ahora = Date.now()
      if (ahora - ultimaActividad < 1000) return
      ultimaActividad = ahora
      temporizador.registrarActividad()
      // F-20: la última actividad se guarda en Dexie como máximo cada 30 s.
      if (ahora - ultimoGuardado >= INTERVALO_GUARDADO_ACTIVIDAD_MS) {
        ultimoGuardado = ahora
        void guardarUltimaActividad(ahora)
      }
    }
    // F-20: al ocultar o cerrar la página se guarda el último toque exacto.
    const alOcultar = () => {
      if (ultimaActividad > 0) void guardarUltimaActividad(ultimaActividad)
    }
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'hidden') alOcultar()
    }
    const alConectar = () => temporizador.reintentarAhora()

    // F-20: la cuenta sigue desde la última actividad guardada (también con la
    // app cerrada); si ya pasaron 30 min, se aplica de inmediato la regla de F-19.
    void obtenerUltimaActividad()
      .catch(() => undefined)
      .then((guardada) => {
        if (cancelado) return
        const ahora = Date.now()
        // Un toque mientras se leía Dexie también cuenta; el valor en el futuro lo resuelve la función pura.
        const referencia = guardada === undefined ? undefined : Math.max(guardada, ultimaActividad)
        temporizador.iniciar(calcularInicioInactividad(referencia, ahora).transcurridoMs)
      })
    for (const evento of EVENTOS_ACTIVIDAD) {
      window.addEventListener(evento, alInteractuar, { passive: true, capture: true })
    }
    window.addEventListener('online', alConectar)
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    window.addEventListener('pagehide', alOcultar)
    return () => {
      cancelado = true
      temporizador.detener()
      for (const evento of EVENTOS_ACTIVIDAD) {
        window.removeEventListener(evento, alInteractuar, { capture: true })
      }
      window.removeEventListener('online', alConectar)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      window.removeEventListener('pagehide', alOcultar)
    }
  }, [navigate])

  // Máximo 5 elementos visibles a la vez en la barra inferior (E-01): si hay
  // más de 5 secciones en total, se muestran las primeras 4 y el resto pasa
  // al botón "Más"; si hay 5 o menos, caben todas sin necesidad de "Más".
  const necesitaMas = elementos.length > 5
  const primarios = necesitaMas ? elementos.slice(0, 4) : elementos
  const restantes = necesitaMas ? elementos.slice(4) : []

  const etiquetaRol = sesion?.rol === 'ADMIN' ? 'Administrador' : 'Operador'
  const nombreUsuario = sesion?.username ?? 'Usuario'

  async function manejarCerrarSesion() {
    try {
      setErrorCierre(null)
      // D21: con operaciones en la cola, cerrarSesion lanza el error que explica por qué.
      await cerrarSesion()
      navigate('/login', { replace: true })
    } catch (error) {
      setErrorCierre(error instanceof Error ? error.message : 'No se pudo cerrar sesión.')
    }
  }

  return (
    <div className="app-shell">
      <aside className="barra-lateral">
        <div className="marca">SADIM</div>
        <nav className="navegacion-lateral">
          {elementos.map((elemento) => (
            <NavLink key={elemento.to} to={elemento.to} end={elemento.fin}>
              {elemento.etiqueta}
            </NavLink>
          ))}
        </nav>
        <div className="barra-lateral-pie">
          <IndicadorConectividad />
          <span className="usuario-actual">{nombreUsuario}</span>
          <span className="rol-actual">{etiquetaRol}</span>
          {errorCierre && (
            <p className="mensaje-error" role="alert">
              {errorCierre}
            </p>
          )}
          <button type="button" className="boton-secundario" onClick={manejarCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* E-16: en celular, la cuenta (usuario, rol y «Cerrar sesión») vive en una
          barra superior fija, siempre visible para ambos roles, sin depender de
          cuántas secciones haya ni de si aparece «Más». */}
      <header className="barra-superior-movil">
        <span className="marca">SADIM</span>
        <button
          type="button"
          className="boton-cuenta"
          aria-expanded={cuentaAbierta}
          aria-label="Cuenta"
          onClick={() => setCuentaAbierta((abierta) => !abierta)}
        >
          <span aria-hidden="true">👤</span> {nombreUsuario}
        </button>
        {cuentaAbierta && (
          <div className="panel-cuenta">
            <strong className="usuario-actual">{nombreUsuario}</strong>
            <span className="rol-actual">{etiquetaRol}</span>
            <IndicadorConectividad />
            {errorCierre && (
              <p className="mensaje-error" role="alert">
                {errorCierre}
              </p>
            )}
            <button type="button" className="boton-secundario" onClick={manejarCerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      <main className="contenido-principal">
        {estadoInactividad === 'AVISO' && (
          <p className="aviso-inactividad" role="alert">
            Por inactividad, la sesión se cerrará en {Math.round(INACTIVIDAD_SESION.avisoMs / 1000)}{' '}
            segundos. Toca la pantalla para seguir trabajando.
          </p>
        )}
        {estadoInactividad === 'EXPIRADA_PENDIENTE' && (
          <p className="aviso-inactividad" role="alert">
            La sesión expiró por inactividad. No se cierra todavía porque no hay conexión o quedan
            operaciones sin sincronizar. Si sigues trabajando, la sesión continúa; si no, se cerrará
            apenas haya conexión y todo quede sincronizado.
          </p>
        )}
        <Outlet />
      </main>

      <nav className="barra-inferior" aria-label="Navegación principal">
        {primarios.map((elemento) => (
          <NavLink key={elemento.to} to={elemento.to} end={elemento.fin} className="item-barra-inferior">
            <span className="icono-barra-inferior" aria-hidden="true">
              {elemento.icono}
            </span>
            <span>{elemento.etiquetaCorta}</span>
          </NavLink>
        ))}
        {necesitaMas && (
          <button
            type="button"
            className="item-barra-inferior boton-mas"
            onClick={() => setHojaAbierta(true)}
          >
            <span className="icono-barra-inferior" aria-hidden="true">
              ⋯
            </span>
            <span>Más</span>
          </button>
        )}
      </nav>

      {hojaAbierta && (
        <div className="fondo-hoja" onClick={() => setHojaAbierta(false)}>
          <div className="hoja-mas" onClick={(evento) => evento.stopPropagation()}>
            <div className="hoja-mas-agarradera" aria-hidden="true" />
            <nav className="lista-hoja-mas">
              {restantes.map((elemento) => (
                <NavLink
                  key={elemento.to}
                  to={elemento.to}
                  end={elemento.fin}
                  onClick={() => setHojaAbierta(false)}
                >
                  <span aria-hidden="true">{elemento.icono}</span> {elemento.etiqueta}
                </NavLink>
              ))}
            </nav>
            <div className="hoja-mas-pie">
              <IndicadorConectividad />
              <span className="rol-actual">
                {sesion?.rol === 'ADMIN' ? 'Administrador' : 'Operador'}
              </span>
              {errorCierre && (
                <p className="mensaje-error" role="alert">
                  {errorCierre}
                </p>
              )}
              <button type="button" className="boton-secundario" onClick={manejarCerrarSesion}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
