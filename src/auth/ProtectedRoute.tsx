import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

type Props = {
  children: JSX.Element;
  allowedRoles?: Array<"admin" | "barbero">;
};

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading, role } = useAuth();
  if (loading) return <div className="p-6">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && allowedRoles.length > 0) {
    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/clientes" replace />;
    }
  }

  return children;
}
