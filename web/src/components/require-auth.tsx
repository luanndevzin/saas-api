import { Navigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { useApi } from "../lib/api-provider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, refreshMe } = useApi();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // tenta validar token carregando /me; se falhar, refreshMe limpa o estado
    refreshMe().finally(() => setChecked(true));
  }, [refreshMe]);

  // sem token -> login. Com token, permitimos seguir mesmo se /me falhar (evita redirect indevido).
  if (!token && checked) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;

  return <>{children}</>;
}
