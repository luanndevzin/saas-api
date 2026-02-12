import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { useApi } from "../lib/api-provider";
import { useToast } from "./toast";
import { cn } from "../lib/utils";
import {
  Briefcase,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  section: string;
  description: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    section: "Geral",
    description: "Visao consolidada de caixa e performance",
    roles: ["owner", "finance"],
  },
  {
    label: "Finance AP",
    to: "/finance/ap",
    icon: <Wallet className="h-4 w-4" />,
    section: "Financeiro",
    description: "Contas a pagar, aprovacoes e pagamentos",
    roles: ["owner", "finance"],
  },
  {
    label: "Finance AR",
    to: "/finance/ar",
    icon: <Receipt className="h-4 w-4" />,
    section: "Financeiro",
    description: "Contas a receber e cobranca",
    roles: ["owner", "finance"],
  },
  {
    label: "RH",
    to: "/hr",
    icon: <Briefcase className="h-4 w-4" />,
    section: "Pessoas",
    description: "Estrutura, colaboradores e beneficios",
    roles: ["owner", "hr"],
  },
  {
    label: "Members",
    to: "/members",
    icon: <Users className="h-4 w-4" />,
    section: "Admin",
    description: "Governanca de acesso por tenant",
    roles: ["owner"],
  },
];

function pathMatches(pathname: string, to: string) {
  if (to === "/dashboard") return pathname === "/dashboard";
  return pathname === to || pathname.startsWith(`${to}/`);
}

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

  const groupedNav = useMemo(() => {
    return filteredNav.reduce<Record<string, NavItem[]>>((acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    }, {});
  }, [filteredNav]);

  const activeItem = useMemo(() => {
    return filteredNav.find((item) => pathMatches(location.pathname, item.to)) || null;
  }, [filteredNav, location.pathname]);

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
      <div className="grid min-h-screen lg:grid-cols-[290px_1fr]">
        <aside className="hidden border-r border-border/70 bg-gradient-to-b from-card/80 to-background/90 lg:flex lg:flex-col">
          <div className="border-b border-border/70 p-5">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">SaaS Control</div>
              <div className="text-xl font-bold text-primary">Finance + HR</div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                {me ? `Tenant ${me.tenantId} · ${me.role}` : "Sessao anonima"}
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-4">
            {Object.entries(groupedNav).map(([section, items]) => (
              <div key={section} className="space-y-2">
                <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {section}
                </div>
                <nav className="space-y-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "block rounded-lg border border-transparent px-3 py-2 transition",
                          isActive || pathMatches(location.pathname, item.to)
                            ? "border-primary/30 bg-primary/10"
                            : "hover:border-border/70 hover:bg-muted/30",
                        )
                      }
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {item.icon}
                        {item.label}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{item.description}</div>
                    </NavLink>
                  ))}
                </nav>
              </div>
            ))}
          </div>

          <div className="border-t border-border/70 p-4">
            <Card className="space-y-3 border-border/70 bg-background/60 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Conexao</div>
              <div className="truncate text-xs text-foreground">{baseUrl}</div>
              <Button size="sm" variant="outline" onClick={handleHealth} disabled={checking} className="w-full">
                {checking ? "Checando..." : "Verificar API"}
              </Button>
            </Card>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
            <div className="px-4 py-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    {activeItem?.section || "Painel"}
                  </div>
                  <div className="text-lg font-bold text-foreground">{activeItem?.label || "SaaS Control Panel"}</div>
                  <div className="text-xs text-muted-foreground">
                    {activeItem?.description || "Navegacao principal do tenant"}
                  </div>
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
                  {me && <Badge variant="outline">Tenant {me.tenantId}</Badge>}
                  {token ? <Badge variant="success">Token ativo</Badge> : <Badge variant="warning">Sem token</Badge>}
                  {me && <Badge variant="ghost">Role {me.role}</Badge>}
                  {me ? (
                    <Button size="sm" variant="ghost" onClick={logout}>
                      Sair
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => navigate("/login")}>
                      Entrar
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {filteredNav.map((item) => {
                  const active = pathMatches(location.pathname, item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition",
                        active
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/70 text-muted-foreground hover:bg-muted/30",
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="container py-6">
            {token ? null : (
              <Card className="mb-5 border-dashed border-primary/40 bg-primary/5 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>Use Login ou Registro para obter token e acesso completo.</div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => navigate("/login")} variant="default">
                      Ir para Login
                    </Button>
                    <Button size="sm" onClick={() => navigate("/register")} variant="outline">
                      Registrar
                    </Button>
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
