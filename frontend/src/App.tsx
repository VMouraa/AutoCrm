import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { InventoryPage } from './pages/InventoryPage'
import { CustomersPage } from './pages/CustomersPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { AuthProvider } from './auth/AuthProvider'
import { RequireSession } from './auth/RequireSession'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<RequireSession />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="estoque" element={<InventoryPage />} />
            <Route path="clientes" element={<CustomersPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
