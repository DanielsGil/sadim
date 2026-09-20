import { useEffect, useState, type FormEvent } from 'react'
import {
  actualizarConfiguracionModulos,
  actualizarConfiguracionPagos,
  obtenerConfiguracionModulos,
  obtenerConfiguracionPagos,
} from '../api/configuracion'
import { ErrorApi } from '../api/errorApi'
import { useSesion } from '../contexto/SesionContext'
import type { ConfiguracionModulo, ConfiguracionPago } from '../tipos/dominio'

type CampoModulo = 'ventas_activo' | 'inventario_activo' | 'servicios_activo' | 'finanzas_activo'

const MODULOS: Array<{ campo: CampoModulo; etiqueta: string }> = [
  { campo: 'ventas_activo', etiqueta: 'Ventas' },
  { campo: 'inventario_activo', etiqueta: 'Inventario' },
  { campo: 'servicios_activo', etiqueta: 'Servicios' },
  { campo: 'finanzas_activo', etiqueta: 'Finanzas' },
]

/** Configuración de módulos (HU-042) y medios de pago (HU-049) — solo ADMIN. */
export function Configuracion() {
  const { recargarModulos } = useSesion()
  const [modulos, setModulos] = useState<ConfiguracionModulo | null>(null)
  const [pagos, setPagos] = useState<ConfiguracionPago | null>(null)
  const [nequiTitular, setNequiTitular] = useState('')
  const [nequiLlave, setNequiLlave] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorModulos, setErrorModulos] = useState<string | null>(null)
  const [errorPagos, setErrorPagos] = useState<string | null>(null)
  const [guardandoPagos, setGuardandoPagos] = useState(false)

  useEffect(() => {
    Promise.all([obtenerConfiguracionModulos(), obtenerConfiguracionPagos()])
      .then(([modulosObtenidos, pagosObtenidos]) => {
        setModulos(modulosObtenidos)
        setPagos(pagosObtenidos)
        setNequiTitular(pagosObtenidos.nequi_titular ?? '')
        setNequiLlave(pagosObtenidos.nequi_llave ?? '')
      })
      .catch((err: unknown) => {
        const mensaje = err instanceof ErrorApi ? err.message : 'No se pudo cargar la configuración.'
        setErrorModulos(mensaje)
        setErrorPagos(mensaje)
      })
      .finally(() => setCargando(false))
  }, [])

  async function alternarModulo(campo: CampoModulo) {
    if (!modulos) return
    setErrorModulos(null)
    try {
      const actualizado = await actualizarConfiguracionModulos({ [campo]: !modulos[campo] })
      setModulos(actualizado)
      await recargarModulos() // refresca el menú (HU-042)
    } catch (err) {
      setErrorModulos(err instanceof ErrorApi ? err.message : 'No se pudo cambiar el módulo.')
    }
  }

  async function guardarPagos(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!pagos) return
    setErrorPagos(null)
    setGuardandoPagos(true)
    try {
      const actualizado = await actualizarConfiguracionPagos({
        acepta_efectivo: pagos.acepta_efectivo,
        acepta_transferencia: pagos.acepta_transferencia,
        acepta_qr: pagos.acepta_qr,
        nequi_titular: nequiTitular || null,
        nequi_llave: nequiLlave || null,
      })
      setPagos(actualizado)
    } catch (err) {
      setErrorPagos(err instanceof ErrorApi ? err.message : 'No se pudo guardar la configuración de pagos.')
    } finally {
      setGuardandoPagos(false)
    }
  }

  if (cargando) {
    return <p className="cargando">Cargando configuración…</p>
  }

  return (
    <div className="pagina-configuracion">
      <h1>Configuración</h1>

      <section className="seccion-modulos">
        <h2>Módulos</h2>
        {errorModulos && (
          <p className="mensaje-error" role="alert">
            {errorModulos}
          </p>
        )}
        {modulos && (
          <ul className="lista-modulos">
            {MODULOS.map(({ campo, etiqueta }) => (
              <li key={campo}>
                <label className="etiqueta-checkbox">
                  <input
                    type="checkbox"
                    checked={modulos[campo]}
                    onChange={() => void alternarModulo(campo)}
                  />
                  {etiqueta}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="seccion-pagos">
        <h2>Medios de pago</h2>
        {pagos && (
          <form className="formulario-panel" onSubmit={guardarPagos}>
            <label className="etiqueta-checkbox">
              <input
                type="checkbox"
                checked={pagos.acepta_efectivo}
                onChange={(evento) =>
                  setPagos({ ...pagos, acepta_efectivo: evento.target.checked })
                }
              />
              Efectivo
            </label>
            <label className="etiqueta-checkbox">
              <input
                type="checkbox"
                checked={pagos.acepta_transferencia}
                onChange={(evento) =>
                  setPagos({ ...pagos, acepta_transferencia: evento.target.checked })
                }
              />
              Transferencia
            </label>
            <label className="etiqueta-checkbox">
              <input
                type="checkbox"
                checked={pagos.acepta_qr}
                onChange={(evento) => setPagos({ ...pagos, acepta_qr: evento.target.checked })}
              />
              QR
            </label>

            <label htmlFor="pagos-nequi-titular">Titular Nequi</label>
            <input
              id="pagos-nequi-titular"
              value={nequiTitular}
              onChange={(evento) => setNequiTitular(evento.target.value)}
            />

            <label htmlFor="pagos-nequi-llave">
              Llave Nequi
              {(pagos.acepta_transferencia || pagos.acepta_qr) && ' (obligatoria)'}
            </label>
            <input
              id="pagos-nequi-llave"
              value={nequiLlave}
              onChange={(evento) => setNequiLlave(evento.target.value)}
              required={pagos.acepta_transferencia || pagos.acepta_qr}
            />

            {errorPagos && (
              <p className="mensaje-error" role="alert">
                {errorPagos}
              </p>
            )}

            <div className="acciones-formulario">
              <button type="submit" disabled={guardandoPagos}>
                {guardandoPagos ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
