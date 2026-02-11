import { FormEvent, useEffect, useMemo, useState } from "react";
import { useApi } from "../lib/api-provider";
import { Customer, Receivable, CostCenter } from "../lib/api";
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

const statusColor: Record<string, "default" | "success" | "warning" | "outline"> = {
  draft: "outline",
  issued: "warning",
  paid: "success",
  canceled: "outline",
};

export function FinanceARPage() {
  const { request } = useApi();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const customerMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c.name])), [customers]);

  const loadAll = async () => {
    try {
      const [c, r, cc] = await Promise.all([
        request<Customer[]>("/customers"),
        request<Receivable[]>(`/receivables${statusFilter ? `?status=${statusFilter}` : ""}`),
        request<CostCenter[]>("/cost-centers"),
      ]);
      setCustomers(c); setReceivables(r); setCostCenters(cc);
    } catch (err: any) {
      toast({ title: "Erro ao carregar AR", description: err.message, variant: "error" });
    }
  };

  useEffect(() => { loadAll(); }, [statusFilter]);

  const createCustomer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/customers", {
        method: "POST",
        body: {
          name: fd.get("name"),
          document: fd.get("document") || null,
          email: fd.get("email") || null,
          phone: fd.get("phone") || null,
        },
      });
      toast({ title: "Cliente criado", variant: "success" });
      e.currentTarget.reset();
      loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const createReceivable = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/receivables", {
        method: "POST",
        body: {
          customer_id: Number(fd.get("customer_id")),
          amount_cents: Number(fd.get("amount_cents")),
          due_date: fd.get("due_date"),
          currency: fd.get("currency") || null,
          reference: fd.get("reference") || null,
          description: fd.get("description") || null,
        },
      });
      toast({ title: "Recebivel criado", variant: "success" });
      e.currentTarget.reset();
      loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const updateCostCenter = async (rec: Receivable, ccId: string) => {
    try {
      await request(`/receivables/${rec.id}`, { method: "PATCH", body: { cost_center_id: ccId ? Number(ccId) : null } });
      toast({ title: "Centro de custo salvo", variant: "success" });
      loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const doAction = async (id: number, action: "issue" | "cancel" | "mark-received") => {
    try {
      let body: any = undefined;
      if (action === "mark-received") {
        const method = window.prompt("Metodo (pix/boleto/cartao)?", "pix") || undefined;
        body = { method };
      }
      await request(`/receivables/${id}/${action}`, { method: "POST", body });
      toast({ title: `${action} ok`, variant: "success" });
      loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financeiro • AR"
        subtitle="Clientes e recebíveis com emissão e baixa."
        actions={
          <>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-52">
              <option value="">Status: todos</option>
              <option value="draft">draf</option>
              <option value="issued">issued</option>
              <option value="paid">paid</option>
              <option value="canceled">canceled</option>
            </Select>
            <Button variant="outline" size="sm" onClick={loadAll}>Atualizar</Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Novo cliente</CardTitle>
            <CardDescription>POST /customers</CardDescription>
          </CardHeader>
          <form className="space-y-2" onSubmit={createCustomer}>
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
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="mb-3">
            <CardTitle>Novo recebivel</CardTitle>
            <CardDescription>POST /receivables</CardDescription>
          </CardHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={createReceivable}>
            <div>
              <Label>Cliente</Label>
              <Select name="customer_id" required defaultValue="">
                <option value="" disabled>Selecione</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <Button type="submit">Criar recebivel</Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader className="mb-3">
          <CardTitle>Recebiveis</CardTitle>
          <CardDescription>Lista com acoes</CardDescription>
        </CardHeader>
        <Table>
          <THead>
            <TR><TH>ID</TH><TH>Cliente</TH><TH>Valor</TH><TH>Venc.</TH><TH>Status</TH><TH>CC</TH><TH>Acoes</TH></TR>
          </THead>
          <TBody>
            {receivables.map((r) => (
              <TR key={r.id}>
                <TD className="text-xs text-muted-foreground">{r.id}</TD>
                <TD>
                  <div className="font-semibold">{customerMap[r.customer_id] || r.customer_id}</div>
                  {r.reference && <div className="text-xs text-muted-foreground">{r.reference}</div>}
                </TD>
                <TD>{formatCents(r.amount_cents, r.currency)}</TD>
                <TD>{formatDate(r.due_date)}</TD>
                <TD><Badge variant={statusColor[r.status] || "outline"}>{r.status}</Badge></TD>
                <TD>
                  {r.status === "draft" ? (
                    <Select defaultValue={r.cost_center_id ? String(r.cost_center_id) : ""} onChange={(e) => updateCostCenter(r, e.target.value)}>
                      <option value="">(nenhum)</option>
                      {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  ) : (
                    r.cost_center_id || "-"
                  )}
                </TD>
                <TD className="space-x-2 whitespace-nowrap">
                  {r.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => doAction(r.id, "issue")}>Emitir</Button>
                  )}
                  {(r.status === "draft" || r.status === "issued") && (
                    <Button size="sm" variant="destructive" onClick={() => doAction(r.id, "cancel")}>Cancelar</Button>
                  )}
                  {r.status === "issued" && (
                    <Button size="sm" onClick={() => doAction(r.id, "mark-received")}>Marcar recebido</Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}



