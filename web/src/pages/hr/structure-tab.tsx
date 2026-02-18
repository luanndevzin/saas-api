import { FormEvent } from "react";
import { Department, Employee, Location, Position, Team } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";

type StructureTabProps = {
  departments: Department[];
  positions: Position[];
  locations: Location[];
  teams: Team[];
  employees: Employee[];
  deptMap: Record<number, string>;
  empMap: Record<number, string>;
  onCreateDepartment: (e: FormEvent<HTMLFormElement>) => void;
  onCreatePosition: (e: FormEvent<HTMLFormElement>) => void;
  onCreateLocation: (e: FormEvent<HTMLFormElement>) => void;
  onCreateTeam: (e: FormEvent<HTMLFormElement>) => void;
};

export function StructureTab({
  departments,
  positions,
  locations,
  teams,
  employees,
  deptMap,
  empMap,
  onCreateDepartment,
  onCreatePosition,
  onCreateLocation,
  onCreateTeam,
}: StructureTabProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <Card id="form-departamentos">
        <CardHeader className="mb-3">
          <CardTitle>Departamentos</CardTitle>
          <CardDescription>Criar + listar</CardDescription>
        </CardHeader>
        <form className="space-y-2" onSubmit={onCreateDepartment}>
          <Label>Nome</Label>
          <Input name="name" required />
          <Label>CÃ³digo</Label>
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
        <form className="space-y-2" onSubmit={onCreatePosition}>
          <Label>TÃ­tulo</Label>
          <Input name="title" required />
          <Label>NÃ­vel</Label>
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
                <TH>TÃ­tulo</TH>
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
        <form className="grid grid-cols-2 gap-2" onSubmit={onCreateLocation}>
          <div className="col-span-2">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>CÃ³digo</Label>
            <Input name="code" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Input name="kind" placeholder="office, remoto..." />
          </div>
          <div>
            <Label>PaÃ­s</Label>
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
                {[l.city, l.state, l.country].filter(Boolean).join(" / ") || "â€”"}
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
        <form className="space-y-2" onSubmit={onCreateTeam}>
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
  );
}
