import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './componentes/Layout'
import { RutaProtegida } from './componentes/RutaProtegida'
import { RutaSoloAdmin } from './componentes/RutaSoloAdmin'
import { Catalogo } from './paginas/Catalogo'
import { Configuracion } from './paginas/Configuracion'
import { DetalleSesion } from './paginas/DetalleSesion'
import { Inicio } from './paginas/Inicio'
import { IngresoMercancia } from './paginas/IngresoMercancia'
import { Login } from './paginas/Login'
import { Mesas } from './paginas/Mesas'
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
          <Route path="/inventario/ingreso" element={<IngresoMercancia />} />
          <Route element={<RutaSoloAdmin />}>
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/mesas" element={<Mesas />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
