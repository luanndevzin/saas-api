import { FormEvent, useEffect, useState } from "react";
import { useApi } from "../lib/api-provider";
import { Member, UserRole } from "../lib/api";
import { useToast } from "../components/toast";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Select } from "../components/ui/select";
import { formatDate } from "../lib/utils";
import { PageHeader } from "../components/page-header";

const roleOptions: UserRole[] = ["owner", "hr", "finance"];

export function MembersPage() {
  const { request } = useApi();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);

  const load = async () => {
    try {
      const res = await request<Member[]>("/members");
      setMembers(res);
    } catch (err: any) {
      toast({ title: "Erro ao carregar membros", description: err.message, variant: "error" });
    }
  };
  useEffect(() => { load(); }, []);

  const createMember = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await request("/members", {
        method: "POST",
        body: {
          email: fd.get("email"),
          name: fd.get("name") || null,
          password: fd.get("password") || null,
          role: fd.get("role") || "finance",
        },
      });
      toast({ title: "Membro criado/atualizado", variant: "success" });
      e.currentTarget.reset();
      load();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const changeRole = async (userId: number, role: UserRole) => {
    try {
      await request(`/members/${userId}`, { method: "PATCH", body: { role } });
      toast({ title: "Role atualizada", variant: "success" });
      load();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  const remove = async (userId: number) => {
    if (!window.confirm("Remover membro?")) return;
    try {
      await request(`/members/${userId}`, { method: "DELETE" });
      toast({ title: "Membro removido", variant: "success" });
      load();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "error" }); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Membros" subtitle="Gerencie roles e acessos do tenant." />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Adicionar membro</CardTitle>
            <CardDescription>Owner only (colaborador e provisionado no RH)</CardDescription>
          </CardHeader>
          <form className="space-y-2" onSubmit={createMember}>
            <Label>Email</Label>
            <Input name="email" type="email" required />
            <Label>Nome (se novo)</Label>
            <Input name="name" />
            <Label>Senha (mín. 8 se novo)</Label>
            <Input name="password" type="password" minLength={8} />
            <Label>Role</Label>
            <Select name="role" defaultValue="finance">
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </Card>

        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Membros</CardTitle>
            <CardDescription>Lista</CardDescription>
          </CardHeader>
          <Table>
            <THead>
              <TR><TH>Email</TH><TH>Role</TH><TH>Desde</TH><TH>Acoes</TH></TR>
            </THead>
            <TBody>
              {members.map((m) => (
                <TR key={m.user_id}>
                  <TD>
                    <div className="font-semibold">{m.name || "-"}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </TD>
                  <TD>
                    <Select defaultValue={m.role} onChange={(e) => changeRole(m.user_id, e.target.value as UserRole)}>
                      {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </TD>
                  <TD className="text-xs text-muted-foreground">{formatDate(m.created_at)}</TD>
                  <TD className="space-x-2">
                    <Badge variant="outline">{m.user_id}</Badge>
                    <Button size="sm" variant="destructive" onClick={() => remove(m.user_id)}>Remover</Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}



