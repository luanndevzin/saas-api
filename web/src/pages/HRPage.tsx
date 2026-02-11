import { FormEvent, useEffect, useState } from "react";
import { useApi } from "../lib/api-provider";
import { Department, Position, Employee, TimeEntry } from "../lib/api";
import { useToast } from "../components/toast";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/table";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { formatCents, formatDate, formatDateTime } from "../lib/utils";
import { PageHeader } from "../components/page-header";

type Tab = "estrutura" | "colaboradores" | "ponto";

export function HRPage() {
  const { request } = useApi();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeEmp, setTimeEmp] = useState<string>("");
  const [timeFrom, setTimeFrom] = useState<string>("");
  const [timeTo, setTimeTo] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("estrutura");

  const toArray = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, p, e] = await Promise.all([
        request<Department[]>("/departments"),
        request<Position[]>("/positions"),
        request<Employee[]>(`/employees${statusFilter ? `?status=${statusFilter}` : ""}`),
      ]);
      setDepartments(toArray(d));
      setPositions(toArray(p));
      setEmployees(toArray(e));
    } catch (err: any) {
      toast({ title: "Erro ao carregar HR", description: err.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadTimeEntries = async () => {
    try {
      const params = new URLSearchParams();
      if (timeEmp) params.set("employee_id", timeEmp);
      if (timeFrom) params.set("from", timeFrom);
      if (timeTo) params.set("to", timeTo);
      const data = await request<TimeEntry[]>(`/time-entries${params.toString() ? `?${params}` : ""}`);
      setTimeEntries(toArray(data));
    } catch (err: any) {
      toast({ title: "Erro ao carregar pontos", description: err.message, variant: "error" });
    }
  };

  useEffect(() => { loadAll(); }, [statusFilter]);
  useEffect(() => { loadTimeEntries(); }, [timeEmp, timeFrom, timeTo]);

  const createDept = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/departments", { method: "POST", body: { name: fd.get("name"), code: fd.get("code") || null } });
      toast({ title: "Departamento criado", variant: "success" });
      e.currentTarget.reset();
      await loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const createPosition = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/positions", {
        method: "POST",
        body: {
          title: fd.get("title"),
          level: fd.get("level") || null,
          department_id: fd.get("department_id") ? Number(fd.get("department_id")) : null,
        },
      });
      toast({ title: "Cargo criado", variant: "success" });
      e.currentTarget.reset();
      await loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const createEmployee = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/employees", {
        method: "POST",
        body: {
          name: fd.get("name"),
          email: fd.get("email") || null,
          status: fd.get("status") || null,
          hire_date: fd.get("hire_date") || null,
          salary_cents: fd.get("salary_cents") ? Number(fd.get("salary_cents")) : null,
          department_id: fd.get("department_id") ? Number(fd.get("department_id")) : null,
          position_id: fd.get("position_id") ? Number(fd.get("position_id")) : null,
        },
      });
      toast({ title: "Colaborador criado", variant: "success" });
      e.currentTarget.reset();
      await loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const submitClock = async (type: "in" | "out", e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const employee_id = Number(fd.get("employee_id") || 0);
    if (!employee_id) {
      toast({ title: "Selecione um colaborador", variant: "error" });
      return;
    }
    const tsRaw = fd.get("timestamp")?.toString().trim();
    const note = fd.get("note")?.toString().trim();
    const body: any = { employee_id };
    if (tsRaw) {
      const d = new Date(tsRaw);
      if (!Number.isNaN(d.getTime())) body.timestamp = d.toISOString();
    }
    if (note) body.note = note;

    try {
      await request(type === "in" ? "/time-entries/clock-in" : "/time-entries/clock-out", { method: "POST", body });
      toast({ title: type === "in" ? "Entrada registrada" : "Saída registrada", variant: "success" });
      e.currentTarget.reset();
      await loadTimeEntries();
    } catch (err: any) {
      toast({ title: "Erro ao registrar ponto", description: err.message, variant: "error" });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="RH"
        subtitle="Cadastre departamentos, cargos e colaboradores com status."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { loadAll(); loadTimeEntries(); }} disabled={loading}>
              Atualizar
            </Button>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
              <option value="">Status: todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="terminated">Demitidos</option>
            </Select>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          { id: "estrutura", label: "Estrutura" },
          { id: "colaboradores", label: "Colaboradores" },
          { id: "ponto", label: "Ponto" },
        ].map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "default" : "outline"}
            onClick={() => setTab(t.id as Tab)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "estrutura" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="mb-3">
              <CardTitle>Departamentos</CardTitle>
              <CardDescription>Criar + listar</CardDescription>
            </CardHeader>
            <form className="space-y-2" onSubmit={createDept}>
              <Label>Nome</Label>
              <Input name="name" required />
              <Label>Codigo</Label>
              <Input name="code" placeholder="Opcional" />
              <Button type="submit" className="w-full">Criar</Button>
            </form>
            <div className="mt-4 max-h-64 space-y-2 overflow-auto pr-1 text-sm">
              {departments.map((d) => (
                <div key={d.id} className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                  <div className="font-semibold">{d.name}</div>
                  {d.code && <div className="text-xs text-muted-foreground">{d.code}</div>}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader className="mb-3">
              <CardTitle>Cargos</CardTitle>
              <CardDescription>Vincule a um departamento</CardDescription>
            </CardHeader>
            <form className="space-y-2" onSubmit={createPosition}>
              <Label>Titulo</Label>
              <Input name="title" required />
              <Label>Nivel</Label>
              <Input name="level" placeholder="Senior, Pleno..." />
              <Label>Departamento</Label>
              <Select name="department_id" defaultValue="">
                <option value="">(opcional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
              <Button type="submit" className="w-full">Criar</Button>
            </form>
            <div className="mt-4 max-h-64 overflow-auto pr-1 text-sm">
              <Table>
                <THead><TR><TH>Titulo</TH><TH>Depto</TH></TR></THead>
                <TBody>
                  {positions.map((p) => (
                    <TR key={p.id}><TD>{p.title}</TD><TD>{p.department_id || "-"}</TD></TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>

          <Card>
            <CardHeader className="mb-3">
              <CardTitle>Resumo rápido</CardTitle>
              <CardDescription>Estrutura do time</CardDescription>
            </CardHeader>
            <div className="space-y-2 text-sm">
              <div className="rounded-md border border-border/70 px-3 py-2">
                <div className="text-xs text-muted-foreground">Departamentos</div>
                <div className="text-xl font-bold">{departments.length}</div>
              </div>
              <div className="rounded-md border border-border/70 px-3 py-2">
                <div className="text-xs text-muted-foreground">Cargos</div>
                <div className="text-xl font-bold">{positions.length}</div>
              </div>
              <div className="rounded-md border border-border/70 px-3 py-2">
                <div className="text-xs text-muted-foreground">Colaboradores</div>
                <div className="text-xl font-bold">{employees.length}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "colaboradores" && (
        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Colaboradores</CardTitle>
            <CardDescription>Criar e listar sem recarregar</CardDescription>
          </CardHeader>
          <div className="grid gap-4 lg:grid-cols-2">
            <form className="grid grid-cols-2 gap-3" onSubmit={createEmployee}>
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input name="name" required />
              </div>
              <div className="col-span-2">
                <Label>Email</Label>
                <Input name="email" type="email" />
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue="">
                  <option value="">default: active</option>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="terminated">terminated</option>
                </Select>
              </div>
              <div>
                <Label>Data de admissao</Label>
                <Input name="hire_date" type="date" />
              </div>
              <div>
                <Label>Salario (centavos)</Label>
                <Input name="salary_cents" type="number" min={0} />
              </div>
              <div>
                <Label>Departamento</Label>
                <Select name="department_id" defaultValue="">
                  <option value="">(opcional)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} (#{d.id})</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Posicao</Label>
                <Select name="position_id" defaultValue="">
                  <option value="">(opcional)</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} (#{p.id})</option>
                  ))}
                </Select>
              </div>
              <div className="col-span-2">
                <Button type="submit" className="w-full">Criar</Button>
              </div>
            </form>

            <div className="max-h-[520px] overflow-auto pr-1">
              <Table>
                <THead>
                  <TR><TH>Nome</TH><TH>Status</TH><TH>Salario</TH><TH>Contratacao</TH></TR>
                </THead>
                <TBody>
                  {employees.map((e) => (
                    <TR key={e.id}>
                      <TD>
                        <div className="font-semibold">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.email}</div>
                      </TD>
                      <TD><Badge variant={e.status === "active" ? "success" : e.status === "terminated" ? "warning" : "outline"}>{e.status}</Badge></TD>
                      <TD>{formatCents(e.salary_cents)}</TD>
                      <TD>{formatDate(e.hire_date)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </div>
        </Card>
      )}

      {tab === "ponto" && (
        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Controle de ponto</CardTitle>
            <CardDescription>Bater entrada/saída e ver últimas marcações</CardDescription>
          </CardHeader>

          <div className="grid gap-4 lg:grid-cols-3">
            <form className="space-y-2 rounded-lg border border-border/70 p-3" onSubmit={(e) => submitClock("in", e)}>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold">Entrada</Label>
                <Badge variant="success">Clock-in</Badge>
              </div>
              <Select name="employee_id" defaultValue="">
                <option value="">Selecione colaborador</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </Select>
              <Label className="text-xs text-muted-foreground">Data/hora (opcional)</Label>
              <Input type="datetime-local" name="timestamp" />
              <Label className="text-xs text-muted-foreground">Observação (opcional)</Label>
              <Input name="note" placeholder="Ex: remoto, cliente, etc." />
              <Button type="submit" className="w-full">Registrar entrada</Button>
            </form>

            <form className="space-y-2 rounded-lg border border-border/70 p-3" onSubmit={(e) => submitClock("out", e)}>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold">Saída</Label>
                <Badge variant="outline">Clock-out</Badge>
              </div>
              <Select name="employee_id" defaultValue="">
                <option value="">Selecione colaborador</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </Select>
              <Label className="text-xs text-muted-foreground">Data/hora (opcional)</Label>
              <Input type="datetime-local" name="timestamp" />
              <Label className="text-xs text-muted-foreground">Observação (opcional)</Label>
              <Input name="note" placeholder="Ex: fim do expediente" />
              <Button type="submit" variant="secondary" className="w-full">Registrar saída</Button>
            </form>

            <div className="rounded-lg border border-border/70 p-3 space-y-2 bg-muted/30">
              <Label className="text-sm font-semibold">Filtros</Label>
              <Label className="text-xs text-muted-foreground">Colaborador</Label>
              <Select value={timeEmp} onChange={(e) => setTimeEmp(e.target.value)}>
                <option value="">Todos</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </Select>
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="date" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="date" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
              <Button type="button" variant="outline" onClick={loadTimeEntries}>Atualizar lista</Button>
            </div>
          </div>

          <div className="mt-4 max-h-96 overflow-auto pr-1">
            <Table>
              <THead>
                <TR>
                  <TH>Colaborador</TH>
                  <TH>Entrada</TH>
                  <TH>Saída</TH>
                  <TH>Status</TH>
                  <TH>Obs</TH>
                </TR>
              </THead>
              <TBody>
                {timeEntries.map((t) => {
                  const emp = employees.find((e) => e.id === t.employee_id);
                  const open = !t.clock_out;
                  return (
                    <TR key={t.id}>
                      <TD>
                        <div className="font-semibold">{emp?.name || `ID ${t.employee_id}`}</div>
                        <div className="text-xs text-muted-foreground">#{t.id}</div>
                      </TD>
                      <TD>{formatDateTime(t.clock_in)}</TD>
                      <TD>{t.clock_out ? formatDateTime(t.clock_out) : "-"}</TD>
                      <TD>
                        <Badge variant={open ? "warning" : "success"}>{open ? "Aberto" : "Fechado"}</Badge>
                      </TD>
                      <TD>
                        <div className="text-xs text-muted-foreground">
                          {t.note_in && <div>In: {t.note_in}</div>}
                          {t.note_out && <div>Out: {t.note_out}</div>}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
