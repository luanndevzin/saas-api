import { ReactNode, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleDollarSign, RefreshCw } from "lucide-react";
import { useApi } from "../lib/api-provider";
import { CostCenter, FinanceSummary } from "../lib/api";
import { useToast } from "../components/toast";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { formatCents } from "../lib/utils";
import { PageHeader } from "../components/page-header";
import { cn } from "../lib/utils";

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function ratioPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function StatusBar({
  label,
  value,
  count,
  total,
  tone,
}: {
  label: string;
  value: number;
  count: number;
  total: number;
  tone: "blue" | "emerald" | "amber" | "rose" | "slate";
}) {
  const width = pct(value, total);
  const toneClass =
    tone === "blue"
      ? "bg-sky-400/80"
      : tone === "emerald"
        ? "bg-emerald-400/80"
        : tone === "amber"
          ? "bg-amber-400/80"
          : tone === "rose"
            ? "bg-rose-400/80"
            : "bg-slate-400/80";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="font-semibold text-foreground">{label}</div>
        <div className="text-muted-foreground">
          {formatCents(value)} · {count} itens
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/70">
        <div className={cn("h-full rounded-full transition-all", toneClass)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function KPI({
  title,
  value,
  note,
  icon,
  variant = "default",
}: {
  title: string;
  value: string;
  note: string;
  icon: ReactNode;
  variant?: "default" | "good" | "warning";
}) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-card/70",
        variant === "good" && "border-emerald-400/30 bg-emerald-500/5",
        variant === "warning" && "border-amber-400/30 bg-amber-500/5",
      )}
    >
      <CardHeader className="mb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="flex items-center justify-between text-2xl">
          {value}
          <span className="text-muted-foreground">{icon}</span>
        </CardTitle>
      </CardHeader>
      <div className="text-xs text-muted-foreground">{note}</div>
    </Card>
  );
}

export function DashboardPage() {
  const { request } = useApi();
  const { toast } = useToast();
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [cc, setCc] = useState<string>("");
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const ccParam = cc ? `?cost_center_id=${cc}` : "";
      const res = await request<FinanceSummary>(`/dashboard/finance/summary${ccParam}`);
      setData(res);
    } catch (err: any) {
      toast({ title: "Erro ao carregar dashboard", description: err.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadCC = async () => {
    try {
      const res = await request<CostCenter[]>("/cost-centers");
      setCostCenters(res);
    } catch (_) {}
  };

  useEffect(() => {
    load();
  }, [cc]);

  useEffect(() => {
    loadCC();
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;

    const payableOpen =
      data.payables.draft +
      data.payables.pending_approval +
      data.payables.approved +
      data.payables.overdue_open;
    const receivableOpen =
      data.receivables.draft +
      data.receivables.issued +
      data.receivables.overdue_open;

    const payableTotalTracked = payableOpen + data.payables.paid;
    const receivableTotalTracked = receivableOpen + data.receivables.paid;

    const paymentExecution = ratioPercent(data.payables.paid, payableTotalTracked);
    const collectionExecution = ratioPercent(data.receivables.paid, receivableTotalTracked);
    const overdueRisk = data.payables.overdue_open + data.receivables.overdue_open;
    const netExposure = receivableOpen - payableOpen;
    const alertCount =
      (data.payables.pending_approval_count > 0 ? 1 : 0) +
      (data.payables.overdue_open_count > 0 ? 1 : 0) +
      (data.receivables.overdue_open_count > 0 ? 1 : 0);

    return {
      payableOpen,
      receivableOpen,
      paymentExecution,
      collectionExecution,
      overdueRisk,
      netExposure,
      alertCount,
    };
  }, [data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard Financeiro"
        subtitle="Leitura operacional de caixa, backlog e risco por centro de custo."
        actions={
          <>
            <Select value={cc} onChange={(e) => setCc(e.target.value)} className="w-56">
              <option value="">Todos os centros</option>
              <option value="0">Sem centro de custo</option>
              {costCenters.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("mr-1 h-4 w-4", loading && "animate-spin")} />
              {loading ? "Atualizando" : "Atualizar"}
            </Button>
          </>
        }
      />

      {!data || !derived ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhum dado carregado. Verifique o tenant e as permissoes do usuario.
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-4">
            <Card className="xl:col-span-2 bg-gradient-to-br from-primary/20 via-card to-card">
              <CardHeader className="mb-2">
                <div>
                  <CardDescription>Resultado liquido realizado</CardDescription>
                  <CardTitle className="mt-1 flex items-center gap-2 text-4xl">
                    {formatCents(data.net_paid_cents)}
                    {data.net_paid_cents >= 0 ? (
                      <ArrowUpRight className="h-6 w-6 text-emerald-300" />
                    ) : (
                      <ArrowDownRight className="h-6 w-6 text-rose-300" />
                    )}
                  </CardTitle>
                </div>
                <Badge variant={data.net_paid_cents >= 0 ? "success" : "warning"}>
                  Atualizado {new Date(data.now_utc).toLocaleString()}
                </Badge>
              </CardHeader>
              <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                <div>Pagamentos em aberto: {formatCents(derived.payableOpen)}</div>
                <div>Recebiveis em aberto: {formatCents(derived.receivableOpen)}</div>
                <div>Exposicao de caixa: {formatCents(derived.netExposure)}</div>
                <div>Risco em atraso: {formatCents(derived.overdueRisk)}</div>
              </div>
            </Card>

            <KPI
              title="Execucao de pagamentos"
              value={`${derived.paymentExecution}%`}
              note={`${data.payables.paid_count} titulos liquidados`}
              icon={<CircleDollarSign className="h-5 w-5" />}
              variant={derived.paymentExecution >= 65 ? "good" : "warning"}
            />
            <KPI
              title="Execucao de cobranca"
              value={`${derived.collectionExecution}%`}
              note={`${data.receivables.paid_count} titulos recebidos`}
              icon={<CircleDollarSign className="h-5 w-5" />}
              variant={derived.collectionExecution >= 65 ? "good" : "warning"}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2 space-y-4">
              <CardHeader className="mb-0">
                <div>
                  <CardTitle>Pipeline de contas a pagar</CardTitle>
                  <CardDescription>Distribuicao por status para priorizacao diaria</CardDescription>
                </div>
              </CardHeader>
              <StatusBar
                label="Draft"
                value={data.payables.draft}
                count={data.payables.draft_count}
                total={derived.payableOpen}
                tone="slate"
              />
              <StatusBar
                label="Pending approval"
                value={data.payables.pending_approval}
                count={data.payables.pending_approval_count}
                total={derived.payableOpen}
                tone="amber"
              />
              <StatusBar
                label="Approved"
                value={data.payables.approved}
                count={data.payables.approved_count}
                total={derived.payableOpen}
                tone="blue"
              />
              <StatusBar
                label="Overdue"
                value={data.payables.overdue_open}
                count={data.payables.overdue_open_count}
                total={derived.payableOpen}
                tone="rose"
              />
            </Card>

            <Card className="space-y-4">
              <CardHeader className="mb-0">
                <div>
                  <CardTitle>Alertas de operacao</CardTitle>
                  <CardDescription>Itens que exigem acao imediata</CardDescription>
                </div>
                <Badge variant={derived.alertCount > 0 ? "warning" : "success"}>
                  {derived.alertCount} alerta{derived.alertCount === 1 ? "" : "s"}
                </Badge>
              </CardHeader>
              <div className="space-y-2 text-sm">
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-300" />
                    Pendencias de aprovacao
                  </div>
                  <div className="text-muted-foreground">
                    {data.payables.pending_approval_count} titulos aguardando aprovacao
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-rose-300" />
                    Inadimplencia e atraso
                  </div>
                  <div className="text-muted-foreground">
                    Payables em atraso: {data.payables.overdue_open_count} · Recebiveis em atraso: {data.receivables.overdue_open_count}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="font-semibold">Leitura de caixa</div>
                  <div className="text-muted-foreground">
                    {derived.netExposure >= 0
                      ? "Backlog favorece entrada de caixa no curto prazo."
                      : "Backlog favorece saida de caixa no curto prazo."}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card className="space-y-4">
            <CardHeader className="mb-0">
              <div>
                <CardTitle>Pipeline de contas a receber</CardTitle>
                <CardDescription>Qualidade da cobranca e concentracao de risco</CardDescription>
              </div>
            </CardHeader>
            <div className="grid gap-4 lg:grid-cols-2">
              <StatusBar
                label="Draft"
                value={data.receivables.draft}
                count={data.receivables.draft_count}
                total={derived.receivableOpen}
                tone="slate"
              />
              <StatusBar
                label="Issued"
                value={data.receivables.issued}
                count={data.receivables.issued_count}
                total={derived.receivableOpen}
                tone="blue"
              />
              <StatusBar
                label="Overdue"
                value={data.receivables.overdue_open}
                count={data.receivables.overdue_open_count}
                total={derived.receivableOpen}
                tone="rose"
              />
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                <div className="font-semibold text-foreground">Recebimento realizado</div>
                <div className="mt-1 text-muted-foreground">
                  {formatCents(data.receivables.paid)} em {data.receivables.paid_count} titulos pagos.
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
