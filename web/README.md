# SaaS API Frontend (React + Vite + shadcn)

## Rodar local
1. Instale Node.js 18+ (https://nodejs.org) se ainda nao tiver.
2. Dentro da pasta `web`, instale deps:
   ```bash
   npm install
   ```
3. Crie um arquivo `.env` opcional com `VITE_API_URL=http://localhost:8080/v1` se quiser mudar a base da API.
4. Inicie:
   ```bash
   npm run dev
   ```
   O Vite abre em http://localhost:5173.

## Estrutura
- `src/lib/api-provider.tsx`: client + Auth context (token, /me).
- `src/components/shell.tsx`: layout com sidebar, header e health-check.
- Paginas: `pages/AuthPage`, `DashboardPage`, `HRPage`, `FinanceAPPage`, `FinanceARPage`, `MembersPage`, `PlaygroundPage`.
- UI minimalista baseada em shadcn (button, input, card, badge, table, etc.).

## Fluxo
1) Use a pagina Auth para registrar tenant ou fazer login (gera token JWT).
2) Navegue pelos modulos (Dashboard, Finance AP/AR, HR, Members) para criar/listar registros e rodar acoes.
3) Playground permite testar qualquer endpoint com o token atual ou sem auth.

