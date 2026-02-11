import { Link, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { useApi } from "../lib/api-provider";
import { useToast } from "./toast";
import { cn } from "../lib/utils";
import { LayoutDashboard, ShieldCheck, Users, Wallet, Receipt, Briefcase } from "lucide-react";

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["owner", "finance"] },
  { label: "Finance AP", to: "/finance/ap", icon: <Wallet className="h-4 w-4" />, roles: ["owner", "finance"] },
  { label: "Finance AR", to: "/finance/ar", icon: <Receipt className="h-4 w-4" />, roles: ["owner", "finance"] },
  { label: "HR", to: "/hr", icon: <Briefcase className="h-4 w-4" />, roles: ["owner", "hr"] },
  { label: "Members", to: "/members", icon: <Users className="h-4 w-4" />, roles: ["owner"] },
];

export function Shell({ children }: { children: ReactNode }) {
  const { baseUrl, me, logout, request, token } = useApi();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const filteredNav = useMemo(() => {
    if (!me) return navItems;
    return navItems.filter((item) => !item.roles || item.roles.includes(me.role));
  }, [me]);

  const handleHealth = async () => {
    setChecking(true);
    try {
      const data = await request<{ status: string }>("/health", { auth: false });
      toast({ title: "API ok", description: JSON.stringify(data), variant: "success" });
    } catch (err: any) {
      toast({ title: "Health check falhou", description: err.message, variant: "error" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="grid lg:grid-cols-[230px_1fr]">
        <aside className="hidden border-r border-border/70 bg-gradient-to-b from-card/80 to-background/90 lg:block">
          <div className="p-4">
            <div className="mb-6 space-y-1">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">SaaS Console</div>
              <div className="text-lg font-bold text-primary">Finance + HR</div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                {me ? `Tenant ${me.tenantId} • ${me.role}` : "Anon"}
              </div>
            </div>
            <nav className="space-y-1">
              {filteredNav.map((item) => {
                const active = location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="text-sm text-muted-foreground">Conectado em: <span className="font-medium text-foreground">{baseUrl}</span></div>
              <Button size="sm" variant="outline" onClick={handleHealth} disabled={checking}>
                {checking ? "Checando..." : "Verificar API"}
              </Button>
              <div className="ml-auto flex items-center gap-2 text-xs">
                {token ? <Badge variant="outline">Token ativo</Badge> : <Badge variant="warning">Sem token</Badge>}
                {me && <Badge variant="ghost">Role {me.role}</Badge>}
                {me ? (
                  <Button size="sm" variant="ghost" onClick={logout}>Sair</Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => navigate("/login")}>Entrar</Button>
                )}
              </div>
            </div>
          </header>

          <main className="container py-6">
            {token ? null : (
              <Card className="mb-5 border-dashed border-primary/40 bg-primary/5 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>Use as páginas Login ou Registro para gerar token.</div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => navigate("/login")} variant="default">Ir para Login</Button>
                    <Button size="sm" onClick={() => navigate("/register")} variant="outline">Registrar</Button>
                  </div>
                </div>
              </Card>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}



