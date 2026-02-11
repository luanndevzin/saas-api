import { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-6 px-4 py-10">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">SaaS Console</p>
          <h1 className="text-3xl font-bold">Finance + HR</h1>
          <p className="text-sm text-muted-foreground">Autentique-se para acessar o painel.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
