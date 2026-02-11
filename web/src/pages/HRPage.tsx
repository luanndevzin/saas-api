import { FormEvent, useEffect, useRef, useState } from "react";
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
  const [faceEmployee, setFaceEmployee] = useState<string>("");
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceResult, setFaceResult] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");
  const [cameraOn, setCameraOn] = useState(false);
  const [tab, setTab] = useState<Tab>("estrutura");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err: any) {
      setCameraError(err.message || "Não foi possível acessar a câmera");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    setCameraOn(false);
  };

  const captureBase64 = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const handleFace = async (mode: "register" | "verify") => {
    if (!faceEmployee) {
      toast({ title: "Selecione um colaborador", variant: "error" });
      return;
    }
    const img = captureBase64();
    if (!img) {
      toast({ title: "Não foi possível capturar imagem", variant: "error" });
      return;
    }
    setFaceLoading(true);
    setFaceResult("");
    try {
      const body = { employee_id: Number(faceEmployee), image_base64: img };
      const res = await request<{ match?: boolean; distance?: number; phash?: number }>(mode === "register" ? "/face/register" : "/face/verify", {
        method: "POST",
        body,
      });
      if (mode === "register") {
        setFaceResult("Template salvo");
      } else {
        const matchText = res?.match ? "Match" : "Não bateu";
        setFaceResult(`${matchText} (dist=${res?.distance ?? "?"})`);
      }
      toast({ title: "OK", variant: "success" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    } finally {
      setFaceLoading(false);
    }
  };

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

  const submitTimeEntry = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const employee_id = Number(fd.get("employee_id") || 0);
    if (!employee_id) {
      toast({ title: "Selecione um colaborador", variant: "error" });
      return;
    }
    const clockInRaw = fd.get("clock_in")?.toString().trim();
    const clockOutRaw = fd.get("clock_out")?.toString().trim();
    const noteIn = fd.get("note_in")?.toString().trim();
    const noteOut = fd.get("note_out")?.toString().trim();

    if (!clockInRaw) {
      toast({ title: "Informe a data/hora de entrada", variant: "error" });
      return;
    }

    const body: any = { employee_id, clock_in: new Date(clockInRaw).toISOString() };
    if (clockOutRaw) {
      const d = new Date(clockOutRaw);
      if (!Number.isNaN(d.getTime())) body.clock_out = d.toISOString();
    }
    if (noteIn) body.note_in = noteIn;
    if (noteOut) body.note_out = noteOut;

    try {
      await request("/time-entries", { method: "POST", body });
      toast({ title: "Batida registrada", variant: "success" });
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
            <form className="space-y-2 rounded-lg border border-border/70 p-3" onSubmit={submitTimeEntry}>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold">Nova batida</Label>
                <Badge variant="success">Clock</Badge>
              </div>
              <Select name="employee_id" defaultValue="">
                <option value="">Selecione colaborador</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </Select>
              <Label className="text-xs text-muted-foreground">Entrada *</Label>
              <Input type="datetime-local" name="clock_in" required />
              <Label className="text-xs text-muted-foreground">Saída (opcional)</Label>
              <Input type="datetime-local" name="clock_out" />
              <Label className="text-xs text-muted-foreground">Observação entrada</Label>
              <Input name="note_in" placeholder="Ex: kiosk facial" />
              <Label className="text-xs text-muted-foreground">Observação saída</Label>
              <Input name="note_out" placeholder="Ex: fim do expediente" />
              <Button type="submit" className="w-full">Registrar batida</Button>
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

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/70 bg-muted/20 p-4">
              <CardHeader className="mb-2 p-0">
                <CardTitle>Integração com Jibble</CardTitle>
                <CardDescription>Passo-a-passo para importar batidas faciais.</CardDescription>
              </CardHeader>
              <div className="space-y-2 text-sm text-muted-foreground">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Em Jibble, preencha o <strong>Employee ID</strong> igual ao <strong>employee_code</strong> do colaborador.</li>
                  <li>Exporte o CSV de timesheets no período desejado.</li>
                  <li>Rode o importador localmente ou no Railway cron.</li>
                </ol>
                <div className="rounded-md bg-background/70 border border-dashed border-border/70 p-3 text-xs text-foreground">
                  go run ./cmd/importer ^
                  <br />  -file jibble_timesheets.csv ^
                  <br />  -base-url https://diplomatic-simplicity-production-70e0.up.railway.app/v1 ^
                  <br />  -token "&lt;JWT_owner_ou_hr&gt;"
                </div>
                <p className="text-xs text-muted-foreground">Dica: gere o JWT fazendo login como owner/hr e copie o token salvo no navegador.</p>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href="https://web.jibble.io" target="_blank" rel="noreferrer">Abrir Jibble</a>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href="mailto:suporte@saas.com">Precisa de ajuda?</a>
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="border-border/70 bg-muted/20 p-4">
              <CardHeader className="mb-2 p-0">
                <CardTitle>Rosto direto no SaaS</CardTitle>
                <CardDescription>Capture, registre e valide sem app externo.</CardDescription>
              </CardHeader>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Select value={faceEmployee} onChange={(e) => setFaceEmployee(e.target.value)}>
                  <option value="">Selecione colaborador</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code || `ID ${emp.id}`})</option>
                  ))}
                </Select>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={cameraOn ? stopCamera : startCamera}>
                    {cameraOn ? "Parar câmera" : "Iniciar câmera"}
                  </Button>
                  <Button type="button" size="sm" onClick={() => handleFace("register")} disabled={faceLoading}>Registrar face</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => handleFace("verify")} disabled={faceLoading}>Verificar face</Button>
                </div>
                {cameraError && <div className="text-xs text-destructive">{cameraError}</div>}
                <div className="rounded-lg border border-border/60 bg-background/80 p-2 flex flex-col items-center">
                  <video ref={videoRef} className="w-full max-w-sm rounded-md bg-black" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                {faceResult && <div className="text-xs text-foreground font-semibold">Resultado: {faceResult}</div>}
                <p className="text-xs text-muted-foreground">Dica: boa luz frontal, rosto centralizado. O sistema usa pHash com tolerância.</p>
              </div>
            </Card>
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
