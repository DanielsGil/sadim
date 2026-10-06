import { useEffect, useState, type FormEvent } from 'react'
import { listarProductos } from '../api/catalogo'
import { obtenerConfiguracionPagos } from '../api/configuracion'
import { erroresPorCampo } from '../api/erroresPorCampo'
import { mensajeErrorApi } from '../api/errorApi'
import { registrarAjusteManual, registrarEntrada, registrarMerma } from '../api/inventarioMovimientos'
import { ContadorCantidad } from './ContadorCantidad'
import type { ConfiguracionPago, MedioPago, Producto } from '../tipos/dominio'

type TipoMovimiento = 'ENTRADA' | 'MERMA' | 'AJUSTE_MANUAL'

const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
}

interface Props {
  esAdmin: boolean
  /** Producto precargado al hacer clic en una fila de la tabla de existencias. */
  productoIdInicial: string | null
  /** Tras registrar: recargar existencias e historial en la pantalla. */
  onRegistrado: (productoId: string) => void
}

/**
 * E-13 (Lote de correcciones 5): panel único de movimientos dentro de
 * Inventario. Ingreso (CU-12, HU-025) para ambos roles; Merma y Ajuste
 * manual (CU-13, HU-026) solo ADMIN, como pestañas del mismo panel —
 * mismos permisos que antes (la autorización real sigue en el backend).
 */
export function PanelMovimientoInventario({ esAdmin, productoIdInicial, onRegistrado }: Props) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [tipo, setTipo] = useState<TipoMovimiento>('ENTRADA')
  const [productoId, setProductoId] = useState(productoIdInicial ?? '')
  const [sentido, setSentido] = useState<'SUMA' | 'RESTA'>('RESTA')
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState('')
  // D31 (E-23): costo opcional de la compra; si se llena, el medio es obligatorio.
  const [costoTotal, setCostoTotal] = useState('')
  const [medioPago, setMedioPago] = useState<MedioPago | ''>('')
  const [pagos, setPagos] = useState<ConfiguracionPago | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({})
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function cargarProductos() {
    listarProductos().then((lista) => {
      const conStock = lista.filter((producto) => producto.activo && producto.controla_stock)
      setProductos(conStock)
      setProductoId((actual) => actual || conStock[0]?.id || '')
    })
  }

  useEffect(cargarProductos, [])

  useEffect(() => {
    obtenerConfiguracionPagos().then(setPagos)
  }, [])

  const mediosHabilitados: MedioPago[] = pagos
    ? [
        ...(pagos.acepta_efectivo ? (['EFECTIVO'] as const) : []),
        ...(pagos.acepta_transferencia ? (['TRANSFERENCIA'] as const) : []),
        ...(pagos.acepta_qr ? (['QR'] as const) : []),
      ]
    : []

  // Clic en una fila de la tabla: precarga ese producto (sin efecto, patrón de "valor previo").
  const [inicialPrevio, setInicialPrevio] = useState(productoIdInicial)
  if (productoIdInicial !== inicialPrevio) {
    setInicialPrevio(productoIdInicial)
    if (productoIdInicial) setProductoId(productoIdInicial)
  }

  const pestanas: Array<{ valor: TipoMovimiento; etiqueta: string }> = [
    { valor: 'ENTRADA', etiqueta: 'Ingreso' },
    ...(esAdmin
      ? [
          { valor: 'MERMA' as const, etiqueta: 'Merma' },
          { valor: 'AJUSTE_MANUAL' as const, etiqueta: 'Ajuste' },
        ]
      : []),
  ]

  function cambiarPestana(nuevo: TipoMovimiento) {
    setTipo(nuevo)
    setError(null)
    setErroresCampo({})
    setMensaje(null)
  }

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setErroresCampo({})
    setMensaje(null)
    if (!productoId) {
      setError('Selecciona un producto.')
      return
    }
    const conCosto = tipo === 'ENTRADA' && costoTotal !== ''
    if (conCosto && !medioPago) {
      setErroresCampo({ medio_pago: 'Elige el medio de pago de la compra.' })
      return
    }
    setGuardando(true)
    try {
      if (tipo === 'ENTRADA') {
        const movimiento = await registrarEntrada(
          productoId,
          cantidad,
          motivo,
          conCosto && medioPago ? { costoTotal: Number(costoTotal), medioPago } : undefined,
        )
        setMensaje(
          conCosto
            ? `Ingreso registrado: +${movimiento.cantidad} unidades, con su gasto en Caja.`
            : `Ingreso registrado: +${movimiento.cantidad} unidades.`,
        )
        setCostoTotal('')
        setMedioPago('')
      } else if (tipo === 'MERMA') {
        await registrarMerma(productoId, cantidad, motivo)
        setMensaje('Merma registrada.')
      } else {
        await registrarAjusteManual(productoId, sentido, cantidad, motivo)
        setMensaje('Ajuste registrado.')
      }
      setCantidad(1)
      setMotivo('')
      cargarProductos()
      onRegistrado(productoId)
    } catch (err) {
      setErroresCampo(erroresPorCampo(err))
      setError(mensajeErrorApi(err, 'No se pudo registrar el movimiento.'))
    } finally {
      setGuardando(false)
    }
  }

  const textoBoton =
    tipo === 'ENTRADA' ? 'Registrar ingreso' : tipo === 'MERMA' ? 'Registrar merma' : 'Registrar ajuste'

  return (
    <section className="panel-movimiento">
      <h3>Registrar movimiento</h3>

      {pestanas.length > 1 && (
        <div className="pestanas" role="tablist">
          {pestanas.map((pestana) => (
            <button
              key={pestana.valor}
              type="button"
              role="tab"
              aria-selected={tipo === pestana.valor}
              className={`pestana ${tipo === pestana.valor ? 'pestana-activa' : ''}`}
              onClick={() => cambiarPestana(pestana.valor)}
            >
              {pestana.etiqueta}
            </button>
          ))}
        </div>
      )}

      {productos.length === 0 ? (
        <p className="texto-vacio">
          No hay productos con control de existencias (controla_stock) en el catálogo.
        </p>
      ) : (
        <form className="formulario-movimiento" onSubmit={manejarEnvio}>
          <label htmlFor="movimiento-producto">Producto</label>
          <select
            id="movimiento-producto"
            value={productoId}
            onChange={(evento) => setProductoId(evento.target.value)}
            required
          >
            {productos.map((producto) => (
              <option key={producto.id} value={producto.id}>
                {producto.nombre} (stock actual: {producto.stock_actual})
              </option>
            ))}
          </select>

          {tipo === 'AJUSTE_MANUAL' && (
            <>
              <label htmlFor="movimiento-sentido">Sentido</label>
              <select
                id="movimiento-sentido"
                value={sentido}
                onChange={(evento) => setSentido(evento.target.value as 'SUMA' | 'RESTA')}
              >
                <option value="SUMA">Suma (sobraban unidades)</option>
                <option value="RESTA">Resta (faltaban unidades)</option>
              </select>
            </>
          )}

          <label htmlFor="movimiento-cantidad">Cantidad</label>
          <ContadorCantidad id="movimiento-cantidad" valor={cantidad} onCambiar={setCantidad} />
          {erroresCampo.cantidad && <p className="mensaje-error-campo">{erroresCampo.cantidad}</p>}

          <label htmlFor="movimiento-motivo">{tipo === 'ENTRADA' ? 'Motivo (opcional)' : 'Motivo'}</label>
          <input
            id="movimiento-motivo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder={tipo === 'ENTRADA' ? 'Compra de mercancía…' : undefined}
            required={tipo !== 'ENTRADA'}
          />
          {erroresCampo.motivo && <p className="mensaje-error-campo">{erroresCampo.motivo}</p>}

          {tipo === 'ENTRADA' && (
            <>
              <label htmlFor="movimiento-costo">Costo total de la compra (opcional)</label>
              <input
                id="movimiento-costo"
                type="number"
                min="0.01"
                step="0.01"
                value={costoTotal}
                onChange={(evento) => setCostoTotal(evento.target.value)}
                placeholder="Se registra como gasto en Caja"
              />
              {erroresCampo.costo_total && <p className="mensaje-error-campo">{erroresCampo.costo_total}</p>}
              <label htmlFor="movimiento-medio-pago">
                {costoTotal !== '' ? 'Medio de pago' : 'Medio de pago (si hay costo)'}
              </label>
              <select
                id="movimiento-medio-pago"
                value={medioPago}
                onChange={(evento) => setMedioPago(evento.target.value as MedioPago)}
                required={costoTotal !== ''}
                disabled={costoTotal === ''}
              >
                <option value="">Selecciona uno</option>
                {mediosHabilitados.map((medio) => (
                  <option key={medio} value={medio}>{ETIQUETA_MEDIO_PAGO[medio]}</option>
                ))}
              </select>
              {erroresCampo.medio_pago && <p className="mensaje-error-campo">{erroresCampo.medio_pago}</p>}
            </>
          )}

          {mensaje && <p className="campo-solo-lectura">{mensaje}</p>}
          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}

          <div className="acciones-formulario">
            <button type="submit" disabled={guardando}>
              {guardando ? 'Registrando…' : textoBoton}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
