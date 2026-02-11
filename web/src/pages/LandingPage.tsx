import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles, Shield, Zap, Plug, Cpu } from "lucide-react";

const highlights = [
  { title: "Receitas & Despesas", desc: "AP/AR com centros de custo e approvals." },
  { title: "Pessoas", desc: "Departamentos, cargos e colaboradores." },
  { title: "Governança", desc: "Tenant isolado, roles e auditoria completa." },
];

const steps = [
  { title: "Crie sua conta", desc: "Cadastre a empresa e receba acesso imediato ao painel." },
  { title: "Convide o time", desc: "Defina roles para finanças, RH e governança." },
  { title: "Rode o negócio", desc: "Payables, receivables e pessoas num só lugar." },
];

const faqs = [
  { q: "Posso começar grátis?", a: "Sim. Cadastre a empresa, ganhe um período trial e depois escolha um plano." },
  { q: "Há limites de usuários?", a: "No plano Essencial até 20 usuários. Business e Enterprise são ilimitados." },
  { q: "Integra com SSO?", a: "SSO/SAML e SCIM estão no plano Enterprise." },
  { q: "Meu cliente final vê configurações?", a: "Não. Entregamos uma experiência pronta, sem telas técnicas expostas." },
];

const plans = [
  {
    name: "Essencial",
    price: "R$ 299/mês",
    perks: ["Até 20 usuários", "AP/AR + RH", "Suporte comercial"],
    href: "/register",
  },
  {
    name: "Business",
    price: "R$ 699/mês",
    perks: ["Usuários ilimitados", "Aprovação em 2 níveis", "Suporte prioritário"],
    href: "/register",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Fale com vendas",
    perks: ["SSO/SAML", "SLA 99,9%", "Onboarding assistido"],
    href: "mailto:vendas@saas.com",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/90 to-background text-foreground">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(124,231,255,0.12),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.14),transparent_30%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 space-y-14">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary font-bold">S</div>
              <div className="leading-tight">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">SaaS Console</p>
                <p className="text-base font-semibold">Finance + HR</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm"><Link to="/login">Entrar</Link></Button>
              <Button asChild size="sm"><Link to="/register">Começar grátis</Link></Button>
            </div>
          </header>

          <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center">
            <div className="space-y-6">
              <Badge variant="outline" className="text-xs">Linkify-style • Produto pronto para clientes</Badge>
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Conecte finanças e pessoas em um painel elegante.</h1>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Inspiração Linkify: copy clara, CTA direto, seções enxutas. Entregue payables, receivables, centros de custo, colaboradores e auditoria sem expor setup técnico.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg"><Link to="/register">Experimentar</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/login">Já sou cliente</Link></Button>
                <Button asChild size="lg" variant="ghost"><Link to="mailto:vendas@saas.com" className="flex items-center gap-2">Falar com vendas <ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1"><Shield className="h-4 w-4 text-primary" /> Segurança e roles</span>
                <span className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1"><Sparkles className="h-4 w-4 text-primary" /> UX enxuta</span>
                <span className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1"><Zap className="h-4 w-4 text-primary" /> Pronto em minutos</span>
              </div>
            </div>

            <Card className="card-glass border-primary/30 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Visão executiva</p>
                <Badge variant="ghost">Seguro</Badge>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground space-y-3">
                <div className="flex items-center justify-between"><span>Payables aprovados</span><span className="text-emerald-300">R$ 420k</span></div>
                <div className="flex items-center justify-between"><span>Recebíveis emitidos</span><span className="text-sky-300">R$ 610k</span></div>
                <div className="flex items-center justify-between"><span>Colaboradores ativos</span><span className="text-amber-200">142</span></div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> White-label e pronto: nada de setup exposto ao cliente final.
              </div>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {highlights.map((h) => (
              <Card key={h.title} className="bg-card/70 p-4 space-y-2 border-border/60">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="rounded-md bg-primary/15 p-2 text-primary"><Check className="h-4 w-4" /></span>
                  {h.title}
                </div>
                <p className="text-sm text-muted-foreground">{h.desc}</p>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 rounded-2xl border border-border/60 bg-card/60 p-6 md:grid-cols-[1.2fr_1fr] items-center">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Como funciona</p>
              <h3 className="text-2xl font-semibold">Comece em minutos</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                {steps.map((s) => <li key={s.title}><span className="font-semibold text-foreground">{s.title}.</span> {s.desc}</li>)}
              </ol>
            </div>
            <Card className="bg-muted/10 border-border/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Shield className="h-4 w-4 text-primary" /> Segurança de ponta a ponta</div>
              <p className="text-sm text-muted-foreground">Isolamento por tenant, roles e auditoria. SSO e SLA disponíveis para Enterprise.</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">SSO opcional</Badge>
                <Badge variant="outline">SLA sob contrato</Badge>
              </div>
            </Card>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/60 p-6 space-y-6">
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Planos</p>
              <h3 className="text-2xl font-semibold">Escolha o plano certo</h3>
              <p className="text-sm text-muted-foreground">Todos incluem dashboard, approvals e auditoria.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {plans.map((p) => (
                <Card key={p.name} className={`p-4 border-border/70 ${p.highlight ? "border-primary/70 bg-primary/5" : "bg-muted/10"}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{p.name}</div>
                    <Badge variant={p.highlight ? "default" : "outline"}>{p.price}</Badge>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground list-disc list-inside">
                    {p.perks.map((perk) => <li key={perk}>{perk}</li>)}
                  </ul>
                  <Button asChild size="sm" className="mt-4 w-full" variant={p.highlight ? "default" : "outline"}>
                    <Link to={p.href}>{p.cta}</Link>
                  </Button>
                </Card>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/60 p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Plug className="h-4 w-4 text-primary" /> FAQ</div>
            <div className="grid gap-3 md:grid-cols-2">
              {faqs.map((f) => (
                <Card key={f.q} className="p-3 bg-muted/10 border-border/60">
                  <p className="font-semibold text-sm text-foreground">{f.q}</p>
                  <p className="text-sm text-muted-foreground">{f.a}</p>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

