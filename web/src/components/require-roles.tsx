import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApi } from "../lib/api-provider";

interface Props {
  roles: string[];
  fallback?: string;
  children: ReactNode;
}

export function RequireRoles({ roles, fallback = "/", children }: Props) {
  const { me } = useApi();
  const location = useLocation();

  if (!me) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!roles.includes(me.role)) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
