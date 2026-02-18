import { FormEvent } from "react";
import { Employee, TimeBankAdjustment, TimeBankClosure, TimeBankClosureEmployee, TimeBankSettings, TimeBankSummary } from "../../lib/api";
import { formatDate, formatDateTime } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";

const statusColors: Record<string, "default" | "success" | "warning" | "outline"> = {
  active: "success",
  inactive: "outline",
  terminated: "warning",
};

const adjustmentStatusColors: Record<string, "default" | "success" | "warning" | "outline"> = {
  pending: "warning",
  approved: "success",
  rejected: "outline",
};

type TimeBankTabProps = {
  employees: Employee[];
  timeBankSettings: TimeBankSettings;
  timeBankSummary: TimeBankSummary;
  timeBankAdjustments: TimeBankAdjustment[];
  timeBankClosures: TimeBankClosure[];
  closureEmployees: TimeBankClosureEmployee[];
  timeBankStartDate: string;
  timeBankEndDate: string;
  timeBankAdjustmentsStatus: string;
  selectedClosureId: number | null;
  loadingClosureEmployees: boolean;
  savingTimeBankSettings: boolean;
  loadingTimeBankSummary: boolean;
  savingTimeBankAdjustment: boolean;
  closingTimeBankPeriod: boolean;
  reopeningClosureId: number | null;
  exportingClosureId: number | null;
  reviewingAdjustmentId: number | null;
  reviewingAdjustmentAction: "approve" | "reject" | null;
  onTimeBankStartDateChange: (value: string) => void;
  onTimeBankEndDateChange: (value: string) => void;
  onTimeBankAdjustmentsStatusChange: (value: string) => void;
  onRefreshTimeBank: (startDate: string, endDate: string) => void;
  onSaveTimeBankSettings: (e: FormEvent<HTMLFormElement>) => void;
  onCreateTimeBankAdjustment: (e: FormEvent<HTMLFormElement>) => void;
  onLoadTimeBankAdjustments: (startDate: string, endDate: string, status?: string) => void;
  onDecideTimeBankAdjustment: (adjustmentId: number, action: "approve" | "reject") => void;
  onCloseTimeBankPeriod: (e: FormEvent<HTMLFormElement>) => void;
  onReopenTimeBankClosure: (closureId: number) => void;
  onExportTimeBankClosureCardsPDF: (closureId: number) => void;
  onLoadClosureEmployees: (closureId: number) => void;
  onExportEmployeeTimeCardPDF: (closureId: number, employeeId: number) => void;
};

const formatHours = (seconds: number) => `${(seconds / 3600).toFixed(2)} h`;
const formatSignedHours = (seconds: number) => {
  const sign = seconds > 0 ? "+" : "";
  return `${sign}${(seconds / 3600).toFixed(2)} h`;
};

export function TimeBankTab({
  employees,
  timeBankSettings,
  timeBankSummary,
  timeBankAdjustments,
  timeBankClosures,
  closureEmployees,
  timeBankStartDate,
  timeBankEndDate,
  timeBankAdjustmentsStatus,
  selectedClosureId,
  loadingClosureEmployees,
  savingTimeBankSettings,
  loadingTimeBankSummary,
  savingTimeBankAdjustment,
  closingTimeBankPeriod,
  reopeningClosureId,
  exportingClosureId,
  reviewingAdjustmentId,
  reviewingAdjustmentAction,
  onTimeBankStartDateChange,
  onTimeBankEndDateChange,
  onTimeBankAdjustmentsStatusChange,
  onRefreshTimeBank,
  onSaveTimeBankSettings,
  onCreateTimeBankAdjustment,
  onLoadTimeBankAdjustments,
  onDecideTimeBankAdjustment,
  onCloseTimeBankPeriod,
  onReopenTimeBankClosure,
  onExportTimeBankClosureCardsPDF,
  onLoadClosureEmployees,
  onExportEmployeeTimeCardPDF,
}: TimeBankTabProps) {
  return (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card id="form-banco-config">
            <CardHeader className="mb-2">
              <CardTitle>Configuracao da jornada</CardTitle>
              <CardDescription>Defina a carga diaria para calculo do banco de horas.</CardDescription>
            </CardHeader>
            <form className="space-y-3 px-4 pb-4" onSubmit={onSaveTimeBankSettings}>
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
                onRefreshTimeBank(timeBankStartDate, timeBankEndDate);
              }}
            >
              <div>
                <Label>Inicio</Label>
                <Input
                  type="date"
                  value={timeBankStartDate}
                  onChange={(e) => onTimeBankStartDateChange(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="date"
                  value={timeBankEndDate}
                  onChange={(e) => onTimeBankEndDateChange(e.target.value)}
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
                    onTimeBankStartDateChange(start);
                    onTimeBankEndDateChange(end);
                    onRefreshTimeBank(start, end);
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
              <CardDescription>Ajustes entram no saldo apenas quando aprovados.</CardDescription>
            </CardHeader>
            <form className="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-4" onSubmit={onCreateTimeBankAdjustment}>
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
                  {savingTimeBankAdjustment ? "Salvando ajuste..." : "Registrar ajuste (pendente)"}
                </Button>
              </div>
            </form>

            <div className="grid grid-cols-1 gap-2 px-4 pb-4 md:grid-cols-3">
              <div>
                <Label>Status</Label>
                <Select
                  value={timeBankAdjustmentsStatus}
                  onChange={(e) => onTimeBankAdjustmentsStatusChange(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="pending">Pendentes</option>
                  <option value="approved">Aprovados</option>
                  <option value="rejected">Rejeitados</option>
                </Select>
              </div>
              <div className="md:col-span-2 flex items-end gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  variant="outline"
                  onClick={() => onLoadTimeBankAdjustments(timeBankStartDate, timeBankEndDate, timeBankAdjustmentsStatus)}
                >
                  Atualizar lista
                </Button>
              </div>
            </div>

            <div className="overflow-auto px-4 pb-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Data</TH>
                    <TH>Colaborador</TH>
                    <TH>Status</TH>
                    <TH>Ajuste</TH>
                    <TH>Motivo</TH>
                    <TH>Revisao</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {timeBankAdjustments.map((item) => (
                    <TR key={item.id}>
                      <TD>{formatDate(item.effective_date)}</TD>
                      <TD>{item.employee_name}</TD>
                      <TD>
                        <Badge variant={adjustmentStatusColors[item.status] || "outline"}>
                          {item.status}
                        </Badge>
                      </TD>
                      <TD>
                        <span className={item.seconds_delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {formatSignedHours(item.seconds_delta)}
                        </span>
                      </TD>
                      <TD className="max-w-[320px] truncate">
                        {item.reason || "-"}
                        {item.review_note ? ` Â· ${item.review_note}` : ""}
                      </TD>
                      <TD>
                        {item.reviewed_at ? formatDateTime(item.reviewed_at) : "aguardando"}
                      </TD>
                      <TD>
                        {item.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => onDecideTimeBankAdjustment(item.id, "approve")}
                              disabled={reviewingAdjustmentId === item.id}
                            >
                              {reviewingAdjustmentId === item.id && reviewingAdjustmentAction === "approve" ? "..." : "Aprovar"}
                            </Button>
                            <Button
                              size="xs"
                              variant="destructive"
                              onClick={() => onDecideTimeBankAdjustment(item.id, "reject")}
                              disabled={reviewingAdjustmentId === item.id}
                            >
                              {reviewingAdjustmentId === item.id && reviewingAdjustmentAction === "reject" ? "..." : "Rejeitar"}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                  {timeBankAdjustments.length === 0 && (
                    <TR>
                      <TD colSpan={7} className="text-center text-sm text-muted-foreground">
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
            <form className="space-y-3 px-4 pb-4" onSubmit={onCloseTimeBankPeriod}>
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
                        <div className="flex gap-2">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => onExportTimeBankClosureCardsPDF(closure.id)}
                            disabled={exportingClosureId === closure.id}
                          >
                            {exportingClosureId === closure.id ? "Exportando..." : "PDF cartoes"}
                          </Button>
                          <Button
                            size="xs"
                            variant={selectedClosureId === closure.id ? "default" : "outline"}
                            onClick={() => onLoadClosureEmployees(closure.id)}
                            disabled={loadingClosureEmployees && selectedClosureId === closure.id}
                          >
                            {loadingClosureEmployees && selectedClosureId === closure.id ? "Carregando..." : "Cartoes"}
                          </Button>
                          {closure.status === "closed" && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => onReopenTimeBankClosure(closure.id)}
                              disabled={reopeningClosureId === closure.id}
                            >
                              {reopeningClosureId === closure.id ? "Reabrindo..." : "Reabrir"}
                            </Button>
                          )}
                        </div>
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

          <Card id="form-banco-cartoes" className="xl:col-span-3">
            <CardHeader className="mb-2">
              <CardTitle>Cartao ponto por colaborador</CardTitle>
              <CardDescription>
                {selectedClosureId
                  ? `Fechamento #${selectedClosureId}: exporte o cartao individual de cada colaborador.`
                  : "Selecione um fechamento na tabela acima para carregar os cartoes."}
              </CardDescription>
            </CardHeader>
            <div className="overflow-auto px-4 pb-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Colaborador</TH>
                    <TH>Trabalhadas</TH>
                    <TH>Previstas</TH>
                    <TH>Ajustes</TH>
                    <TH>Saldo</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {closureEmployees.map((item) => (
                    <TR key={item.employee_id}>
                      <TD>{item.employee_name}</TD>
                      <TD>{formatHours(item.worked_seconds)}</TD>
                      <TD>{formatHours(item.expected_seconds)}</TD>
                      <TD>{formatSignedHours(item.adjustment_seconds)}</TD>
                      <TD>
                        <span className={item.balance_seconds >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {formatSignedHours(item.balance_seconds)}
                        </span>
                      </TD>
                      <TD>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => selectedClosureId && onExportEmployeeTimeCardPDF(selectedClosureId, item.employee_id)}
                          disabled={!selectedClosureId || exportingClosureId === selectedClosureId}
                        >
                          {exportingClosureId === selectedClosureId ? "Exportando..." : "Baixar PDF"}
                        </Button>
                      </TD>
                    </TR>
                  ))}
                  {closureEmployees.length === 0 && (
                    <TR>
                      <TD colSpan={6} className="text-center text-sm text-muted-foreground">
                        {selectedClosureId
                          ? "Nenhum colaborador encontrado para este fechamento."
                          : "Selecione um fechamento para visualizar os cartoes."}
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
          </Card>
        </div>
  );
}

