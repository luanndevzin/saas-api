import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApi } from "../lib/api-provider";

interface Props {
  roles: string[];
  fallback?: string;
  children: ReactNode;
}

export function RequireRoles({ roles, fallback = "/", children }: Props) {
  const { me, token } = useApi();
  const location = useLocation();

  // Sem token -> login
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  // Com token mas sem /me carregado ainda: deixa passar para evitar redirects indevidos
  if (!me) return <>{children}</>;
  if (!roles.includes(me.role)) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
