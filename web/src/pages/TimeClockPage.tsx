import { useEffect, useMemo, useState } from "react";
import { useApi } from "../lib/api-provider";
import { HRTimeEntry, MyTimeEntries } from "../lib/api";
import { useToast } from "../components/toast";
import { PageHeader } from "../components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "../components/ui/table";
import { formatDateTime } from "../lib/utils";

const defaultOverview: MyTimeEntries = {
  employee_id: 0,
  employee_name: "",
  employee_email: null,
  now_utc: "",
  today_seconds: 0,
  open_entry: null,
  entries: [],
};

export function TimeClockPage() {
  const { request } = useApi();
  const { toast } = useToast();

  const [overview, setOverview] = useState<MyTimeEntries>(defaultOverview);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await request<MyTimeEntries>("/time-entries/me?limit=50");
      setOverview(data || defaultOverview);
    } catch (err: any) {
      toast({ title: "Erro ao carregar ponto", description: err.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const runClockIn = async () => {
    setSubmitting(true);
    try {
      await request("/time-entries/clock-in", { method: "POST" });
      toast({ title: "Entrada registrada", variant: "success" });
      await loadOverview();
    } catch (err: any) {
      toast({ title: "Erro ao bater entrada", description: err.message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const runClockOut = async () => {
    setSubmitting(true);
    try {
      await request("/time-entries/clock-out", { method: "POST" });
      toast({ title: "Saida registrada", variant: "success" });
      await loadOverview();
    } catch (err: any) {
      toast({ title: "Erro ao bater saida", description: err.message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const todayHours = useMemo(() => {
    const secs = overview.today_seconds || 0;
    return (secs / 3600).toFixed(2);
  }, [overview.today_seconds]);

  const entries = overview.entries || [];
  const hasOpenEntry = !!overview.open_entry;

  const formatDuration = (entry: HRTimeEntry) => `${(entry.duration_seconds / 3600).toFixed(2)} h`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Meu Ponto"
        subtitle="Registre entrada e saida e acompanhe suas batidas."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadOverview} disabled={loading || submitting}>
              Atualizar
            </Button>
            {hasOpenEntry ? (
              <Button size="sm" onClick={runClockOut} disabled={submitting}>
                {submitting ? "Registrando..." : "Bater saida"}
              </Button>
            ) : (
              <Button size="sm" onClick={runClockIn} disabled={submitting || loading}>
                {submitting ? "Registrando..." : "Bater entrada"}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Colaborador</CardDescription>
            <CardTitle className="text-lg">{overview.employee_name || "-"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Status atual</CardDescription>
            <CardTitle className="text-lg">
              <Badge variant={hasOpenEntry ? "warning" : "success"}>{hasOpenEntry ? "Em expediente" : "Fora de expediente"}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Horas hoje</CardDescription>
            <CardTitle className="text-lg">{todayHours} h</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Ultima atualizacao (UTC)</CardDescription>
            <CardTitle className="text-lg">{formatDateTime(overview.now_utc)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {overview.open_entry && (
        <Card>
          <CardHeader>
            <CardTitle>Batida em aberto</CardTitle>
            <CardDescription>Entrada: {formatDateTime(overview.open_entry.start_at)}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historico recente</CardTitle>
          <CardDescription>Ultimas 50 batidas internas.</CardDescription>
        </CardHeader>
        <div className="overflow-auto px-4 pb-4">
          <Table>
            <THead>
              <TR>
                <TH>Entrada</TH>
                <TH>Saida</TH>
                <TH>Duracao</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {entries.map((entry) => (
                <TR key={entry.id}>
                  <TD>{formatDateTime(entry.start_at)}</TD>
                  <TD>{formatDateTime(entry.end_at)}</TD>
                  <TD>{formatDuration(entry)}</TD>
                  <TD>
                    <Badge variant={entry.is_running ? "warning" : "outline"}>
                      {entry.is_running ? "Em aberto" : "Encerrado"}
                    </Badge>
                  </TD>
                </TR>
              ))}
              {entries.length === 0 && (
                <TR>
                  <TD colSpan={4} className="text-center text-sm text-muted-foreground">
                    Nenhuma batida registrada.
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
