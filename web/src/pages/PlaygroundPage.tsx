import { FormEvent, useState } from "react";
import { useApi } from "../lib/api-provider";
import { useToast } from "../components/toast";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { PageHeader } from "../components/page-header";

export function PlaygroundPage() {
  const { request, baseUrl } = useApi();
  const { toast } = useToast();
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/me");
  const [body, setBody] = useState("{}");
  const [response, setResponse] = useState<string>("Sem resposta ainda");
  const [skipAuth, setSkipAuth] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const parsed = body.trim() ? JSON.parse(body) : undefined;
      const data = await request<any>(path, { method, body: parsed, auth: !skipAuth });
      setResponse(JSON.stringify(data, null, 2));
      toast({ title: "OK", variant: "success" });
    } catch (err: any) {
      setResponse(err.message || String(err));
      toast({ title: "Erro", description: err.message, variant: "error" });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Playground" subtitle="Teste qualquer endpoint com ou sem Authorization." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Playground</CardTitle>
            <CardDescription>{baseUrl}</CardDescription>
          </CardHeader>
          <form className="space-y-3" onSubmit={submit}>
            <div className="grid grid-cols-4 gap-2">
              <Select value={method} onChange={(e) => setMethod(e.target.value)} className="col-span-1">
                <option>GET</option><option>POST</option><option>PATCH</option><option>PUT</option><option>DELETE</option>
              </Select>
              <Input value={path} onChange={(e) => setPath(e.target.value)} className="col-span-3" />
            </div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="h-40" placeholder='{"key":"value"}' />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={skipAuth} onChange={(e) => setSkipAuth(e.target.checked)} />
              Enviar sem Authorization
            </label>
            <Button type="submit">Enviar</Button>
          </form>
        </Card>

        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Resposta</CardTitle>
          </CardHeader>
          <pre className="scrollarea h-96 overflow-auto rounded-xl border border-border/70 bg-muted/20 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">{response}</pre>
        </Card>
      </div>
    </div>
  );
}



