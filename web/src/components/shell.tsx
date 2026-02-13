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
  ChevronDown,
  CircleDot,
  Clock3,
  LayoutDashboard,
  PenSquare,
  Plus,
  Receipt,
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
    label: "Meu Ponto",
    to: "/ponto",
    icon: <Clock3 className="h-4 w-4" />,
    section: "Pessoas",
    description: "Bater entrada e saida e ver historico",
    roles: ["colaborador", "member"],
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

function roleLabel(role?: string) {
  switch (role) {
    case "owner":
      return "Owner";
    case "hr":
      return "RH";
    case "finance":
      return "Financeiro";
    case "colaborador":
    case "member":
      return "Colaborador";
    default:
      return "Visitante";
  }
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
    <div className="min-h-screen bg-background/90">
      <div className="grid min-h-screen lg:grid-cols-[330px_1fr]">
        <aside className="hidden px-5 py-6 lg:flex">
          <Card className="sidebar-shell flex h-full w-full max-w-[300px] flex-col overflow-hidden rounded-[28px] border-border/70 bg-card/95 p-0">
            <div className="border-b border-border/70 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/30 text-sm font-bold text-primary-foreground">
                  {me ? `T${me.tenantId}` : "SC"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    {me ? `Tenant ${me.tenantId}` : "SaaS Control"}
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CircleDot className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
                    {roleLabel(me?.role)}
                  </div>
                </div>
                <Button size="icon" variant="outline" className="h-9 w-9 rounded-full border-border/80">
                  <PenSquare className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {Object.entries(groupedNav).map(([section, items]) => (
                <div key={section} className="border-b border-border/60 pb-2 pt-2 last:border-b-0">
                  <div className="mb-1 flex items-center justify-between px-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {section}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Plus className="h-3.5 w-3.5" />
                      <ChevronDown className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  <nav className="space-y-0.5">
                    {items.map((item) => {
                      const active = pathMatches(location.pathname, item.to);
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={cn(
                            "block rounded-lg px-2.5 py-2 transition",
                            active
                              ? "bg-primary/18 text-foreground"
                              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                            <span className="flex items-center gap-2.5">
                              {item.icon}
                              {item.label}
                            </span>
                            {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                          </div>
                          {active && <div className="mt-1 pl-6 text-[11px] text-muted-foreground">{item.description}</div>}
                        </NavLink>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            <div className="border-t border-border/70 p-3">
              <Card className="space-y-3 border-border/70 bg-background/60 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Conexao</div>
                <div className="truncate text-xs text-foreground">{baseUrl}</div>
                <Button size="sm" variant="outline" onClick={handleHealth} disabled={checking} className="w-full">
                  {checking ? "Checando..." : "Verificar API"}
                </Button>
              </Card>
            </div>
          </Card>
        </aside>

        <div className="flex min-h-screen flex-col px-2 pb-4 pt-3 lg:px-6 lg:pt-6">
          <header className="sticky top-0 z-20 rounded-2xl border border-border/60 bg-card/80 backdrop-blur">
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
                  {me && <Badge variant="ghost">{roleLabel(me.role)}</Badge>}
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
                          ? "border-primary/40 bg-primary/20 text-foreground"
                          : "border-border/70 text-muted-foreground hover:bg-muted/70",
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
