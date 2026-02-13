export type UserRole = "owner" | "hr" | "finance" | "member";

export interface AuthResponse {
  access_token: string;
  tenant_id: number;
  user_id: number;
  role: UserRole;
}

export interface Member {
  user_id: number;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Department {
  id: number;
  name: string;
  code?: string | null;
  created_at?: string;
}

export interface Position {
  id: number;
  title: string;
  level?: string | null;
  department_id?: number | null;
  created_at?: string;
}

export interface Employee {
  id: number;
  employee_code: string;
  name: string;
  email?: string | null;
  status: string;
  hire_date?: string | null;
  termination_date?: string | null;
  department_id?: number | null;
  position_id?: number | null;
  manager_id?: number | null;
  salary_cents: number;
  created_at?: string;
  updated_at?: string;
}

export interface CostCenter {
  id: number;
  name: string;
  code?: string | null;
}

export interface Location {
  id: number;
  name: string;
  code?: string | null;
  kind?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  created_at?: string;
}

export interface Team {
  id: number;
  name: string;
  department_id?: number | null;
  manager_employee_id?: number | null;
  location_id?: number | null;
  created_at?: string;
}

export interface Benefit {
  id: number;
  name: string;
  provider?: string | null;
  cost_cents: number;
  coverage_level?: string | null;
  created_at?: string;
}

export interface EmployeeBenefit {
  benefit_id: number;
  employee_id: number;
  effective_date?: string | null;
  name: string;
  provider?: string | null;
  coverage_level?: string | null;
  cost_cents: number;
}

export interface EmployeeDocument {
  id: number;
  employee_id: number;
  doc_type: string;
  file_name?: string | null;
  file_url: string;
  expires_at?: string | null;
  note?: string | null;
  uploaded_by?: number | null;
  created_at?: string;
}

export interface EmployeeCompensation {
  id: number;
  employee_id: number;
  effective_at: string;
  salary_cents: number;
  adjustment_type?: string | null;
  note?: string | null;
  created_at?: string;
  created_by?: number | null;
}

export interface TimeOffType {
  id: number;
  name: string;
  description?: string | null;
  requires_approval: boolean;
  created_at?: string;
}

export interface TimeOffRequest {
  id: number;
  employee_id: number;
  type_id: number;
  status: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  decision_note?: string | null;
  approver_id?: number | null;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClockifyConfig {
  configured: boolean;
  workspace_id?: string;
  api_key_masked?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClockifySyncResult {
  range_start: string;
  range_end: string;
  employees_total: number;
  users_found: number;
  employees_mapped: number;
  entries_processed: number;
  entries_upserted: number;
  running_entries: number;
  synced_at: string;
}

export interface ClockifyStatus {
  configured: boolean;
  workspace_id?: string;
  api_key_masked?: string;
  last_sync_at?: string;
  last_entry_start_at?: string;
  last_entry_end_at?: string;
  entries_total: number;
  entries_last_7_days: number;
  entries_running: number;
  active_employees: number;
  mapped_employees: number;
  active_unmapped_employees: number;
  unmapped_employees_preview: Array<{
    employee_id: number;
    name: string;
    email: string;
  }>;
}

export interface HRTimeEntry {
  id: number;
  tenant_id: number;
  employee_id?: number | null;
  source: string;
  external_entry_id: string;
  clockify_user_id: string;
  workspace_id: string;
  project_id?: string | null;
  task_id?: string | null;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  duration_seconds: number;
  is_running: boolean;
  billable: boolean;
  synced_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface Vendor {
  id: number;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface Customer {
  id: number;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface Payable {
  id: number;
  vendor_id: number;
  reference?: string | null;
  description?: string | null;
  amount_cents: number;
  currency: string;
  due_date: string;
  paid_at?: string | null;
  status: string;
  cost_center_id?: number | null;
  created_at?: string;
}

export interface Receivable {
  id: number;
  customer_id: number;
  reference?: string | null;
  description?: string | null;
  amount_cents: number;
  currency: string;
  due_date: string;
  received_at?: string | null;
  received_method?: string | null;
  status: string;
  cost_center_id?: number | null;
  created_at?: string;
}

export interface FinanceSummary {
  now_utc: string;
  net_paid_cents: number;
  open_payables_cents: number;
  open_receivables_cents: number;
  payables: {
    draft: number; draft_count: number;
    pending_approval: number; pending_approval_count: number;
    approved: number; approved_count: number;
    paid: number; paid_count: number;
    overdue_open: number; overdue_open_count: number;
  };
  receivables: {
    draft: number; draft_count: number;
    issued: number; issued_count: number;
    paid: number; paid_count: number;
    overdue_open: number; overdue_open_count: number;
  };
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, data: any) {
    super(translateApiMessage(status, data));
    this.status = status;
    this.data = data;
  }
}

function readRawMessage(data: any) {
  if (typeof data === "string") return data;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;
  return "";
}

function translateApiMessage(status: number, data: any) {
  const raw = readRawMessage(data).trim();
  const source = raw.toLowerCase();

  if (status === 401) return "Sessao expirada ou nao autorizada. Faca login novamente.";
  if (status === 403) return "Voce nao tem permissao para executar esta acao.";
  if (status === 404 && !raw) return "Recurso nao encontrado.";
  if (status >= 500 && !raw) return "Erro interno da API. Tente novamente em instantes.";

  const rules: Array<[RegExp, string]> = [
    [/failed to fetch|networkerror|network request failed/i, "Nao foi possivel conectar com a API."],
    [/db error/i, "Erro interno no banco de dados."],
    [/db read error/i, "Erro ao consultar dados no banco."],
    [/db commit error/i, "Erro ao confirmar operacao no banco."],
    [/db update error/i, "Erro ao atualizar dados no banco."],
    [/db delete error/i, "Erro ao remover dados no banco."],
    [/name is required/i, "Nome e obrigatorio."],
    [/title is required/i, "Titulo e obrigatorio."],
    [/employee not found/i, "Colaborador nao encontrado."],
    [/benefit not found/i, "Beneficio nao encontrado."],
    [/invalid employee id/i, "ID de colaborador invalido."],
    [/invalid request id/i, "ID de solicitacao invalido."],
    [/invalid benefit id/i, "ID de beneficio invalido."],
    [/must be y{4}-m{2}-d{2}|must be yyyy-mm-dd/i, "Data invalida: use o formato YYYY-MM-DD."],
    [/status must be active\\|inactive\\|terminated/i, "Status invalido. Use active, inactive ou terminated."],
    [/invalid status transition/i, "Transicao de status invalida."],
    [/clockify api key is invalid/i, "API key do Clockify invalida."],
    [/clockify workspace not found/i, "Workspace do Clockify nao encontrado."],
    [/clockify is not configured/i, "Integracao com Clockify nao configurada."],
    [/clockify rate limit exceeded/i, "Clockify no limite de requisicoes. Tente novamente em instantes."],
    [/clockify connection failed/i, "Falha ao conectar com o Clockify."],
    [/unknown field/i, "Campo nao permitido no corpo da requisicao."],
    [/invalid character|cannot unmarshal/i, "JSON invalido no corpo da requisicao."],
    [/could not create/i, "Nao foi possivel concluir a criacao. Verifique os dados enviados."],
  ];

  for (const [pattern, message] of rules) {
    if (pattern.test(source)) return message;
  }

  if (raw) return raw;
  if (status >= 500) return "Erro interno da API. Tente novamente em instantes.";
  return "Nao foi possivel concluir a requisicao.";
}

export type ApiConfig = {
  baseUrl: string;
  token?: string;
  onUnauthorized?: () => void;
};

export type ApiOptions = {
  method?: string;
  body?: any;
  auth?: boolean;
};

export async function apiFetch<T>(config: ApiConfig, path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const urlBase = config.baseUrl.replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${urlBase}/${path.replace(/^\//, "")}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth && config.token) headers["Authorization"] = `Bearer ${config.token}`;

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    if (res.status === 401 && config.onUnauthorized) config.onUnauthorized();
    throw new ApiError(res.status, data);
  }
  return data as T;
}



