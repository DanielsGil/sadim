import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listarOrdenes } from '../api/ordenesTrabajo'
import { ErrorApi } from '../api/errorApi'
import { AvisoCopiaLocal, EtiquetaProvisional } from '../componentes/AvisoLocal'
import { FormularioOrden } from '../componentes/FormularioOrden'
import { useEstadoLocal } from '../sync/useEstadoLocal'
import type { EstadoOrden, OrdenTrabajo } from '../tipos/dominio'

const ETIQUETA_ESTADO: Record<EstadoOrden, string> = {
  RECIBIDO: 'Recibido',
  EN_PROCESO: 'En proceso',
  LISTO: 'Listo',
  ENTREGADO: 'Entregado',
}

/** Órdenes de trabajo (CU-06, HU-020) — listado y filtro por estado. */
export function Ordenes() {
  const navigate = useNavigate()
  const { enLinea, provisional } = useEstadoLocal()
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  function recargar() {
    setCargando(true)
    setError(null)
    listarOrdenes(filtroEstado || undefined)
      .then(setOrdenes)
      .catch((err: unknown) => {
        setError(err instanceof ErrorApi ? err.message : 'No se pudieron cargar las órdenes.')
      })
      .finally(() => setCargando(false))
  }

  useEffect(recargar, [filtroEstado])

  return (
    <div className="pagina-ordenes">
      <div className="encabezado-seccion">
        <h1>Órdenes de trabajo</h1>
        <button type="button" onClick={() => setMostrarFormulario(true)}>
          Nuevo pedido
        </button>
      </div>

      <div className="filtros-productos">
        <label htmlFor="ordenes-filtro-estado">Filtrar por estado</label>
        <select
          id="ordenes-filtro-estado"
          value={filtroEstado}
          onChange={(evento) => setFiltroEstado(evento.target.value)}
        >
          <option value="">Todos</option>
          {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>

      <AvisoCopiaLocal enLinea={enLinea} />

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      {mostrarFormulario && (
        <FormularioOrden
          onCancelar={() => setMostrarFormulario(false)}
          onGuardado={() => {
            setMostrarFormulario(false)
            recargar()
          }}
        />
      )}

      {cargando ? (
        <p className="cargando">Cargando órdenes…</p>
      ) : (
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Entrega estimada</th>
              <th>Estado</th>
              <th>Saldo pendiente</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((orden) => (
              <tr
                key={orden.id}
                className="fila-clicable"
                onClick={() => navigate(`/ordenes/${orden.id}`)}
              >
                <td>{orden.cliente_nombre}</td>
                <td>{orden.fecha_entrega_estimada}</td>
                <td>
                  <span className={`insignia-estado-orden-${orden.estado.toLowerCase()}`}>
                    {ETIQUETA_ESTADO[orden.estado]}
                  </span>
                </td>
                <td>
                  {orden.saldo_pendiente}
                  <EtiquetaProvisional visible={provisional} />
                </td>
              </tr>
            ))}
            {ordenes.length === 0 && (
              <tr>
                <td colSpan={4} className="texto-vacio">
                  Todavía no hay órdenes registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
