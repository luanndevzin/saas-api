import { FormEvent } from "react";
import { Benefit, Employee, TimeOffRequest, TimeOffType } from "../../lib/api";
import { formatCents, formatDate } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";

const requestColors: Record<string, "default" | "success" | "warning" | "outline"> = {
  pending: "warning",
  approved: "success",
  rejected: "outline",
  canceled: "outline",
};

type TimeOffTabProps = {
  benefits: Benefit[];
  timeOffTypes: TimeOffType[];
  employees: Employee[];
  timeOffRequests: TimeOffRequest[];
  empMap: Record<number, string>;
  onCreateBenefit: (e: FormEvent<HTMLFormElement>) => void;
  onCreateTimeOffType: (e: FormEvent<HTMLFormElement>) => void;
  onCreateTimeOffRequest: (e: FormEvent<HTMLFormElement>) => void;
  onChangeRequestStatus: (req: TimeOffRequest, action: "approve" | "reject" | "cancel") => void;
};

export function TimeOffTab({
  benefits,
  timeOffTypes,
  employees,
  timeOffRequests,
  empMap,
  onCreateBenefit,
  onCreateTimeOffType,
  onCreateTimeOffRequest,
  onChangeRequestStatus,
}: TimeOffTabProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card id="form-beneficios-catalogo">
        <CardHeader className="mb-2">
          <CardTitle>BenefÃ­cios (catÃ¡logo)</CardTitle>
          <CardDescription>Planos de saÃºde, VR, etc.</CardDescription>
        </CardHeader>
        <form className="grid grid-cols-2 gap-2 px-4 pb-4" onSubmit={onCreateBenefit}>
          <div className="col-span-2">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Fornecedor</Label>
            <Input name="provider" />
          </div>
          <div>
            <Label>NÃ­vel</Label>
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
                {b.provider || "â€”"} Â· {formatCents(b.cost_cents)} Â· {b.coverage_level || "-"}
              </div>
            </div>
          ))}
          {benefits.length === 0 && <div className="text-muted-foreground">Nenhum benefÃ­cio cadastrado.</div>}
        </div>
      </Card>

      <Card id="form-tipos-folga">
        <CardHeader className="mb-2">
          <CardTitle>Tipos de folga</CardTitle>
          <CardDescription>Criar polÃ­ticas (fÃ©rias, atestado...)</CardDescription>
        </CardHeader>
        <form className="grid grid-cols-2 gap-2 px-4 pb-4" onSubmit={onCreateTimeOffType}>
          <div className="col-span-2">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div className="col-span-2">
            <Label>DescriÃ§Ã£o</Label>
            <Textarea name="description" rows={2} />
          </div>
          <div>
            <Label>AprovaÃ§Ã£o?</Label>
            <Select name="requires_approval" defaultValue="true">
              <option value="true">Sim</option>
              <option value="false">NÃ£o</option>
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
                {t.description || "Sem descriÃ§Ã£o"} Â· {t.requires_approval ? "Requer aprovaÃ§Ã£o" : "Auto-aprovado"}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card id="form-solicitacoes-folga" className="lg:col-span-2">
        <CardHeader className="mb-2">
          <CardTitle>SolicitaÃ§Ãµes de folga/licenÃ§a</CardTitle>
          <CardDescription>Criar, aprovar, rejeitar, cancelar</CardDescription>
        </CardHeader>
        <form className="grid grid-cols-5 gap-3 px-4 pb-4" onSubmit={onCreateTimeOffRequest}>
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
            <Label>InÃ­cio</Label>
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
            <Button type="submit">Criar solicitaÃ§Ã£o</Button>
          </div>
        </form>

        <div className="overflow-auto px-4 pb-4">
          <Table>
            <THead>
              <TR>
                <TH>Colaborador</TH>
                <TH>Tipo</TH>
                <TH>PerÃ­odo</TH>
                <TH>Status</TH>
                <TH>AÃ§Ãµes</TH>
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
                    {formatDate(r.start_date)} â†’ {formatDate(r.end_date)}
                  </TD>
                  <TD>
                    <Badge variant={requestColors[r.status] || "default"}>{r.status}</Badge>
                  </TD>
                  <TD className="space-x-1">
                    {r.status === "pending" && (
                      <>
                        <Button size="xs" variant="outline" onClick={() => onChangeRequestStatus(r, "approve")}>
                          Aprovar
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => onChangeRequestStatus(r, "reject")}>
                          Rejeitar
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => onChangeRequestStatus(r, "cancel")}>
                          Cancelar
                        </Button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <Button size="xs" variant="ghost" onClick={() => onChangeRequestStatus(r, "cancel")}>
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
  );
}
