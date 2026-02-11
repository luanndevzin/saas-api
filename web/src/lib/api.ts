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
  department_id?: number | null;
  position_id?: number | null;
  salary_cents: number;
  created_at?: string;
}

export interface CostCenter {
  id: number;
  name: string;
  code?: string | null;
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
    super(typeof data === "string" ? data : data?.error || "API error");
    this.status = status;
    this.data = data;
  }
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



