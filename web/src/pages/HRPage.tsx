import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../lib/api-provider";
import {
  Benefit,
  ClockifyConfig,
  ClockifyStatus,
  ClockifySyncResult,
  Department,
  Employee,
  EmployeeBenefit,
  EmployeeCompensation,
  EmployeeDocument,
  HRTimeEntry,
  Location,
  Position,
  Team,
  TimeBankAdjustment,
  TimeBankClosure,
  TimeBankSettings,
  TimeBankSummary,
  TimeOffRequest,
  TimeOffType,
} from "../lib/api";
import { useToast } from "../components/toast";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/table";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { formatCents, formatDate, formatDateTime } from "../lib/utils";
import { PageHeader } from "../components/page-header";

type Tab = "estrutura" | "colaboradores" | "folgas" | "ponto" | "banco";

const statusColors: Record<string, "default" | "success" | "warning" | "outline"> = {
  active: "success",
  inactive: "outline",
  terminated: "warning",
};

const requestColors: Record<string, "default" | "success" | "warning" | "outline"> = {
  pending: "warning",
  approved: "success",
  rejected: "outline",
  canceled: "outline",
};

const toArray = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);
const numOrNull = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : Number(s);
};

const isTab = (value: string | null): value is Tab =>
  value === "estrutura" || value === "colaboradores" || value === "folgas" || value === "ponto" || value === "banco";

const defaultClockifyStatus: ClockifyStatus = {
  configured: false,
  entries_total: 0,
  entries_last_7_days: 0,
  entries_running: 0,
  active_employees: 0,
  mapped_employees: 0,
  active_unmapped_employees: 0,
  unmapped_employees_preview: [],
};

const defaultTimeBankSettings: TimeBankSettings = {
  target_daily_minutes: 480,
  include_saturday: false,
};

const defaultTimeBankSummary: TimeBankSummary = {
  start_date: "",
  end_date: "",
  target_daily_minutes: 480,
  include_saturday: false,
  employees: [],
  totals: {
    worked_seconds: 0,
    expected_seconds: 0,
    adjustment_seconds: 0,
    balance_seconds: 0,
  },
};

export function HRPage() {
  const { request, me } = useApi();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [timeOffTypes, setTimeOffTypes] = useState<TimeOffType[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [employeeBenefits, setEmployeeBenefits] = useState<EmployeeBenefit[]>([]);
  const [employeeDocs, setEmployeeDocs] = useState<EmployeeDocument[]>([]);
  const [compensations, setCompensations] = useState<EmployeeCompensation[]>([]);
  const [clockifyConfig, setClockifyConfig] = useState<ClockifyConfig>({ configured: false });
  const [clockifyStatus, setClockifyStatus] = useState<ClockifyStatus>(defaultClockifyStatus);
  const [timeEntries, setTimeEntries] = useState<HRTimeEntry[]>([]);
  const [clockifySyncResult, setClockifySyncResult] = useState<ClockifySyncResult | null>(null);
  const [timeBankSettings, setTimeBankSettings] = useState<TimeBankSettings>(defaultTimeBankSettings);
  const [timeBankSummary, setTimeBankSummary] = useState<TimeBankSummary>(defaultTimeBankSummary);
  const [timeBankAdjustments, setTimeBankAdjustments] = useState<TimeBankAdjustment[]>([]);
  const [timeBankClosures, setTimeBankClosures] = useState<TimeBankClosure[]>([]);

  const tabParam = searchParams.get("secao");
  const tab: Tab = isTab(tabParam) ? tabParam : "estrutura";
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [savingClockify, setSavingClockify] = useState(false);
  const [syncingClockify, setSyncingClockify] = useState(false);
  const [savingTimeBankSettings, setSavingTimeBankSettings] = useState(false);
  const [loadingTimeBankSummary, setLoadingTimeBankSummary] = useState(false);
  const [savingTimeBankAdjustment, setSavingTimeBankAdjustment] = useState(false);
  const [closingTimeBankPeriod, setClosingTimeBankPeriod] = useState(false);
  const [reopeningClosureId, setReopeningClosureId] = useState<number | null>(null);
  const [creatingEmployeeAccount, setCreatingEmployeeAccount] = useState(false);
  const [entriesFilterStart, setEntriesFilterStart] = useState(() => {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return first.toISOString().slice(0, 10);
  });
  const [entriesFilterEnd, setEntriesFilterEnd] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [timeBankStartDate, setTimeBankStartDate] = useState(() => {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return first.toISOString().slice(0, 10);
  });
  const [timeBankEndDate, setTimeBankEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const deptMap = useMemo(() => Object.fromEntries(departments.map((d) => [d.id, d.name])), [departments]);
  const posMap = useMemo(() => Object.fromEntries(positions.map((p) => [p.id, p.title])), [positions]);
  const empMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e.name])), [employees]);
  const typeMap = useMemo(() => Object.fromEntries(timeOffTypes.map((t) => [t.id, t.name])), [timeOffTypes]);
  const benefitMap = useMemo(() => Object.fromEntries(benefits.map((b) => [b.id, b.name])), [benefits]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );

  const totalSyncedHours = useMemo(() => {
    const seconds = timeEntries.reduce((acc, item) => acc + (item.duration_seconds || 0), 0);
    return (seconds / 3600).toFixed(2);
  }, [timeEntries]);

  const runningEntriesCount = useMemo(
    () => timeEntries.filter((item) => item.is_running).length,
    [timeEntries],
  );

  const loadStructure = async () => {
    try {
      const [d, p, l, t] = await Promise.all([
        request<Department[]>("/departments"),
        request<Position[]>("/positions"),
        request<Location[]>("/locations"),
        request<Team[]>("/teams"),
      ]);
      setDepartments(toArray(d));
      setPositions(toArray(p));
      setLocations(toArray(l));
      setTeams(toArray(t));
    } catch (err: any) {
      toast({ title: "Erro ao carregar estrutura", description: err.message, variant: "error" });
    }
  };

  const loadEmployees = async () => {
    try {
      const e = await request<Employee[]>("/employees");
      setEmployees(toArray(e));
    } catch (err: any) {
      toast({ title: "Erro ao carregar colaboradores", description: err.message, variant: "error" });
    }
  };

  const loadBenefits = async () => {
    try {
      const b = await request<Benefit[]>("/benefits");
      setBenefits(toArray(b));
    } catch (err: any) {
      toast({ title: "Erro ao carregar beneficios", description: err.message, variant: "error" });
    }
  };

  const loadTimeOff = async () => {
    try {
      const [types, reqs] = await Promise.all([
        request<TimeOffType[]>("/time-off-types"),
        request<TimeOffRequest[]>("/time-off-requests"),
      ]);
      setTimeOffTypes(toArray(types));
      setTimeOffRequests(toArray(reqs));
    } catch (err: any) {
      toast({ title: "Erro ao carregar folgas", description: err.message, variant: "error" });
    }
  };

  const loadClockifyConfig = async () => {
    try {
      const cfg = await request<ClockifyConfig>("/integrations/clockify");
      setClockifyConfig(cfg || { configured: false });
    } catch (err: any) {
      toast({ title: "Erro ao carregar integracao Clockify", description: err.message, variant: "error" });
    }
  };

  const loadClockifyStatus = async () => {
    try {
      const status = await request<ClockifyStatus>("/integrations/clockify/status");
      setClockifyStatus(status || defaultClockifyStatus);
    } catch (err: any) {
      toast({ title: "Erro ao carregar status do Clockify", description: err.message, variant: "error" });
    }
  };

  const loadTimeEntries = async (startDate = entriesFilterStart, endDate = entriesFilterEnd) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      params.set("limit", "500");
      const items = await request<HRTimeEntry[]>(`/time-entries?${params.toString()}`);
      setTimeEntries(toArray(items));
    } catch (err: any) {
      toast({ title: "Erro ao carregar batidas", description: err.message, variant: "error" });
    }
  };

  const loadTimeBankSettings = async () => {
    try {
      const data = await request<TimeBankSettings>("/time-bank/settings");
      setTimeBankSettings(data || defaultTimeBankSettings);
    } catch (err: any) {
      toast({ title: "Erro ao carregar configuracao de banco de horas", description: err.message, variant: "error" });
    }
  };

  const loadTimeBankSummary = async (startDate = timeBankStartDate, endDate = timeBankEndDate) => {
    setLoadingTimeBankSummary(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const data = await request<TimeBankSummary>(`/time-bank/summary?${params.toString()}`);
      setTimeBankSummary(data || defaultTimeBankSummary);
    } catch (err: any) {
      toast({ title: "Erro ao carregar resumo de banco de horas", description: err.message, variant: "error" });
    } finally {
      setLoadingTimeBankSummary(false);
    }
  };

  const loadTimeBankAdjustments = async (startDate = timeBankStartDate, endDate = timeBankEndDate) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      params.set("limit", "200");
      const data = await request<TimeBankAdjustment[]>(`/time-bank/adjustments?${params.toString()}`);
      setTimeBankAdjustments(toArray(data));
    } catch (err: any) {
      toast({ title: "Erro ao carregar ajustes de banco de horas", description: err.message, variant: "error" });
    }
  };

  const loadTimeBankClosures = async () => {
    try {
      const data = await request<TimeBankClosure[]>("/time-bank/closures?limit=24");
      setTimeBankClosures(toArray(data));
    } catch (err: any) {
      toast({ title: "Erro ao carregar fechamentos", description: err.message, variant: "error" });
    }
  };

  const refreshTimeBank = async (startDate = timeBankStartDate, endDate = timeBankEndDate) => {
    await Promise.all([
      loadTimeBankSettings(),
      loadTimeBankSummary(startDate, endDate),
      loadTimeBankAdjustments(startDate, endDate),
      loadTimeBankClosures(),
    ]);
  };

  const saveTimeBankSettings = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const targetDailyMinutes = Number(fd.get("target_daily_minutes") || 0);
    const includeSaturday = (fd.get("include_saturday") || "0").toString() === "1";

    setSavingTimeBankSettings(true);
    try {
      await request("/time-bank/settings", {
        method: "PUT",
        body: {
          target_daily_minutes: targetDailyMinutes,
          include_saturday: includeSaturday,
        },
      });
      toast({ title: "Configuracao de banco de horas salva", variant: "success" });
      await loadTimeBankSettings();
      await loadTimeBankSummary(timeBankStartDate, timeBankEndDate);
    } catch (err: any) {
      toast({ title: "Erro ao salvar configuracao", description: err.message, variant: "error" });
    } finally {
      setSavingTimeBankSettings(false);
    }
  };

  const createTimeBankAdjustment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const employeeId = Number(fd.get("employee_id") || 0);
    const effectiveDate = (fd.get("effective_date") || "").toString();
    const minutesDelta = Number(fd.get("minutes_delta") || 0);
    const reason = (fd.get("reason") || "").toString().trim();

    setSavingTimeBankAdjustment(true);
    try {
      await request("/time-bank/adjustments", {
        method: "POST",
        body: {
          employee_id: employeeId,
          effective_date: effectiveDate,
          minutes_delta: minutesDelta,
          reason: reason || null,
        },
      });
      toast({ title: "Ajuste de banco de horas criado", variant: "success" });
      e.currentTarget.reset();
      await loadTimeBankSummary(timeBankStartDate, timeBankEndDate);
      await loadTimeBankAdjustments(timeBankStartDate, timeBankEndDate);
      await loadTimeBankClosures();
    } catch (err: any) {
      toast({ title: "Erro ao criar ajuste", description: err.message, variant: "error" });
    } finally {
      setSavingTimeBankAdjustment(false);
    }
  };

  const closeTimeBankPeriod = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const startDate = (fd.get("start_date") || "").toString();
    const endDate = (fd.get("end_date") || "").toString();
    const note = (fd.get("note") || "").toString().trim();

    setClosingTimeBankPeriod(true);
    try {
      await request("/time-bank/closures/close", {
        method: "POST",
        body: {
          start_date: startDate,
          end_date: endDate,
          note: note || null,
        },
      });
      toast({ title: "Periodo fechado com sucesso", variant: "success" });
      await loadTimeBankClosures();
      await loadTimeBankSummary(timeBankStartDate, timeBankEndDate);
    } catch (err: any) {
      toast({ title: "Erro ao fechar periodo", description: err.message, variant: "error" });
    } finally {
      setClosingTimeBankPeriod(false);
    }
  };

  const reopenTimeBankClosure = async (closureId: number) => {
    setReopeningClosureId(closureId);
    try {
      await request(`/time-bank/closures/${closureId}/reopen`, {
        method: "POST",
        body: {},
      });
      toast({ title: "Fechamento reaberto", variant: "success" });
      await loadTimeBankClosures();
      await loadTimeBankSummary(timeBankStartDate, timeBankEndDate);
    } catch (err: any) {
      toast({ title: "Erro ao reabrir fechamento", description: err.message, variant: "error" });
    } finally {
      setReopeningClosureId(null);
    }
  };

  const loadEmployeeExtras = async (id: number) => {
    try {
      const [comps, docs, ben] = await Promise.all([
        request<EmployeeCompensation[]>(`/employees/${id}/compensations`),
        request<EmployeeDocument[]>(`/employees/${id}/documents`),
        request<EmployeeBenefit[]>(`/employees/${id}/benefits`),
      ]);
      setCompensations(toArray(comps));
      setEmployeeDocs(toArray(docs));
      setEmployeeBenefits(toArray(ben));
    } catch (err: any) {
      toast({ title: "Erro ao carregar dados do colaborador", description: err.message, variant: "error" });
    }
  };

  useEffect(() => {
    loadStructure();
    loadBenefits();
    loadTimeOff();
    loadClockifyConfig();
    loadClockifyStatus();
    loadTimeEntries();
    loadEmployees();
    loadTimeBankSettings();
    loadTimeBankSummary();
    loadTimeBankAdjustments();
    loadTimeBankClosures();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) loadEmployeeExtras(selectedEmployeeId);
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (isTab(searchParams.get("secao"))) return;
    const next = new URLSearchParams(searchParams);
    next.set("secao", "estrutura");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedEmployeeId && !employees.some((item) => item.id === selectedEmployeeId)) {
      setSelectedEmployeeId(null);
    }
  }, [employees, selectedEmployeeId]);

  const createDept = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/departments", { method: "POST", body: { name: fd.get("name"), code: fd.get("code") || null } });
      toast({ title: "Departamento criado", variant: "success" });
      e.currentTarget.reset();
      loadStructure();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
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
          department_id: numOrNull(fd.get("department_id")),
        },
      });
      toast({ title: "Cargo criado", variant: "success" });
      e.currentTarget.reset();
      loadStructure();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const createLocation = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/locations", {
        method: "POST",
        body: {
          name: fd.get("name"),
          code: fd.get("code") || null,
          kind: fd.get("kind") || null,
          country: fd.get("country") || null,
          state: fd.get("state") || null,
          city: fd.get("city") || null,
        },
      });
      toast({ title: "Local criado", variant: "success" });
      e.currentTarget.reset();
      loadStructure();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const createTeam = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/teams", {
        method: "POST",
        body: {
          name: fd.get("name"),
          department_id: numOrNull(fd.get("department_id")),
          manager_employee_id: numOrNull(fd.get("manager_employee_id")),
          location_id: numOrNull(fd.get("location_id")),
        },
      });
      toast({ title: "Time criado", variant: "success" });
      e.currentTarget.reset();
      loadStructure();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
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
          salary_cents: numOrNull(fd.get("salary_cents")),
          department_id: numOrNull(fd.get("department_id")),
          position_id: numOrNull(fd.get("position_id")),
          manager_id: numOrNull(fd.get("manager_id")),
        },
      });
      toast({ title: "Colaborador criado", variant: "success" });
      e.currentTarget.reset();
      loadEmployees();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const updateEmployee = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const fd = new FormData(e.currentTarget);
    try {
      await request(`/employees/${selectedEmployee.id}`, {
        method: "PATCH",
        body: {
          name: fd.get("name") || undefined,
          email: fd.get("email") || null,
          status: fd.get("status") || undefined,
          hire_date: fd.get("hire_date") || null,
          termination_date: fd.get("termination_date") || null,
          department_id: numOrNull(fd.get("department_id")),
          position_id: numOrNull(fd.get("position_id")),
          manager_id: numOrNull(fd.get("manager_id")),
          salary_cents: numOrNull(fd.get("salary_cents")),
        },
      });
      toast({ title: "Dados atualizados", variant: "success" });
      loadEmployees();
      loadEmployeeExtras(selectedEmployee.id);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const createEmployeeAccount = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const fd = new FormData(e.currentTarget);
    setCreatingEmployeeAccount(true);
    try {
      const payload = {
        name: fd.get("name") || null,
        password: fd.get("password") || null,
      };
      const res = await request<{ email: string; new_user: boolean }>(
        `/employees/${selectedEmployee.id}/account`,
        { method: "POST", body: payload },
      );
      toast({
        title: res?.new_user ? "Acesso criado" : "Acesso atualizado",
        description: `Login do colaborador: ${res?.email || selectedEmployee.email || "-"}`,
        variant: "success",
      });
      e.currentTarget.reset();
      loadEmployees();
    } catch (err: any) {
      toast({ title: "Erro ao criar acesso", description: err.message, variant: "error" });
    } finally {
      setCreatingEmployeeAccount(false);
    }
  };

  const createCompensation = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const fd = new FormData(e.currentTarget);
    try {
      await request(`/employees/${selectedEmployee.id}/compensations`, {
        method: "POST",
        body: {
          effective_at: fd.get("effective_at"),
          salary_cents: Number(fd.get("salary_cents") || 0),
          adjustment_type: fd.get("adjustment_type") || null,
          note: fd.get("note") || null,
        },
      });
      toast({ title: "Histórico salvo", variant: "success" });
      e.currentTarget.reset();
      loadEmployeeExtras(selectedEmployee.id);
      loadEmployees();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const createBenefit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/benefits", {
        method: "POST",
        body: {
          name: fd.get("name"),
          provider: fd.get("provider") || null,
          coverage_level: fd.get("coverage_level") || null,
          cost_cents: numOrNull(fd.get("cost_cents")) ?? 0,
        },
      });
      toast({ title: "Benefício criado", variant: "success" });
      e.currentTarget.reset();
      loadBenefits();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const assignBenefit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const fd = new FormData(e.currentTarget);
    try {
      await request(`/employees/${selectedEmployee.id}/benefits`, {
        method: "POST",
        body: {
          benefit_id: Number(fd.get("benefit_id")),
          effective_date: fd.get("effective_date") || null,
        },
      });
      toast({ title: "Benefício vinculado", variant: "success" });
      e.currentTarget.reset();
      loadEmployeeExtras(selectedEmployee.id);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const removeBenefit = async (benefitId: number) => {
    if (!selectedEmployee) return;
    try {
      await request(`/employees/${selectedEmployee.id}/benefits/${benefitId}`, { method: "DELETE" });
      toast({ title: "Benefício removido", variant: "success" });
      loadEmployeeExtras(selectedEmployee.id);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const createDocument = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const fd = new FormData(e.currentTarget);
    try {
      await request(`/employees/${selectedEmployee.id}/documents`, {
        method: "POST",
        body: {
          doc_type: fd.get("doc_type"),
          file_name: fd.get("file_name") || null,
          file_url: fd.get("file_url"),
          expires_at: fd.get("expires_at") || null,
          note: fd.get("note") || null,
        },
      });
      toast({ title: "Documento salvo", variant: "success" });
      e.currentTarget.reset();
      loadEmployeeExtras(selectedEmployee.id);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const createTimeOffType = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/time-off-types", {
        method: "POST",
        body: {
          name: fd.get("name"),
          description: fd.get("description") || null,
          requires_approval: fd.get("requires_approval") === "true",
        },
      });
      toast({ title: "Tipo criado", variant: "success" });
      e.currentTarget.reset();
      loadTimeOff();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const createTimeOffRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/time-off-requests", {
        method: "POST",
        body: {
          employee_id: Number(fd.get("employee_id")),
          type_id: Number(fd.get("type_id")),
          start_date: fd.get("start_date"),
          end_date: fd.get("end_date"),
          reason: fd.get("reason") || null,
        },
      });
      toast({ title: "Solicitação criado", variant: "success" });
      e.currentTarget.reset();
      loadTimeOff();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const changeRequestStatus = async (req: TimeOffRequest, action: "approve" | "reject" | "cancel") => {
    try {
      await request(`/time-off-requests/${req.id}/${action}`, { method: "PATCH" });
      toast({ title: `Solicitacao ${action}`, variant: "success" });
      loadTimeOff();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  const saveClockifyConfig = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSavingClockify(true);
    try {
      const payload = {
        api_key: (fd.get("api_key") || "").toString().trim(),
        workspace_id: (fd.get("workspace_id") || "").toString().trim(),
      };
      const cfg = await request<ClockifyConfig>("/integrations/clockify", { method: "POST", body: payload });
      setClockifyConfig(cfg);
      await loadClockifyStatus();
      toast({ title: "Clockify configurado", variant: "success" });
      e.currentTarget.reset();
    } catch (err: any) {
      toast({ title: "Erro ao salvar Clockify", description: err.message, variant: "error" });
    } finally {
      setSavingClockify(false);
    }
  };

  const runClockifySync = async (startDate: string, endDate: string) => {
    setSyncingClockify(true);
    try {
      const result = await request<ClockifySyncResult>("/integrations/clockify/sync", {
        method: "POST",
        body: { start_date: startDate, end_date: endDate },
      });
      setClockifySyncResult(result);
      setEntriesFilterStart(startDate);
      setEntriesFilterEnd(endDate);
      await loadTimeEntries(startDate, endDate);
      await loadClockifyStatus();
      toast({
        title: "Sincronizacao concluida",
        description: `${result.entries_upserted} batidas importadas.`,
        variant: "success",
      });
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar Clockify", description: err.message, variant: "error" });
    } finally {
      setSyncingClockify(false);
    }
  };

  const syncClockify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clockifyConfig.configured) {
      toast({
        title: "Clockify nao configurado",
        description: "Configure API key e workspace antes de sincronizar.",
        variant: "error",
      });
      return;
    }

    const fd = new FormData(e.currentTarget);
    const startDate = (fd.get("start_date") || "").toString().trim();
    const endDate = (fd.get("end_date") || "").toString().trim();
    await runClockifySync(startDate, endDate);
  };

  const syncInitial30Days = async () => {
    if (!clockifyConfig.configured) {
      toast({
        title: "Clockify nao configurado",
        description: "Configure API key e workspace antes de sincronizar.",
        variant: "error",
      });
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    await runClockifySync(startDate, endDate);
  };

  const refreshTimeEntries = async () => {
    await loadTimeEntries(entriesFilterStart, entriesFilterEnd);
    await loadClockifyStatus();
  };

  const formatHours = (seconds: number) => `${(seconds / 3600).toFixed(2)} h`;
  const formatSignedHours = (seconds: number) => {
    const sign = seconds > 0 ? "+" : "";
    return `${sign}${(seconds / 3600).toFixed(2)} h`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="RH"
        subtitle="Estrutura organizacional, pessoas, beneficios, folgas e batidas de ponto."
      />

      {tab === "estrutura" && (
        <div className="grid gap-4 lg:grid-cols-4">
          <Card id="form-departamentos">
            <CardHeader className="mb-3">
              <CardTitle>Departamentos</CardTitle>
              <CardDescription>Criar + listar</CardDescription>
            </CardHeader>
            <form className="space-y-2" onSubmit={createDept}>
              <Label>Nome</Label>
              <Input name="name" required />
              <Label>Código</Label>
              <Input name="code" placeholder="Opcional" />
              <Button type="submit" className="w-full">
                Criar
              </Button>
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

          <Card id="form-cargos">
            <CardHeader className="mb-3">
              <CardTitle>Cargos</CardTitle>
              <CardDescription>Vincule a um departamento</CardDescription>
            </CardHeader>
            <form className="space-y-2" onSubmit={createPosition}>
              <Label>Título</Label>
              <Input name="title" required />
              <Label>Nível</Label>
              <Input name="level" placeholder="Senior, Pleno..." />
              <Label>Departamento</Label>
              <Select name="department_id" defaultValue="">
                <option value="">(opcional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" className="w-full">
                Criar
              </Button>
            </form>
            <div className="mt-4 max-h-64 overflow-auto pr-1 text-sm">
              <Table>
                <THead>
                  <TR>
                    <TH>Título</TH>
                    <TH>Depto</TH>
                  </TR>
                </THead>
                <TBody>
                  {positions.map((p) => (
                    <TR key={p.id}>
                      <TD>{p.title}</TD>
                      <TD>{p.department_id ? deptMap[p.department_id] : "-"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>

          <Card id="form-locais">
            <CardHeader className="mb-3">
              <CardTitle>Locais</CardTitle>
              <CardDescription>Filiais, remoto, hubs</CardDescription>
            </CardHeader>
            <form className="grid grid-cols-2 gap-2" onSubmit={createLocation}>
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input name="name" required />
              </div>
              <div>
                <Label>Código</Label>
                <Input name="code" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Input name="kind" placeholder="office, remoto..." />
              </div>
              <div>
                <Label>País</Label>
                <Input name="country" />
              </div>
              <div>
                <Label>Estado</Label>
                <Input name="state" />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input name="city" />
              </div>
              <div className="col-span-2">
                <Button type="submit" className="w-full">
                  Criar
                </Button>
              </div>
            </form>
            <div className="mt-3 max-h-52 overflow-auto pr-1 text-sm space-y-1">
              {locations.map((l) => (
                <div key={l.id} className="rounded border border-border/70 px-3 py-2">
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[l.city, l.state, l.country].filter(Boolean).join(" / ") || "—"}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card id="form-times">
            <CardHeader className="mb-3">
              <CardTitle>Times</CardTitle>
              <CardDescription>Organograma leve</CardDescription>
            </CardHeader>
            <form className="space-y-2" onSubmit={createTeam}>
              <Label>Nome</Label>
              <Input name="name" required />
              <Label>Departamento</Label>
              <Select name="department_id" defaultValue="">
                <option value="">(opcional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Label>Manager</Label>
              <Select name="manager_employee_id" defaultValue="">
                <option value="">(opcional)</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
              <Label>Local</Label>
              <Select name="location_id" defaultValue="">
                <option value="">(opcional)</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" className="w-full">
                Criar
              </Button>
            </form>
            <div className="mt-4 max-h-48 overflow-auto pr-1 text-sm space-y-1">
              {teams.map((t) => (
                <div key={t.id} className="rounded border border-border/70 px-3 py-2">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground flex flex-col gap-0.5">
                    <span>Depto: {t.department_id ? deptMap[t.department_id] : "-"}</span>
                    <span>Manager: {t.manager_employee_id ? empMap[t.manager_employee_id] : "-"}</span>
                    <span>Local: {t.location_id ? locations.find((l) => l.id === t.location_id)?.name : "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "folgas" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card id="form-beneficios-catalogo">
            <CardHeader className="mb-2">
              <CardTitle>Benefícios (catálogo)</CardTitle>
              <CardDescription>Planos de saúde, VR, etc.</CardDescription>
            </CardHeader>
            <form className="grid grid-cols-2 gap-2 px-4 pb-4" onSubmit={createBenefit}>
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input name="name" required />
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Input name="provider" />
              </div>
              <div>
                <Label>Nível</Label>
                <Input name="coverage_level" />
              </div>
              <div>
                <Label>Custo (centavos)</Label>
                <Input name="cost_cents" type="number" min={0} />
              </div>
              <div className="col-span-2">
                <Button type="submit" className="w-full">
                  Adicionar
                </Button>
              </div>
            </form>
            <div className="max-h-64 overflow-auto px-4 pb-4 text-sm space-y-2">
              {benefits.map((b) => (
                <div key={b.id} className="rounded border border-border/70 px-3 py-2">
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.provider || "—"} · {formatCents(b.cost_cents)} · {b.coverage_level || "-"}
                  </div>
                </div>
              ))}
              {benefits.length === 0 && <div className="text-muted-foreground">Nenhum benefício cadastrado.</div>}
            </div>
          </Card>

          <Card id="form-tipos-folga">
            <CardHeader className="mb-2">
              <CardTitle>Tipos de folga</CardTitle>
              <CardDescription>Criar políticas (férias, atestado...)</CardDescription>
            </CardHeader>
            <form className="grid grid-cols-2 gap-2 px-4 pb-4" onSubmit={createTimeOffType}>
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input name="name" required />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea name="description" rows={2} />
              </div>
              <div>
                <Label>Aprovação?</Label>
                <Select name="requires_approval" defaultValue="true">
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </Select>
              </div>
              <div className="col-span-2">
                <Button type="submit" className="w-full">
                  Salvar
                </Button>
              </div>
            </form>
            <div className="max-h-64 overflow-auto px-4 pb-4 text-sm space-y-1">
              {timeOffTypes.map((t) => (
                <div key={t.id} className="rounded border border-border/70 px-3 py-2">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.description || "Sem descrição"} · {t.requires_approval ? "Requer aprovação" : "Auto-aprovado"}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card id="form-solicitacoes-folga" className="lg:col-span-2">
            <CardHeader className="mb-2">
              <CardTitle>Solicitações de folga/licença</CardTitle>
              <CardDescription>Criar, aprovar, rejeitar, cancelar</CardDescription>
            </CardHeader>
            <form className="grid grid-cols-5 gap-3 px-4 pb-4" onSubmit={createTimeOffRequest}>
              <div>
                <Label>Colaborador</Label>
                <Select name="employee_id" defaultValue="" required>
                  <option value="" disabled>
                    Selecione
                  </option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select name="type_id" defaultValue="" required>
                  <option value="" disabled>
                    Selecione
                  </option>
                  {timeOffTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Início</Label>
                <Input name="start_date" type="date" required />
              </div>
              <div>
                <Label>Fim</Label>
                <Input name="end_date" type="date" required />
              </div>
              <div className="col-span-2">
                <Label>Motivo</Label>
                <Textarea name="reason" rows={1} />
              </div>
              <div className="col-span-5">
                <Button type="submit">Criar solicitação</Button>
              </div>
            </form>

            <div className="overflow-auto px-4 pb-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Colaborador</TH>
                    <TH>Tipo</TH>
                    <TH>Período</TH>
                    <TH>Status</TH>
                    <TH>Ações</TH>
                  </TR>
                </THead>
                <TBody>
                  {timeOffRequests.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <div className="font-semibold">{empMap[r.employee_id] || `#${r.employee_id}`}</div>
                        <div className="text-xs text-muted-foreground">{r.reason}</div>
                      </TD>
                      <TD>{timeOffTypes.find((t) => t.id === r.type_id)?.name || `#${r.type_id}`}</TD>
                      <TD>
                        {formatDate(r.start_date)} → {formatDate(r.end_date)}
                      </TD>
                      <TD>
                        <Badge variant={requestColors[r.status] || "default"}>{r.status}</Badge>
                      </TD>
                      <TD className="space-x-1">
                        {r.status === "pending" && (
                          <>
                            <Button size="xs" variant="outline" onClick={() => changeRequestStatus(r, "approve")}>
                              Aprovar
                            </Button>
                            <Button size="xs" variant="outline" onClick={() => changeRequestStatus(r, "reject")}>
                              Rejeitar
                            </Button>
                            <Button size="xs" variant="ghost" onClick={() => changeRequestStatus(r, "cancel")}>
                              Cancelar
                            </Button>
                          </>
                        )}
                        {r.status === "approved" && (
                          <Button size="xs" variant="ghost" onClick={() => changeRequestStatus(r, "cancel")}>
                            Cancelar
                          </Button>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {tab === "ponto" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card id="form-clockify-config">
            <CardHeader className="mb-2">
              <CardTitle>Integracao Clockify</CardTitle>
              <CardDescription>Conecte a API gratuita para importar batidas.</CardDescription>
            </CardHeader>
            <form className="space-y-3 px-4 pb-4" onSubmit={saveClockifyConfig}>
              <div>
                <Label>Workspace ID</Label>
                <Input name="workspace_id" defaultValue={clockifyConfig.workspace_id || ""} required />
              </div>
              <div>
                <Label>API Key</Label>
                <Input
                  name="api_key"
                  type="password"
                  placeholder={clockifyConfig.api_key_masked || "Cole a API key do Clockify"}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={savingClockify}>
                {savingClockify ? "Salvando..." : "Salvar integracao"}
              </Button>
            </form>
            <div className="px-4 pb-4 text-xs text-muted-foreground space-y-1">
              <div>Status: {clockifyConfig.configured ? "configurado" : "nao configurado"}</div>
              {clockifyConfig.api_key_masked && <div>API Key: {clockifyConfig.api_key_masked}</div>}
              {clockifyConfig.updated_at && <div>Atualizado em: {formatDateTime(clockifyConfig.updated_at)}</div>}
              {clockifyStatus.last_sync_at && <div>Ultima sincronizacao: {formatDateTime(clockifyStatus.last_sync_at)}</div>}
              <div>Colaboradores ativos: {clockifyStatus.active_employees}</div>
              <div>Colaboradores mapeados: {clockifyStatus.mapped_employees}</div>
              <div>Ativos sem mapeamento: {clockifyStatus.active_unmapped_employees}</div>
            </div>
          </Card>

          <Card id="form-clockify-sync">
            <CardHeader className="mb-2">
              <CardTitle>Sincronizar batidas</CardTitle>
              <CardDescription>Importe periodo e atualize o historico local.</CardDescription>
            </CardHeader>
            <form className="space-y-3 px-4 pb-4" onSubmit={syncClockify}>
              <div>
                <Label>Inicio</Label>
                <Input
                  name="start_date"
                  type="date"
                  value={entriesFilterStart}
                  onChange={(e) => setEntriesFilterStart(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  name="end_date"
                  type="date"
                  value={entriesFilterEnd}
                  onChange={(e) => setEntriesFilterEnd(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={syncingClockify || !clockifyConfig.configured}>
                {syncingClockify ? "Sincronizando..." : "Sincronizar com Clockify"}
              </Button>
              <Button type="button" className="w-full" variant="outline" onClick={syncInitial30Days} disabled={syncingClockify || !clockifyConfig.configured}>
                Carga inicial (30 dias)
              </Button>
              <Button type="button" className="w-full" variant="outline" onClick={refreshTimeEntries}>
                Recarregar historico
              </Button>
            </form>

            {clockifySyncResult && (
              <div className="space-y-1 px-4 pb-4 text-xs text-muted-foreground">
                <div>Periodo: {clockifySyncResult.range_start} ate {clockifySyncResult.range_end}</div>
                <div>Usuarios no workspace: {clockifySyncResult.users_found}</div>
                <div>Colaboradores mapeados: {clockifySyncResult.employees_mapped}</div>
                <div>Batidas processadas: {clockifySyncResult.entries_processed}</div>
                <div>Batidas gravadas: {clockifySyncResult.entries_upserted}</div>
              </div>
            )}

            {clockifyStatus.active_unmapped_employees > 0 && (
              <div className="px-4 pb-4 text-xs text-amber-200 space-y-1">
                <div className="font-semibold">Atencao: colaboradores sem mapeamento</div>
                {clockifyStatus.unmapped_employees_preview.slice(0, 5).map((item) => (
                  <div key={item.employee_id}>
                    #{item.employee_id} {item.name} {item.email ? `(${item.email})` : "(sem email)"}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card id="form-clockify-entries" className="xl:col-span-3">
            <CardHeader className="mb-2">
              <CardTitle>Historico de batidas</CardTitle>
              <CardDescription>Leitura local do que foi sincronizado do Clockify.</CardDescription>
            </CardHeader>
            <div className="grid gap-2 px-4 pb-4 md:grid-cols-4">
              <div className="rounded border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Registros</div>
                <div className="text-lg font-semibold">{timeEntries.length}</div>
              </div>
              <div className="rounded border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Horas no periodo</div>
                <div className="text-lg font-semibold">{totalSyncedHours} h</div>
              </div>
              <div className="rounded border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Em andamento</div>
                <div className="text-lg font-semibold">{runningEntriesCount}</div>
              </div>
              <div className="rounded border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Ultimos 7 dias</div>
                <div className="text-lg font-semibold">{clockifyStatus.entries_last_7_days}</div>
              </div>
            </div>
            <div className="overflow-auto px-4 pb-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Colaborador</TH>
                    <TH>Inicio</TH>
                    <TH>Fim</TH>
                    <TH>Duracao</TH>
                    <TH>Descricao</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {timeEntries.map((entry) => (
                    <TR key={entry.id}>
                      <TD>{entry.employee_id ? empMap[entry.employee_id] || `#${entry.employee_id}` : "-"}</TD>
                      <TD>{formatDateTime(entry.start_at)}</TD>
                      <TD>{formatDateTime(entry.end_at)}</TD>
                      <TD>{formatHours(entry.duration_seconds)}</TD>
                      <TD className="max-w-[420px] truncate">{entry.description || "-"}</TD>
                      <TD>
                        <Badge variant={entry.is_running ? "warning" : "outline"}>
                          {entry.is_running ? "em andamento" : "encerrado"}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                  {timeEntries.length === 0 && (
                    <TR>
                      <TD colSpan={6} className="text-center text-sm text-muted-foreground">
                        Nenhuma batida sincronizada para o periodo selecionado.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {tab === "banco" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card id="form-banco-config">
            <CardHeader className="mb-2">
              <CardTitle>Configuracao da jornada</CardTitle>
              <CardDescription>Defina a carga diaria para calculo do banco de horas.</CardDescription>
            </CardHeader>
            <form className="space-y-3 px-4 pb-4" onSubmit={saveTimeBankSettings}>
              <div>
                <Label>Minutos por dia</Label>
                <Input
                  name="target_daily_minutes"
                  type="number"
                  min={1}
                  max={960}
                  defaultValue={timeBankSettings.target_daily_minutes}
                  required
                />
              </div>
              <div>
                <Label>Contabilizar sabado</Label>
                <Select name="include_saturday" defaultValue={timeBankSettings.include_saturday ? "1" : "0"}>
                  <option value="0">Nao</option>
                  <option value="1">Sim</option>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={savingTimeBankSettings}>
                {savingTimeBankSettings ? "Salvando..." : "Salvar configuracao"}
              </Button>
            </form>
            <div className="px-4 pb-4 text-xs text-muted-foreground">
              {timeBankSettings.updated_at
                ? `Ultima atualizacao: ${formatDateTime(timeBankSettings.updated_at)}`
                : "Usando configuracao padrao de 8h/dia."}
            </div>
          </Card>

          <Card id="form-banco-resumo" className="xl:col-span-2">
            <CardHeader className="mb-2">
              <CardTitle>Resumo do banco de horas</CardTitle>
              <CardDescription>Consolidado por colaborador no periodo selecionado.</CardDescription>
            </CardHeader>
            <form
              className="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                refreshTimeBank(timeBankStartDate, timeBankEndDate);
              }}
            >
              <div>
                <Label>Inicio</Label>
                <Input
                  type="date"
                  value={timeBankStartDate}
                  onChange={(e) => setTimeBankStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="date"
                  value={timeBankEndDate}
                  onChange={(e) => setTimeBankEndDate(e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2 flex items-end gap-2">
                <Button type="submit" className="flex-1" disabled={loadingTimeBankSummary}>
                  {loadingTimeBankSummary ? "Atualizando..." : "Atualizar resumo"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const now = new Date();
                    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
                    const start = first.toISOString().slice(0, 10);
                    const end = now.toISOString().slice(0, 10);
                    setTimeBankStartDate(start);
                    setTimeBankEndDate(end);
                    refreshTimeBank(start, end);
                  }}
                >
                  Mes atual
                </Button>
              </div>
            </form>

            <div className="grid gap-2 px-4 pb-4 md:grid-cols-4">
              <div className="rounded border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Horas trabalhadas</div>
                <div className="text-lg font-semibold">{formatHours(timeBankSummary.totals.worked_seconds || 0)}</div>
              </div>
              <div className="rounded border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Horas previstas</div>
                <div className="text-lg font-semibold">{formatHours(timeBankSummary.totals.expected_seconds || 0)}</div>
              </div>
              <div className="rounded border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Ajustes</div>
                <div className="text-lg font-semibold">{formatSignedHours(timeBankSummary.totals.adjustment_seconds || 0)}</div>
              </div>
              <div className="rounded border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Saldo do periodo</div>
                <div className={`text-lg font-semibold ${(timeBankSummary.totals.balance_seconds || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatSignedHours(timeBankSummary.totals.balance_seconds || 0)}
                </div>
              </div>
            </div>

            <div className="overflow-auto px-4 pb-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Colaborador</TH>
                    <TH>Status</TH>
                    <TH>Trabalhadas</TH>
                    <TH>Previstas</TH>
                    <TH>Ajustes</TH>
                    <TH>Saldo</TH>
                  </TR>
                </THead>
                <TBody>
                  {timeBankSummary.employees.map((item) => (
                    <TR key={item.employee_id}>
                      <TD>{item.name}</TD>
                      <TD>
                        <Badge variant={statusColors[item.status] || "outline"}>{item.status}</Badge>
                      </TD>
                      <TD>{formatHours(item.worked_seconds)}</TD>
                      <TD>{formatHours(item.expected_seconds)}</TD>
                      <TD>{formatSignedHours(item.adjustment_seconds)}</TD>
                      <TD>
                        <span className={item.balance_seconds >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {formatSignedHours(item.balance_seconds)}
                        </span>
                      </TD>
                    </TR>
                  ))}
                  {timeBankSummary.employees.length === 0 && (
                    <TR>
                      <TD colSpan={6} className="text-center text-sm text-muted-foreground">
                        Nenhum colaborador encontrado para o periodo selecionado.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
          </Card>

          <Card id="form-banco-ajustes" className="xl:col-span-2">
            <CardHeader className="mb-2">
              <CardTitle>Ajustes manuais</CardTitle>
              <CardDescription>Corrija saldo com acrescimo ou desconto em minutos.</CardDescription>
            </CardHeader>
            <form className="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-4" onSubmit={createTimeBankAdjustment}>
              <div className="md:col-span-2">
                <Label>Colaborador</Label>
                <Select name="employee_id" defaultValue="" required>
                  <option value="" disabled>
                    Selecione
                  </option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Data</Label>
                <Input name="effective_date" type="date" defaultValue={timeBankEndDate} required />
              </div>
              <div>
                <Label>Minutos (+/-)</Label>
                <Input name="minutes_delta" type="number" min={-1440} max={1440} required />
              </div>
              <div className="md:col-span-4">
                <Label>Motivo</Label>
                <Textarea name="reason" rows={2} placeholder="Ex.: ajuste validado pelo RH" />
              </div>
              <div className="md:col-span-4">
                <Button type="submit" className="w-full" disabled={savingTimeBankAdjustment}>
                  {savingTimeBankAdjustment ? "Salvando ajuste..." : "Registrar ajuste"}
                </Button>
              </div>
            </form>

            <div className="overflow-auto px-4 pb-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Data</TH>
                    <TH>Colaborador</TH>
                    <TH>Ajuste</TH>
                    <TH>Motivo</TH>
                    <TH>Criado em</TH>
                  </TR>
                </THead>
                <TBody>
                  {timeBankAdjustments.map((item) => (
                    <TR key={item.id}>
                      <TD>{formatDate(item.effective_date)}</TD>
                      <TD>{item.employee_name}</TD>
                      <TD>
                        <span className={item.seconds_delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {formatSignedHours(item.seconds_delta)}
                        </span>
                      </TD>
                      <TD className="max-w-[360px] truncate">{item.reason || "-"}</TD>
                      <TD>{formatDateTime(item.created_at)}</TD>
                    </TR>
                  ))}
                  {timeBankAdjustments.length === 0 && (
                    <TR>
                      <TD colSpan={5} className="text-center text-sm text-muted-foreground">
                        Nenhum ajuste manual no periodo.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
          </Card>

          <Card id="form-banco-fechamento">
            <CardHeader className="mb-2">
              <CardTitle>Fechamento mensal</CardTitle>
              <CardDescription>Congele periodo para auditoria e folha.</CardDescription>
            </CardHeader>
            <form className="space-y-3 px-4 pb-4" onSubmit={closeTimeBankPeriod}>
              <div>
                <Label>Inicio do periodo</Label>
                <Input name="start_date" type="date" defaultValue={timeBankStartDate} required />
              </div>
              <div>
                <Label>Fim do periodo</Label>
                <Input name="end_date" type="date" defaultValue={timeBankEndDate} required />
              </div>
              <div>
                <Label>Nota (opcional)</Label>
                <Textarea name="note" rows={2} placeholder="Ex.: Fechamento da folha de fevereiro" />
              </div>
              <Button type="submit" className="w-full" disabled={closingTimeBankPeriod}>
                {closingTimeBankPeriod ? "Fechando..." : "Fechar periodo"}
              </Button>
            </form>
          </Card>

          <Card id="form-banco-fechamentos" className="xl:col-span-3">
            <CardHeader className="mb-2">
              <CardTitle>Historico de fechamentos</CardTitle>
              <CardDescription>Ultimos periodos fechados e reabertos.</CardDescription>
            </CardHeader>
            <div className="overflow-auto px-4 pb-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Periodo</TH>
                    <TH>Status</TH>
                    <TH>Colaboradores</TH>
                    <TH>Saldo total</TH>
                    <TH>Fechado em</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {timeBankClosures.map((closure) => (
                    <TR key={closure.id}>
                      <TD>
                        {formatDate(closure.period_start)} ate {formatDate(closure.period_end)}
                      </TD>
                      <TD>
                        <Badge variant={closure.status === "closed" ? "warning" : "outline"}>
                          {closure.status === "closed" ? "fechado" : "reaberto"}
                        </Badge>
                      </TD>
                      <TD>{closure.employees_count}</TD>
                      <TD>
                        <span className={closure.total_balance_seconds >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {formatSignedHours(closure.total_balance_seconds)}
                        </span>
                      </TD>
                      <TD>{formatDateTime(closure.closed_at || closure.created_at)}</TD>
                      <TD>
                        {closure.status === "closed" && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => reopenTimeBankClosure(closure.id)}
                            disabled={reopeningClosureId === closure.id}
                          >
                            {reopeningClosureId === closure.id ? "Reabrindo..." : "Reabrir"}
                          </Button>
                        )}
                      </TD>
                    </TR>
                  ))}
                  {timeBankClosures.length === 0 && (
                    <TR>
                      <TD colSpan={6} className="text-center text-sm text-muted-foreground">
                        Nenhum fechamento registrado.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {tab === "colaboradores" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card id="form-colaborador-novo">
            <CardHeader className="mb-3">
              <CardTitle>Novo colaborador</CardTitle>
              <CardDescription>Criar e já listar</CardDescription>
            </CardHeader>
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
                <Label>Data de admissão</Label>
                <Input name="hire_date" type="date" />
              </div>
              <div>
                <Label>Salário (centavos)</Label>
                <Input name="salary_cents" type="number" min={0} />
              </div>
              <div>
                <Label>Departamento</Label>
                <Select name="department_id" defaultValue="">
                  <option value="">(opcional)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Posição</Label>
                <Select name="position_id" defaultValue="">
                  <option value="">(opcional)</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Manager</Label>
                <Select name="manager_id" defaultValue="">
                  <option value="">(opcional)</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-span-2">
                <Button type="submit" className="w-full">
                  Criar
                </Button>
              </div>
            </form>

            <div className="mt-4 max-h-[520px] overflow-auto pr-1">
              <Table>
                <THead>
                  <TR>
                    <TH>Nome</TH>
                    <TH>Status</TH>
                    <TH>Salário</TH>
                    <TH>Contratação</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {employees.map((e) => (
                    <TR key={e.id} className={selectedEmployeeId === e.id ? "bg-muted/50" : ""}>
                      <TD>
                        <div className="font-semibold">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.email}</div>
                      </TD>
                      <TD>
                        <Badge variant={statusColors[e.status] || "default"}>{e.status}</Badge>
                      </TD>
                      <TD>{formatCents(e.salary_cents)}</TD>
                      <TD>
                        <div>{formatDate(e.hire_date)}</div>
                        {e.termination_date && (
                          <div className="text-xs text-muted-foreground">Término: {formatDate(e.termination_date)}</div>
                        )}
                      </TD>
                      <TD>
                        <Button
                          size="xs"
                          variant={selectedEmployeeId === e.id ? "default" : "outline"}
                          onClick={() => setSelectedEmployeeId(e.id)}
                        >
                          Gerir
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>

          <div className="space-y-3">
            <Card id="form-colaborador-detalhes">
              <CardHeader className="mb-2">
                <CardTitle>Detalhes do colaborador</CardTitle>
                <CardDescription>Editar dados principais e status</CardDescription>
              </CardHeader>
              {selectedEmployee ? (
                <form key={selectedEmployee.id} className="grid grid-cols-2 gap-3 p-4 pt-0" onSubmit={updateEmployee}>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    Código: {selectedEmployee.employee_code} · Criado em {formatDate(selectedEmployee.created_at)}
                  </div>
                  <div className="col-span-2">
                    <Label>Nome</Label>
                    <Input name="name" defaultValue={selectedEmployee.name} required />
                  </div>
                  <div className="col-span-2">
                    <Label>Email</Label>
                    <Input name="email" type="email" defaultValue={selectedEmployee.email || ""} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select name="status" defaultValue={selectedEmployee.status}>
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                      <option value="terminated">terminated</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Admissão</Label>
                    <Input name="hire_date" type="date" defaultValue={selectedEmployee.hire_date || ""} />
                  </div>
                  <div>
                    <Label>Término</Label>
                    <Input name="termination_date" type="date" defaultValue={selectedEmployee.termination_date || ""} />
                  </div>
                  <div>
                    <Label>Salário (centavos)</Label>
                    <Input name="salary_cents" type="number" min={0} defaultValue={selectedEmployee.salary_cents} />
                  </div>
                  <div>
                    <Label>Departamento</Label>
                    <Select name="department_id" defaultValue={selectedEmployee.department_id || ""}>
                      <option value="">(opcional)</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Posição</Label>
                    <Select name="position_id" defaultValue={selectedEmployee.position_id || ""}>
                      <option value="">(opcional)</option>
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Manager</Label>
                    <Select name="manager_id" defaultValue={selectedEmployee.manager_id || ""}>
                      <option value="">(opcional)</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Button type="submit" className="w-full">
                      Salvar
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="p-4 text-sm text-muted-foreground">Selecione um colaborador para gerenciar.</div>
              )}
            </Card>

            {me?.role === "hr" && (
              <Card id="form-colaborador-acesso">
                <CardHeader className="mb-2">
                  <CardTitle>Acesso do colaborador</CardTitle>
                  <CardDescription>Criar login com role colaborador e vinculo automatico.</CardDescription>
                </CardHeader>
                {selectedEmployee ? (
                  <form className="grid grid-cols-2 gap-3 p-4 pt-0" onSubmit={createEmployeeAccount}>
                    <div className="col-span-2 text-xs text-muted-foreground">
                      {selectedEmployee.email
                        ? `Email do colaborador: ${selectedEmployee.email}`
                        : "Defina o email do colaborador em Dados do colaborador para criar o acesso."}
                    </div>
                    <div className="col-span-2">
                      <Label>Nome da conta (opcional)</Label>
                      <Input name="name" defaultValue={selectedEmployee.name} />
                    </div>
                    <div className="col-span-2">
                      <Label>Senha inicial (min. 8)</Label>
                      <Input name="password" type="password" minLength={8} placeholder="Digite uma senha inicial" />
                    </div>
                    <div className="col-span-2">
                      <Button type="submit" className="w-full" disabled={creatingEmployeeAccount || !selectedEmployee.email}>
                        {creatingEmployeeAccount ? "Salvando..." : "Criar/atualizar acesso"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">Selecione um colaborador.</div>
                )}
              </Card>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
              <Card id="form-colaborador-remuneracao">
                <CardHeader className="mb-2">
                  <CardTitle>Remuneração</CardTitle>
                  <CardDescription>Histórico + novo ajuste</CardDescription>
                </CardHeader>
                {selectedEmployee ? (
                  <>
                    <form className="grid grid-cols-2 gap-2 px-4 pb-4" onSubmit={createCompensation}>
                      <div>
                        <Label>Vigência</Label>
                        <Input name="effective_at" type="date" required />
                      </div>
                      <div>
                        <Label>Salário (centavos)</Label>
                        <Input name="salary_cents" type="number" min={0} required />
                      </div>
                      <div>
                        <Label>Tipo</Label>
                        <Input name="adjustment_type" placeholder="promoção, mérito..." />
                      </div>
                      <div className="col-span-2">
                        <Label>Nota</Label>
                        <Textarea name="note" rows={2} />
                      </div>
                      <div className="col-span-2">
                        <Button type="submit" className="w-full">
                          Registrar
                        </Button>
                      </div>
                    </form>
                    <div className="max-h-48 overflow-auto px-4 pb-4 text-sm">
                      <Table>
                        <THead>
                          <TR>
                            <TH>Vigência</TH>
                            <TH>Salário</TH>
                            <TH>Tipo</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {compensations.map((c) => (
                            <TR key={c.id}>
                              <TD>{formatDate(c.effective_at)}</TD>
                              <TD>{formatCents(c.salary_cents)}</TD>
                              <TD>{c.adjustment_type || "-"}</TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">Selecione um colaborador.</div>
                )}
              </Card>

              <Card id="form-colaborador-beneficios">
                <CardHeader className="mb-2">
                  <CardTitle>Benefícios</CardTitle>
                  <CardDescription>Vincular e remover</CardDescription>
                </CardHeader>
                {selectedEmployee ? (
                  <>
                    <form className="grid grid-cols-2 gap-2 px-4 pb-4" onSubmit={assignBenefit}>
                      <div className="col-span-2">
                        <Label>Benefício</Label>
                        <Select name="benefit_id" defaultValue="" required>
                          <option value="" disabled>
                            Selecione
                          </option>
                          {benefits.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label>Vigência</Label>
                        <Input name="effective_date" type="date" />
                      </div>
                      <div className="col-span-2">
                        <Button type="submit" className="w-full">
                          Vincular
                        </Button>
                      </div>
                    </form>
                    <div className="max-h-48 overflow-auto px-4 pb-4 text-sm space-y-2">
                      {employeeBenefits.length === 0 && <div className="text-muted-foreground">Nenhum benefício.</div>}
                      {employeeBenefits.map((b) => (
                        <div
                          key={`${b.benefit_id}-${b.employee_id}`}
                          className="flex items-center justify-between rounded border border-border/70 px-3 py-2"
                        >
                          <div>
                            <div className="font-semibold">{b.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {b.effective_date ? `desde ${formatDate(b.effective_date)}` : "sem data"} · {formatCents(b.cost_cents)}
                            </div>
                          </div>
                          <Button size="xs" variant="ghost" onClick={() => removeBenefit(b.benefit_id)}>
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">Selecione um colaborador.</div>
                )}
              </Card>
            </div>

            <Card id="form-colaborador-documentos">
              <CardHeader className="mb-2">
                <CardTitle>Documentos</CardTitle>
                <CardDescription>Upload via URL (S3/Blob)</CardDescription>
              </CardHeader>
              {selectedEmployee ? (
                <>
                  <form className="grid grid-cols-3 gap-3 px-4 pb-4" onSubmit={createDocument}>
                    <div>
                      <Label>Tipo</Label>
                      <Input name="doc_type" required />
                    </div>
                    <div>
                      <Label>Arquivo (nome)</Label>
                      <Input name="file_name" />
                    </div>
                    <div>
                      <Label>Expira em</Label>
                      <Input name="expires_at" type="date" />
                    </div>
                    <div className="col-span-3">
                      <Label>URL</Label>
                      <Input name="file_url" required />
                    </div>
                    <div className="col-span-3">
                      <Label>Nota</Label>
                      <Textarea name="note" rows={2} />
                    </div>
                    <div className="col-span-3">
                      <Button type="submit" className="w-full">
                        Salvar documento
                      </Button>
                    </div>
                  </form>
                  <div className="max-h-56 overflow-auto px-4 pb-4 text-sm space-y-2">
                    {employeeDocs.map((d) => (
                      <div key={d.id} className="rounded border border-border/70 px-3 py-2">
                        <div className="font-semibold">{d.doc_type}</div>
                        <div className="text-xs text-muted-foreground">{d.file_name || d.file_url}</div>
                        <div className="text-xs text-muted-foreground flex gap-2">
                          <span>Criado: {formatDate(d.created_at)}</span>
                          {d.expires_at && <span>Expira: {formatDate(d.expires_at)}</span>}
                        </div>
                      </div>
                    ))}
                    {employeeDocs.length === 0 && <div className="text-muted-foreground">Nenhum documento.</div>}
                  </div>
                </>
              ) : (
                <div className="p-4 text-sm text-muted-foreground">Selecione um colaborador.</div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
