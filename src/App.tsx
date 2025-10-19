import AuthProvider from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import ClientsList from "./pages/ClientsList";
import ClientDetail from "./pages/ClientDetail";
import Login from "./auth/Login";
import AdminUsers from "./pages/AdminUsers";
import Layout from "./components/Layout";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

export default function App(){
  return (
    <AuthProvider>
      <HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path="/" element={<Navigate to="/clientes" replace/>} />
          <Route path="/login" element={<Login/>}/>
          <Route
            path="/clientes"
            element={
              <ProtectedRoute>
                <Layout>
                  <ClientsList />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <ClientDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/usuarios"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Layout>
                  <AdminUsers />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
