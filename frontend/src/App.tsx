import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './componentes/Layout'
import { RutaProtegida } from './componentes/RutaProtegida'
import { RutaSoloAdmin } from './componentes/RutaSoloAdmin'
import { Caja } from './paginas/Caja'
import { Catalogo } from './paginas/Catalogo'
import { CierreCaja } from './paginas/CierreCaja'
import { Configuracion } from './paginas/Configuracion'
import { DetalleOrden } from './paginas/DetalleOrden'
import { DetalleSesion } from './paginas/DetalleSesion'
import { Dispositivos } from './paginas/Dispositivos'
import { Inicio } from './paginas/Inicio'
import { Inventario } from './paginas/Inventario'
import { Login } from './paginas/Login'
import { Mesas } from './paginas/Mesas'
import { Novedades } from './paginas/Novedades'
import { Ordenes } from './paginas/Ordenes'
import { Usuarios } from './paginas/Usuarios'
import { Ventas } from './paginas/Ventas'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/ventas/mesas/:mesaId" element={<DetalleSesion />} />
          <Route path="/inventario" element={<Inventario />} />
          {/* E-13: el ingreso de mercancía vive dentro de Inventario; la ruta vieja redirige. */}
          <Route path="/inventario/ingreso" element={<Navigate to="/inventario" replace />} />
          <Route path="/ordenes" element={<Ordenes />} />
          <Route path="/ordenes/:ordenId" element={<DetalleOrden />} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/novedades" element={<Novedades />} />
          <Route element={<RutaSoloAdmin />}>
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/mesas" element={<Mesas />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/caja/cierre" element={<CierreCaja />} />
            <Route path="/dispositivos" element={<Dispositivos />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
