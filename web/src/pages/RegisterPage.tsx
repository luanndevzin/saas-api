import { FormEvent, useState } from "react";
import { useApi } from "../lib/api-provider";
import { useToast } from "../components/toast";
import { Button } from "../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { UserRole } from "../lib/api";
import { Sparkles, ShieldCheck, Check, Headphones } from "lucide-react";

const routeByRole = (role?: UserRole) => {
  switch (role) {
    case "hr":
      return "/hr";
    case "finance":
      return "/finance/ap";
    case "colaborador":
    case "member":
      return "/dashboard";
    case "owner":
    default:
      return "/dashboard";
  }
};

export function RegisterPage() {
  const { register } = useApi();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submitRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await register({
        company_name: String(fd.get("company_name")),
        name: String(fd.get("name")),
        email: String(fd.get("email")),
        password: String(fd.get("password")),
      });
      toast({ title: "Conta criada", variant: "success" });
      navigate(routeByRole(res.role), { replace: true });
    } catch (err: any) {
      toast({ title: "Erro no registro", description: err.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[460px_1fr] items-start">
      <Card className="card-glass border-primary/20">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-2xl">Criar conta da empresa</CardTitle>
          <CardDescription>Owner inicial com acesso total.</CardDescription>
        </CardHeader>
        <form className="space-y-3 p-4 pt-0" onSubmit={submitRegister}>
          <div className="space-y-1">
            <Label htmlFor="company_name">Empresa</Label>
            <Input id="company_name" name="company_name" required placeholder="Nome da empresa" autoComplete="organization" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Seu nome</Label>
            <Input id="name" name="name" required placeholder="Seu nome" autoComplete="name" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email_reg">Email</Label>
            <Input id="email_reg" name="email" type="email" required placeholder="voce@empresa.com" autoComplete="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password_reg">Senha (mín. 8)</Label>
            <Input id="password_reg" name="password" type="password" minLength={8} required placeholder="••••••••" autoComplete="new-password" />
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <input id="terms" name="terms" type="checkbox" required className="mt-1" />
            <label htmlFor="terms">Concordo em receber comunicações sobre a conta e aceito os termos de uso.</label>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Registrando..." : "Registrar e entrar"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Já tem conta? <Link to="/login" className="font-semibold text-primary">Ir para login</Link>
          </p>
        </form>
      </Card>

      <div className="space-y-4">
        <Card className="bg-card/70 border-border/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Benefícios imediatos</div>
          <div className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
            {["Dashboard financeiro", "Aprovação em dois níveis", "Multi-tenant e roles", "Auditoria de eventos"].map((item) => (
              <span key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {item}</span>
            ))}
          </div>
        </Card>
        <Card className="bg-muted/10 border-border/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Segurança</div>
          <p className="text-sm text-muted-foreground">Tokens e membros ficam sob controle do owner. Roles mínimas protegem cada módulo.</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Headphones className="h-4 w-4 text-primary" /> Suporte humano em horário comercial.</div>
        </Card>
      </div>
    </div>
  );
}
