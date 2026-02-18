import { FormEvent } from "react";
import { Benefit, Department, Employee, EmployeeBenefit, EmployeeCompensation, EmployeeDocument, Position } from "../../lib/api";
import { formatCents, formatDate } from "../../lib/utils";
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

type EmployeesTabProps = {
  meRole?: string;
  departments: Department[];
  positions: Position[];
  employees: Employee[];
  benefits: Benefit[];
  compensations: EmployeeCompensation[];
  employeeBenefits: EmployeeBenefit[];
  employeeDocs: EmployeeDocument[];
  selectedEmployeeId: number | null;
  selectedEmployee: Employee | null;
  creatingEmployeeAccount: boolean;
  onSelectedEmployeeIdChange: (id: number) => void;
  onCreateEmployee: (e: FormEvent<HTMLFormElement>) => void;
  onUpdateEmployee: (e: FormEvent<HTMLFormElement>) => void;
  onCreateEmployeeAccount: (e: FormEvent<HTMLFormElement>) => void;
  onCreateCompensation: (e: FormEvent<HTMLFormElement>) => void;
  onAssignBenefit: (e: FormEvent<HTMLFormElement>) => void;
  onRemoveBenefit: (benefitId: number) => void;
  onCreateDocument: (e: FormEvent<HTMLFormElement>) => void;
};

export function EmployeesTab({
  meRole,
  departments,
  positions,
  employees,
  benefits,
  compensations,
  employeeBenefits,
  employeeDocs,
  selectedEmployeeId,
  selectedEmployee,
  creatingEmployeeAccount,
  onSelectedEmployeeIdChange,
  onCreateEmployee,
  onUpdateEmployee,
  onCreateEmployeeAccount,
  onCreateCompensation,
  onAssignBenefit,
  onRemoveBenefit,
  onCreateDocument,
}: EmployeesTabProps) {
  return (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card id="form-colaborador-novo">
            <CardHeader className="mb-3">
              <CardTitle>Novo colaborador</CardTitle>
              <CardDescription>Criar e jÃ¡ listar</CardDescription>
            </CardHeader>
            <form className="grid grid-cols-2 gap-3" onSubmit={onCreateEmployee}>
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input name="name" required />
              </div>
              <div className="col-span-2">
                <Label>Email</Label>
                <Input name="email" type="email" />
              </div>
              <div>
                <Label>CPF</Label>
                <Input name="cpf" />
              </div>
              <div>
                <Label>CBO</Label>
                <Input name="cbo" />
              </div>
              <div>
                <Label>CTPS</Label>
                <Input name="ctps" />
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
                <Label>Data de admissÃ£o</Label>
                <Input name="hire_date" type="date" />
              </div>
              <div>
                <Label>SalÃ¡rio (centavos)</Label>
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
                <Label>PosiÃ§Ã£o</Label>
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
                    <TH>SalÃ¡rio</TH>
                    <TH>ContrataÃ§Ã£o</TH>
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
                          <div className="text-xs text-muted-foreground">TÃ©rmino: {formatDate(e.termination_date)}</div>
                        )}
                      </TD>
                      <TD>
                        <Button
                          size="xs"
                          variant={selectedEmployeeId === e.id ? "default" : "outline"}
                          onClick={() => onSelectedEmployeeIdChange(e.id)}
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
                <form key={selectedEmployee.id} className="grid grid-cols-2 gap-3 p-4 pt-0" onSubmit={onUpdateEmployee}>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    CÃ³digo: {selectedEmployee.employee_code} Â· Criado em {formatDate(selectedEmployee.created_at)}
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
                    <Label>CPF</Label>
                    <Input name="cpf" defaultValue={selectedEmployee.cpf || ""} />
                  </div>
                  <div>
                    <Label>CBO</Label>
                    <Input name="cbo" defaultValue={selectedEmployee.cbo || ""} />
                  </div>
                  <div>
                    <Label>CTPS</Label>
                    <Input name="ctps" defaultValue={selectedEmployee.ctps || ""} />
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
                    <Label>AdmissÃ£o</Label>
                    <Input name="hire_date" type="date" defaultValue={selectedEmployee.hire_date || ""} />
                  </div>
                  <div>
                    <Label>TÃ©rmino</Label>
                    <Input name="termination_date" type="date" defaultValue={selectedEmployee.termination_date || ""} />
                  </div>
                  <div>
                    <Label>SalÃ¡rio (centavos)</Label>
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
                    <Label>PosiÃ§Ã£o</Label>
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

            {meRole === "hr" && (
              <Card id="form-colaborador-acesso">
                <CardHeader className="mb-2">
                  <CardTitle>Acesso do colaborador</CardTitle>
                  <CardDescription>Criar login com role colaborador e vinculo automatico.</CardDescription>
                </CardHeader>
                {selectedEmployee ? (
                  <form className="grid grid-cols-2 gap-3 p-4 pt-0" onSubmit={onCreateEmployeeAccount}>
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
                  <CardTitle>RemuneraÃ§Ã£o</CardTitle>
                  <CardDescription>HistÃ³rico + novo ajuste</CardDescription>
                </CardHeader>
                {selectedEmployee ? (
                  <>
                    <form className="grid grid-cols-2 gap-2 px-4 pb-4" onSubmit={onCreateCompensation}>
                      <div>
                        <Label>VigÃªncia</Label>
                        <Input name="effective_at" type="date" required />
                      </div>
                      <div>
                        <Label>SalÃ¡rio (centavos)</Label>
                        <Input name="salary_cents" type="number" min={0} required />
                      </div>
                      <div>
                        <Label>Tipo</Label>
                        <Input name="adjustment_type" placeholder="promoÃ§Ã£o, mÃ©rito..." />
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
                            <TH>VigÃªncia</TH>
                            <TH>SalÃ¡rio</TH>
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
                  <CardTitle>BenefÃ­cios</CardTitle>
                  <CardDescription>Vincular e remover</CardDescription>
                </CardHeader>
                {selectedEmployee ? (
                  <>
                    <form className="grid grid-cols-2 gap-2 px-4 pb-4" onSubmit={onAssignBenefit}>
                      <div className="col-span-2">
                        <Label>BenefÃ­cio</Label>
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
                        <Label>VigÃªncia</Label>
                        <Input name="effective_date" type="date" />
                      </div>
                      <div className="col-span-2">
                        <Button type="submit" className="w-full">
                          Vincular
                        </Button>
                      </div>
                    </form>
                    <div className="max-h-48 overflow-auto px-4 pb-4 text-sm space-y-2">
                      {employeeBenefits.length === 0 && <div className="text-muted-foreground">Nenhum benefÃ­cio.</div>}
                      {employeeBenefits.map((b) => (
                        <div
                          key={`${b.benefit_id}-${b.employee_id}`}
                          className="flex items-center justify-between rounded border border-border/70 px-3 py-2"
                        >
                          <div>
                            <div className="font-semibold">{b.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {b.effective_date ? `desde ${formatDate(b.effective_date)}` : "sem data"} Â· {formatCents(b.cost_cents)}
                            </div>
                          </div>
                          <Button size="xs" variant="ghost" onClick={() => onRemoveBenefit(b.benefit_id)}>
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
                  <form className="grid grid-cols-3 gap-3 px-4 pb-4" onSubmit={onCreateDocument}>
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
  );
}

