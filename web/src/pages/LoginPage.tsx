import { FormEvent, useState } from "react";
import { useApi } from "../lib/api-provider";
import { useToast } from "../components/toast";
import { Button } from "../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { UserRole } from "../lib/api";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";

const routeByRole = (role?: UserRole) => {
  switch (role) {
    case "hr":
      return "/hr";
    case "finance":
      return "/finance/ap";
    case "member":
      return "/dashboard";
    case "owner":
    default:
      return "/dashboard";
  }
};

export function LoginPage() {
  const { login, me } = useApi();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const submitLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await login(String(fd.get("email")), String(fd.get("password")));
      toast({ title: "Login ok", variant: "success" });
      const redirect = (location.state as any)?.from?.pathname || routeByRole(res.role);
      navigate(redirect, { replace: true });
    } catch (err: any) {
      toast({ title: "Erro no login", description: err.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr] items-start">
      <Card className="card-glass border-primary/20">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-2xl">Acesse sua conta</CardTitle>
          <CardDescription>Somente clientes ativos.</CardDescription>
        </CardHeader>
        <form className="space-y-3 p-4 pt-0" onSubmit={submitLogin}>
          <div className="space-y-1">
            <Label htmlFor="email">Email corporativo</Label>
            <Input id="email" name="email" type="email" required placeholder="voce@empresa.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required placeholder="••••••••" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Novo cliente? <Link to="/register" className="font-semibold text-primary">Começar agora</Link>
          </p>
        </form>
      </Card>

      <div className="space-y-4">
        <Card className="bg-card/70 border-border/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Token & role</div>
          {me ? (
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <div>Tenant: <Badge variant="outline">{me.tenantId}</Badge></div>
              <div>User: <Badge variant="outline">{me.userId}</Badge></div>
              <div>Role: <Badge variant="ghost">{me.role}</Badge></div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Faça login para ver o token JWT ativo.</p>
          )}
        </Card>
        <Card className="bg-muted/10 border-border/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> Dicas</div>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Roles direcionam você ao módulo correto após login.</li>
            <li>Credenciais são exclusivas por empresa.</li>
          </ul>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Zap className="h-4 w-4 text-primary" /> Tokens são rotacionáveis a qualquer momento pelo owner.
          </div>
        </Card>
      </div>
    </div>
  );
}
