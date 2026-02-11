import { useEffect, useState } from "react";
import { useApi } from "../lib/api-provider";
import { FinanceSummary, CostCenter } from "../lib/api";
import { useToast } from "../components/toast";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { formatCents } from "../lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "../components/page-header";

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
    } finally { setLoading(false); }
  };

  const loadCC = async () => {
    try { const res = await request<CostCenter[]>("/cost-centers"); setCostCenters(res); } catch (_) {}
  };

  useEffect(() => { load(); }, [cc]);
  useEffect(() => { loadCC(); }, []);

  const Stat = ({ label, value, count, accent }: { label: string; value: number; count?: number; accent?: string; }) => (
    <Card className="space-y-2 border-border/70 bg-card/70">
      <CardHeader className="mb-1 space-y-1">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <CardDescription className="text-2xl font-semibold text-foreground">{formatCents(value)}</CardDescription>
      </CardHeader>
      {typeof count === "number" && <Badge variant="ghost">{count} itens</Badge>}
      {accent && <div className="text-xs text-muted-foreground">{accent}</div>}
    </Card>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard Financeiro"
        subtitle="Resumo de payables, recebíveis e centros de custo."
        actions={
          <>
            <Select value={cc} onChange={(e) => setCc(e.target.value)} className="w-56">
              <option value="">Todos os centros</option>
              <option value="0">Sem centro de custo</option>
              {costCenters.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>{loading ? "Atualizando" : "Atualizar"}</Button>
          </>
        }
      />

      {data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="col-span-2 bg-gradient-to-br from-primary/15 via-card to-card">
            <CardHeader className="mb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                Resultado liquido
                {data.net_paid_cents >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-rose-400" />}
              </CardTitle>
              <CardDescription>Recebido - Pago</CardDescription>
            </CardHeader>
            <div className="text-4xl font-semibold">{formatCents(data.net_paid_cents)}</div>
            <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <div>Pagamentos abertos: {formatCents(data.open_payables_cents)}</div>
              <div>Recebiveis abertos: {formatCents(data.open_receivables_cents)}</div>
              <div>Atualizado: {new Date(data.now_utc).toLocaleString()}</div>
            </div>
          </Card>
          <Card className="bg-card/70">
            <CardHeader className="mb-2">
              <CardTitle>Atalhos</CardTitle>
              <CardDescription>Status mais urgentes</CardDescription>
            </CardHeader>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Payables pendentes: {data.payables.pending_approval_count}</li>
              <li>Payables em atraso: {data.payables.overdue_open_count}</li>
              <li>Receiviveis em atraso: {data.receivables.overdue_open_count}</li>
            </ul>
          </Card>
        </div>
      ) : (
        <Card className="p-6 text-muted-foreground">Nenhum dado ainda.</Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data && (
          <>
            <Stat label="Payables draft" value={data.payables.draft} count={data.payables.draft_count} />
            <Stat label="Payables aprov." value={data.payables.approved} count={data.payables.approved_count} />
            <Stat label="Payables pagos" value={data.payables.paid} count={data.payables.paid_count} />
            <Stat label="Payables pendentes" value={data.payables.pending_approval} count={data.payables.pending_approval_count} />
            <Stat label="Recebiveis draft" value={data.receivables.draft} count={data.receivables.draft_count} />
            <Stat label="Recebiveis emitidos" value={data.receivables.issued} count={data.receivables.issued_count} />
            <Stat label="Recebiveis pagos" value={data.receivables.paid} count={data.receivables.paid_count} />
            <Stat label="Recebiveis em atraso" value={data.receivables.overdue_open} count={data.receivables.overdue_open_count} />
          </>
        )}
      </div>
    </div>
  );
}



