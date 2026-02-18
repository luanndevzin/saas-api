import { FormEvent } from "react";
import { ClockifyConfig, ClockifyStatus, ClockifySyncResult, HRTimeEntry } from "../../lib/api";
import { formatDateTime } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";

type TimeClockTabProps = {
  meRole?: string;
  clockifyConfig: ClockifyConfig;
  clockifyStatus: ClockifyStatus;
  clockifySyncResult: ClockifySyncResult | null;
  timeEntries: HRTimeEntry[];
  empMap: Record<number, string>;
  totalSyncedHours: string;
  runningEntriesCount: number;
  entriesFilterStart: string;
  entriesFilterEnd: string;
  allowClosedClockifySync: boolean;
  savingClockify: boolean;
  syncingClockify: boolean;
  onEntriesFilterStartChange: (value: string) => void;
  onEntriesFilterEndChange: (value: string) => void;
  onAllowClosedSyncChange: (allow: boolean) => void;
  onSaveClockifyConfig: (e: FormEvent<HTMLFormElement>) => void;
  onSyncClockify: (e: FormEvent<HTMLFormElement>) => void;
  onSyncInitial30Days: () => void;
  onRefreshTimeEntries: () => void;
};

const formatHours = (seconds: number) => `${(seconds / 3600).toFixed(2)} h`;

export function TimeClockTab({
  meRole,
  clockifyConfig,
  clockifyStatus,
  clockifySyncResult,
  timeEntries,
  empMap,
  totalSyncedHours,
  runningEntriesCount,
  entriesFilterStart,
  entriesFilterEnd,
  allowClosedClockifySync,
  savingClockify,
  syncingClockify,
  onEntriesFilterStartChange,
  onEntriesFilterEndChange,
  onAllowClosedSyncChange,
  onSaveClockifyConfig,
  onSyncClockify,
  onSyncInitial30Days,
  onRefreshTimeEntries,
}: TimeClockTabProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card id="form-clockify-config">
        <CardHeader className="mb-2">
          <CardTitle>Integracao Clockify</CardTitle>
          <CardDescription>Conecte a API gratuita para importar batidas.</CardDescription>
        </CardHeader>
        <form className="space-y-3 px-4 pb-4" onSubmit={onSaveClockifyConfig}>
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
        <form className="space-y-3 px-4 pb-4" onSubmit={onSyncClockify}>
          <div>
            <Label>Inicio</Label>
            <Input
              name="start_date"
              type="date"
              value={entriesFilterStart}
              onChange={(e) => onEntriesFilterStartChange(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Fim</Label>
            <Input
              name="end_date"
              type="date"
              value={entriesFilterEnd}
              onChange={(e) => onEntriesFilterEndChange(e.target.value)}
              required
            />
          </div>
          {meRole === "hr" && (
            <div>
              <Label>Permitir alterar periodo fechado</Label>
              <Select value={allowClosedClockifySync ? "1" : "0"} onChange={(e) => onAllowClosedSyncChange(e.target.value === "1")}>
                <option value="0">Nao (recomendado)</option>
                <option value="1">Sim (somente excecao RH)</option>
              </Select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={syncingClockify || !clockifyConfig.configured}>
            {syncingClockify ? "Sincronizando..." : "Sincronizar com Clockify"}
          </Button>
          <Button type="button" className="w-full" variant="outline" onClick={onSyncInitial30Days} disabled={syncingClockify || !clockifyConfig.configured}>
            Carga inicial (30 dias)
          </Button>
          <Button type="button" className="w-full" variant="outline" onClick={onRefreshTimeEntries}>
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
            <div>Batidas ignoradas por periodo fechado: {clockifySyncResult.entries_skipped_closed || 0}</div>
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
  );
}
