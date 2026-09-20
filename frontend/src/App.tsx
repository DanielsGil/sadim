import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './componentes/Layout'
import { RutaProtegida } from './componentes/RutaProtegida'
import { RutaSoloAdmin } from './componentes/RutaSoloAdmin'
import { Catalogo } from './paginas/Catalogo'
import { Configuracion } from './paginas/Configuracion'
import { Inicio } from './paginas/Inicio'
import { Login } from './paginas/Login'
import { Usuarios } from './paginas/Usuarios'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Inicio />} />
          <Route element={<RutaSoloAdmin />}>
            <Route path="/catalogo" element={<Catalogo />} />
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
