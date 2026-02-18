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
  TimeBankClosureEmployee,
  TimeBankClosure,
  TimeBankSettings,
  TimeBankSummary,
  TimeOffRequest,
  TimeOffType,
} from "../lib/api";
import { useToast } from "../components/toast";
import { PageHeader } from "../components/page-header";
import { StructureTab } from "./hr/structure-tab";
import { TimeClockTab } from "./hr/time-clock-tab";
import { TimeOffTab } from "./hr/time-off-tab";
import { TimeBankTab } from "./hr/time-bank-tab";
import { EmployeesTab } from "./hr/employees-tab";

type Tab = "estrutura" | "colaboradores" | "folgas" | "ponto" | "banco";

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
  const { request, me, baseUrl, token } = useApi();
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
  const [closureEmployees, setClosureEmployees] = useState<TimeBankClosureEmployee[]>([]);
  const [selectedClosureId, setSelectedClosureId] = useState<number | null>(null);
  const [loadingClosureEmployees, setLoadingClosureEmployees] = useState(false);

  const tabParam = searchParams.get("secao");
  const tab: Tab = isTab(tabParam) ? tabParam : "estrutura";
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [savingClockify, setSavingClockify] = useState(false);
  const [syncingClockify, setSyncingClockify] = useState(false);
  const [allowClosedClockifySync, setAllowClosedClockifySync] = useState(false);
  const [savingTimeBankSettings, setSavingTimeBankSettings] = useState(false);
  const [loadingTimeBankSummary, setLoadingTimeBankSummary] = useState(false);
  const [savingTimeBankAdjustment, setSavingTimeBankAdjustment] = useState(false);
  const [closingTimeBankPeriod, setClosingTimeBankPeriod] = useState(false);
  const [reopeningClosureId, setReopeningClosureId] = useState<number | null>(null);
  const [exportingClosureId, setExportingClosureId] = useState<number | null>(null);
  const [reviewingAdjustmentId, setReviewingAdjustmentId] = useState<number | null>(null);
  const [reviewingAdjustmentAction, setReviewingAdjustmentAction] = useState<"approve" | "reject" | null>(null);
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
  const [timeBankAdjustmentsStatus, setTimeBankAdjustmentsStatus] = useState<string>("");

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

  const loadTimeBankAdjustments = async (
    startDate = timeBankStartDate,
    endDate = timeBankEndDate,
    status = timeBankAdjustmentsStatus,
  ) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      if (status) params.set("status", status);
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

  const refreshTimeBank = async (
    startDate = timeBankStartDate,
    endDate = timeBankEndDate,
    status = timeBankAdjustmentsStatus,
  ) => {
    await Promise.all([
      loadTimeBankSettings(),
      loadTimeBankSummary(startDate, endDate),
      loadTimeBankAdjustments(startDate, endDate, status),
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
      await loadTimeBankAdjustments(timeBankStartDate, timeBankEndDate, timeBankAdjustmentsStatus);
      await loadTimeBankClosures();
    } catch (err: any) {
      toast({ title: "Erro ao criar ajuste", description: err.message, variant: "error" });
    } finally {
      setSavingTimeBankAdjustment(false);
    }
  };

  const decideTimeBankAdjustment = async (adjustmentId: number, action: "approve" | "reject") => {
    setReviewingAdjustmentId(adjustmentId);
    setReviewingAdjustmentAction(action);
    try {
      await request(`/time-bank/adjustments/${adjustmentId}/${action}`, {
        method: "POST",
        body: {},
      });
      toast({
        title: action === "approve" ? "Ajuste aprovado" : "Ajuste rejeitado",
        variant: "success",
      });
      await loadTimeBankSummary(timeBankStartDate, timeBankEndDate);
      await loadTimeBankAdjustments(timeBankStartDate, timeBankEndDate, timeBankAdjustmentsStatus);
      await loadTimeBankClosures();
    } catch (err: any) {
      toast({
        title: action === "approve" ? "Erro ao aprovar ajuste" : "Erro ao rejeitar ajuste",
        description: err.message,
        variant: "error",
      });
    } finally {
      setReviewingAdjustmentId(null);
      setReviewingAdjustmentAction(null);
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

  const exportTimeBankClosureCardsPDF = async (closureId: number) => {
    if (!token) {
      toast({ title: "Sessao expirada", description: "Faca login novamente.", variant: "error" });
      return;
    }

    setExportingClosureId(closureId);
    try {
      const apiBase = baseUrl.replace(/\/$/, "");
      const res = await fetch(`${apiBase}/time-bank/closures/${closureId}/cards.pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error((message || "Falha ao exportar PDF").trim());
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fallbackName = `cartoes-ponto-fechamento-${closureId}.pdf`;
      const contentDisposition = res.headers.get("content-disposition") || "";
      const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
      link.href = url;
      link.download = match?.[1] || fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({ title: "PDF de cartoes exportado com sucesso", variant: "success" });
    } catch (err: any) {
      toast({ title: "Erro ao exportar PDF", description: err.message, variant: "error" });
    } finally {
      setExportingClosureId(null);
    }
  };

  const loadClosureEmployees = async (closureId: number) => {
    setLoadingClosureEmployees(true);
    setSelectedClosureId(closureId);
    try {
      const data = await request<TimeBankClosureEmployee[]>(`/time-bank/closures/${closureId}/employees`);
      setClosureEmployees(toArray(data));
    } catch (err: any) {
      toast({ title: "Erro ao carregar colaboradores do fechamento", description: err.message, variant: "error" });
    } finally {
      setLoadingClosureEmployees(false);
    }
  };

  const exportEmployeeTimeCardPDF = async (closureId: number, employeeId: number) => {
    if (!token) {
      toast({ title: "Sessao expirada", description: "Faca login novamente.", variant: "error" });
      return;
    }

    setExportingClosureId(closureId);
    try {
      const apiBase = baseUrl.replace(/\/$/, "");
      const res = await fetch(`${apiBase}/time-bank/closures/${closureId}/employees/${employeeId}/card.pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error((message || "Falha ao exportar cartao").trim());
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const contentDisposition = res.headers.get("content-disposition") || "";
      const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
      link.href = url;
      link.download = match?.[1] || `cartao-ponto-${employeeId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Cartao ponto em PDF exportado", variant: "success" });
    } catch (err: any) {
      toast({ title: "Erro ao exportar cartao ponto", description: err.message, variant: "error" });
    } finally {
      setExportingClosureId(null);
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
          cpf: fd.get("cpf") || null,
          cbo: fd.get("cbo") || null,
          ctps: fd.get("ctps") || null,
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
          cpf: fd.get("cpf") || null,
          cbo: fd.get("cbo") || null,
          ctps: fd.get("ctps") || null,
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
      toast({ title: "HistÃ³rico salvo", variant: "success" });
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
      toast({ title: "BenefÃ­cio criado", variant: "success" });
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
      toast({ title: "BenefÃ­cio vinculado", variant: "success" });
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
      toast({ title: "BenefÃ­cio removido", variant: "success" });
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
      toast({ title: "SolicitaÃ§Ã£o criado", variant: "success" });
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

  const runClockifySync = async (startDate: string, endDate: string, allowClosedPeriod = false) => {
    setSyncingClockify(true);
    try {
      const result = await request<ClockifySyncResult>("/integrations/clockify/sync", {
        method: "POST",
        body: {
          start_date: startDate,
          end_date: endDate,
          allow_closed_period: allowClosedPeriod,
        },
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
      await runClockifySync(startDate, endDate, allowClosedClockifySync);
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
    await runClockifySync(startDate, endDate, allowClosedClockifySync);
  };

  const refreshTimeEntries = async () => {
    await loadTimeEntries(entriesFilterStart, entriesFilterEnd);
    await loadClockifyStatus();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="RH"
        subtitle="Estrutura organizacional, pessoas, beneficios, folgas e batidas de ponto."
      />

      {tab === "estrutura" && (
        <StructureTab
          departments={departments}
          positions={positions}
          locations={locations}
          teams={teams}
          employees={employees}
          deptMap={deptMap}
          empMap={empMap}
          onCreateDepartment={createDept}
          onCreatePosition={createPosition}
          onCreateLocation={createLocation}
          onCreateTeam={createTeam}
        />
      )}

      {tab === "folgas" && (
        <TimeOffTab
          benefits={benefits}
          timeOffTypes={timeOffTypes}
          employees={employees}
          timeOffRequests={timeOffRequests}
          empMap={empMap}
          onCreateBenefit={createBenefit}
          onCreateTimeOffType={createTimeOffType}
          onCreateTimeOffRequest={createTimeOffRequest}
          onChangeRequestStatus={changeRequestStatus}
        />
      )}

      {tab === "ponto" && (
        <TimeClockTab
          meRole={me?.role}
          clockifyConfig={clockifyConfig}
          clockifyStatus={clockifyStatus}
          clockifySyncResult={clockifySyncResult}
          timeEntries={timeEntries}
          empMap={empMap}
          totalSyncedHours={totalSyncedHours}
          runningEntriesCount={runningEntriesCount}
          entriesFilterStart={entriesFilterStart}
          entriesFilterEnd={entriesFilterEnd}
          allowClosedClockifySync={allowClosedClockifySync}
          savingClockify={savingClockify}
          syncingClockify={syncingClockify}
          onEntriesFilterStartChange={setEntriesFilterStart}
          onEntriesFilterEndChange={setEntriesFilterEnd}
          onAllowClosedSyncChange={setAllowClosedClockifySync}
          onSaveClockifyConfig={saveClockifyConfig}
          onSyncClockify={syncClockify}
          onSyncInitial30Days={syncInitial30Days}
          onRefreshTimeEntries={refreshTimeEntries}
        />
      )}

      {tab === "banco" && (
        <TimeBankTab
          employees={employees}
          timeBankSettings={timeBankSettings}
          timeBankSummary={timeBankSummary}
          timeBankAdjustments={timeBankAdjustments}
          timeBankClosures={timeBankClosures}
          closureEmployees={closureEmployees}
          timeBankStartDate={timeBankStartDate}
          timeBankEndDate={timeBankEndDate}
          timeBankAdjustmentsStatus={timeBankAdjustmentsStatus}
          selectedClosureId={selectedClosureId}
          loadingClosureEmployees={loadingClosureEmployees}
          savingTimeBankSettings={savingTimeBankSettings}
          loadingTimeBankSummary={loadingTimeBankSummary}
          savingTimeBankAdjustment={savingTimeBankAdjustment}
          closingTimeBankPeriod={closingTimeBankPeriod}
          reopeningClosureId={reopeningClosureId}
          exportingClosureId={exportingClosureId}
          reviewingAdjustmentId={reviewingAdjustmentId}
          reviewingAdjustmentAction={reviewingAdjustmentAction}
          onTimeBankStartDateChange={setTimeBankStartDate}
          onTimeBankEndDateChange={setTimeBankEndDate}
          onTimeBankAdjustmentsStatusChange={setTimeBankAdjustmentsStatus}
          onRefreshTimeBank={refreshTimeBank}
          onSaveTimeBankSettings={saveTimeBankSettings}
          onCreateTimeBankAdjustment={createTimeBankAdjustment}
          onLoadTimeBankAdjustments={loadTimeBankAdjustments}
          onDecideTimeBankAdjustment={decideTimeBankAdjustment}
          onCloseTimeBankPeriod={closeTimeBankPeriod}
          onReopenTimeBankClosure={reopenTimeBankClosure}
          onExportTimeBankClosureCardsPDF={exportTimeBankClosureCardsPDF}
          onLoadClosureEmployees={loadClosureEmployees}
          onExportEmployeeTimeCardPDF={exportEmployeeTimeCardPDF}
        />
      )}


      {tab === "colaboradores" && (
        <EmployeesTab
          meRole={me?.role}
          departments={departments}
          positions={positions}
          employees={employees}
          benefits={benefits}
          compensations={compensations}
          employeeBenefits={employeeBenefits}
          employeeDocs={employeeDocs}
          selectedEmployeeId={selectedEmployeeId}
          selectedEmployee={selectedEmployee}
          creatingEmployeeAccount={creatingEmployeeAccount}
          onSelectedEmployeeIdChange={setSelectedEmployeeId}
          onCreateEmployee={createEmployee}
          onUpdateEmployee={updateEmployee}
          onCreateEmployeeAccount={createEmployeeAccount}
          onCreateCompensation={createCompensation}
          onAssignBenefit={assignBenefit}
          onRemoveBenefit={removeBenefit}
          onCreateDocument={createDocument}
        />
      )}
    </div>
  );
}
