import { Link } from 'react-router-dom'
import { IndicadorConectividad } from '../componentes/IndicadorConectividad'
import { useElementosNavegacion } from '../componentes/navegacion'
import { useSesion } from '../contexto/SesionContext'

/**
 * Inicio (dashboard) — wireframe 2. E-02 (lote de correcciones 1): ya no dice
 * que ventas/sesiones/órdenes "se habilitan en los próximos pasos del Sprint
 * 3" (falso desde el Bloque 2). El saludo usa el rol, no el nombre: el login
 * (Contrato v2 §3) solo devuelve `usuario_id`/`rol`, y `nombre_completo` vive
 * detrás de `/api/usuarios/{id}/`, que es `EsAdmin`-only — un OPERADOR no
 * puede leer su propio nombre sin un endpoint nuevo. Mostrarlo requeriría un
 * cambio de backend, fuera de este lote (reportado como bloqueado).
 *
 * Las tarjetas KPI y la lista de mesas ocupadas del wireframe no se agregan
 * aquí: son cifras que hoy no se calculan en ningún endpoint (no inventar
 * indicadores). Sí se reutiliza el indicador de conectividad/cola existente
 * y los accesos a las secciones disponibles según rol y módulos activos —
 * misma lista que la navegación (`useElementosNavegacion`), sin duplicarla.
 */
export function Inicio() {
  const { sesion } = useSesion()
  const elementos = useElementosNavegacion().filter((elemento) => elemento.to !== '/')

  return (
    <div className="pagina-inicio">
      <h1>Hola{sesion?.rol === 'ADMIN' ? ', Administrador' : ', Operador'}</h1>
      <IndicadorConectividad />
      {elementos.length > 0 && (
        <>
          <h2>Accesos rápidos</h2>
          <div className="accesos-rapidos-inicio">
            {elementos.map((elemento) => (
              <Link key={elemento.to} to={elemento.to} className="acceso-rapido-inicio">
                <span aria-hidden="true">{elemento.icono}</span>
                {elemento.etiqueta}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
