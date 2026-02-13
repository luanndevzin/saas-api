import { FormEvent, useEffect, useMemo, useState } from "react";
import { useApi } from "../lib/api-provider";
import { Payable, Vendor, CostCenter } from "../lib/api";
import { useToast } from "../components/toast";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { Table, TBody, THead, TH, TR, TD } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { formatCents, formatDate } from "../lib/utils";
import { PageHeader } from "../components/page-header";

type Tab = "payables" | "vendors" | "cc";

const statusColors: Record<string, "default" | "success" | "warning" | "outline"> = {
  draft: "outline",
  pending_approval: "warning",
  approved: "success",
  paid: "success",
  rejected: "outline",
  canceled: "outline",
};

export function FinanceAPPage() {
  const { request } = useApi();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tab, setTab] = useState<Tab>("payables");

  const vendorMap = useMemo(() => Object.fromEntries(vendors.map((v) => [v.id, v.name])), [vendors]);
  const apMetrics = useMemo(() => {
    const total = payables.reduce((acc, item) => acc + (item.amount_cents || 0), 0);
    const pending = payables
      .filter((item) => item.status === "pending_approval")
      .reduce((acc, item) => acc + (item.amount_cents || 0), 0);
    const approved = payables
      .filter((item) => item.status === "approved")
      .reduce((acc, item) => acc + (item.amount_cents || 0), 0);
    const paid = payables
      .filter((item) => item.status === "paid")
      .reduce((acc, item) => acc + (item.amount_cents || 0), 0);
    return { total, pending, approved, paid, count: payables.length };
  }, [payables]);

  const loadAll = async () => {
    try {
      const [v, p, cc] = await Promise.all([
        request<Vendor[]>("/vendors"),
        request<Payable[]>(`/payables${statusFilter ? `?status=${statusFilter}` : ""}`),
        request<CostCenter[]>("/cost-centers"),
      ]);
      setVendors(v); setPayables(p); setCostCenters(cc);
    } catch (err: any) {
      toast({ title: "Erro ao carregar AP", description: err.message, variant: "error" });
    }
  };

  useEffect(() => { loadAll(); }, [statusFilter]);

  const createVendor = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/vendors", {
        method: "POST",
        body: {
          name: fd.get("name"),
          document: fd.get("document") || null,
          email: fd.get("email") || null,
          phone: fd.get("phone") || null,
        },
      });
      toast({ title: "Vendor criado", variant: "success" });
      e.currentTarget.reset();
      loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const createPayable = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/payables", {
        method: "POST",
        body: {
          vendor_id: Number(fd.get("vendor_id")),
          amount_cents: Number(fd.get("amount_cents")),
          due_date: fd.get("due_date"),
          currency: fd.get("currency") || null,
          reference: fd.get("reference") || null,
          description: fd.get("description") || null,
        },
      });
      toast({ title: "Payable criado", variant: "success" });
      e.currentTarget.reset();
      loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const createCostCenter = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/cost-centers", { method: "POST", body: { name: fd.get("name"), code: fd.get("code") || null } });
      toast({ title: "Centro de custo criado", variant: "success" });
      e.currentTarget.reset();
      loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const updateCostCenter = async (payable: Payable, ccId: string) => {
    try {
      await request(`/payables/${payable.id}`, { method: "PATCH", body: { cost_center_id: ccId ? Number(ccId) : null } });
      toast({ title: "Centro de custo salvo", variant: "success" });
      loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const doAction = async (id: number, action: string) => {
    try {
      await request(`/payables/${id}/${action}`, { method: "POST" });
      toast({ title: `Acao ${action} ok`, variant: "success" });
      loadAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financeiro - AP"
        subtitle="Gerencie fornecedores e titulos com fluxo de aprovacao."
        actions={
          <div className="flex gap-2">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-52">
              <option value="">Status: todos</option>
              <option value="draft">draft</option>
              <option value="pending_approval">pending_approval</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="paid">paid</option>
              <option value="canceled">canceled</option>
            </Select>
            <Button variant="outline" size="sm" onClick={loadAll}>Atualizar</Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          { id: "payables", label: "Payables" },
          { id: "vendors", label: "Fornecedores" },
          { id: "cc", label: "Centros de custo" },
        ].map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "outline"} onClick={() => setTab(t.id as Tab)}>
            {t.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="mb-0">
            <div>
              <CardDescription>Total em carteira</CardDescription>
              <CardTitle className="mt-1 text-2xl">{formatCents(apMetrics.total)}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="mb-0">
            <div>
              <CardDescription>Pendente de aprovacao</CardDescription>
              <CardTitle className="mt-1 text-2xl">{formatCents(apMetrics.pending)}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="mb-0">
            <div>
              <CardDescription>Aprovado para pagar</CardDescription>
              <CardTitle className="mt-1 text-2xl">{formatCents(apMetrics.approved)}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="mb-0">
            <div>
              <CardDescription>Qtd. de titulos</CardDescription>
              <CardTitle className="mt-1 text-2xl">{apMetrics.count}</CardTitle>
            </div>
            <Badge variant={apMetrics.paid > 0 ? "success" : "outline"}>
              Pago: {formatCents(apMetrics.paid)}
            </Badge>
          </CardHeader>
        </Card>
      </div>

      {tab === "payables" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="mb-3">
              <CardTitle>Novo payable</CardTitle>
              <CardDescription>POST /payables</CardDescription>
            </CardHeader>
            <form className="grid grid-cols-2 gap-3" onSubmit={createPayable}>
              <div>
                <Label>Vendor</Label>
                <Select name="vendor_id" required defaultValue="">
                  <option value="" disabled>Selecione</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>Valor (centavos)</Label>
                <Input name="amount_cents" type="number" min={1} required />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input name="due_date" type="date" required />
              </div>
              <div>
                <Label>Moeda</Label>
                <Input name="currency" placeholder="BRL" />
              </div>
              <div className="col-span-2">
                <Label>Referencia</Label>
                <Input name="reference" />
              </div>
              <div className="col-span-2">
                <Label>Descricao</Label>
                <Input name="description" />
              </div>
              <div className="col-span-2">
                <Button type="submit">Criar payable</Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader className="mb-3">
              <CardTitle>Payables</CardTitle>
              <CardDescription>Lista com acoes rapidas</CardDescription>
            </CardHeader>
            <Table>
              <THead>
                <TR><TH>ID</TH><TH>Vendor</TH><TH>Valor</TH><TH>Venc.</TH><TH>Status</TH><TH>CC</TH><TH>Acoes</TH></TR>
              </THead>
              <TBody>
                {payables.map((p) => (
                  <TR key={p.id}>
                    <TD className="text-xs text-muted-foreground">{p.id}</TD>
                    <TD>
                      <div className="font-semibold">{vendorMap[p.vendor_id] || p.vendor_id}</div>
                      {p.reference && <div className="text-xs text-muted-foreground">{p.reference}</div>}
                    </TD>
                    <TD>{formatCents(p.amount_cents, p.currency)}</TD>
                    <TD>{formatDate(p.due_date)}</TD>
                    <TD><Badge variant={statusColors[p.status] || "outline"}>{p.status}</Badge></TD>
                    <TD>
                      {p.status === "draft" ? (
                        <Select defaultValue={p.cost_center_id ? String(p.cost_center_id) : ""} onChange={(e) => updateCostCenter(p, e.target.value)}>
                          <option value="">(nenhum)</option>
                          {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                      ) : (
                        p.cost_center_id || "-"
                      )}
                    </TD>
                    <TD className="space-x-2 whitespace-nowrap">
                      {p.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => doAction(p.id, "submit")}>Submeter</Button>
                      )}
                      {p.status === "pending_approval" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => doAction(p.id, "approve")}>Aprovar</Button>
                          <Button size="sm" variant="destructive" onClick={() => doAction(p.id, "reject")}>Rejeitar</Button>
                        </>
                      )}
                      {p.status === "approved" && (
                        <Button size="sm" variant="default" onClick={() => doAction(p.id, "mark-paid")}>Marcar pago</Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>
      )}

      {tab === "vendors" && (
        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Fornecedores</CardTitle>
            <CardDescription>Criar e listar</CardDescription>
          </CardHeader>
          <div className="grid gap-4 lg:grid-cols-2">
            <form className="space-y-2" onSubmit={createVendor}>
              <Label>Nome</Label>
              <Input name="name" required />
              <Label>Documento</Label>
              <Input name="document" />
              <Label>Email</Label>
              <Input name="email" type="email" />
              <Label>Telefone</Label>
              <Input name="phone" />
              <Button type="submit" className="w-full">Salvar</Button>
            </form>

            <div className="max-h-[520px] overflow-auto pr-1">
              <Table>
                <THead><TR><TH>Nome</TH><TH>Contato</TH></TR></THead>
                <TBody>
                  {vendors.map((v) => (
                    <TR key={v.id}>
                      <TD>
                        <div className="font-semibold">{v.name}</div>
                        {v.document && <div className="text-xs text-muted-foreground">{v.document}</div>}
                      </TD>
                      <TD className="text-xs text-muted-foreground space-y-1">
                        {v.email && <div>{v.email}</div>}
                        {v.phone && <div>{v.phone}</div>}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </div>
        </Card>
      )}

      {tab === "cc" && (
        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Centros de custo</CardTitle>
            <CardDescription>Organize payables por CC</CardDescription>
          </CardHeader>
          <form className="flex flex-wrap items-end gap-3" onSubmit={createCostCenter}>
            <div className="min-w-[220px] flex-1 space-y-1">
              <Label>Nome</Label>
              <Input name="name" required />
            </div>
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label>Codigo</Label>
              <Input name="code" placeholder="Opcional" />
            </div>
            <Button type="submit">Criar</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {costCenters.map((c) => (
              <Badge key={c.id} variant="outline">{c.name}</Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
