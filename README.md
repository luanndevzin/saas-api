# SaaS API - Documentacao Completa de Uso

Documentacao completa para instalar, configurar e usar todo o sistema (API, Web e Mobile), incluindo fluxos por perfil, regras de negocio e referencia de endpoints.

## 1. Visao geral

Este projeto e um SaaS multi-tenant com os modulos:

- Autenticacao e controle de membros por tenant.
- RH: estrutura, colaboradores, folgas, beneficios, documentos, ponto, Clockify e banco de horas.
- Financeiro AP (contas a pagar) e AR (contas a receber).
- Dashboard financeiro consolidado.
- App Web (React + Vite) para operacao completa.
- App Mobile (Cordova) focado em ponto do colaborador.

## 2. Perfis e permissoes

Perfis suportados:

- `owner`
- `hr`
- `finance`
- `colaborador` (legado `member` e normalizado para `colaborador`)

Matriz de acesso principal:

| Perfil | Acesso principal |
| --- | --- |
| `owner` | Tudo (RH, Financeiro, Dashboard, Members) |
| `hr` | RH completo + provisionamento de conta de colaborador |
| `finance` | Finance AP/AR + Dashboard financeiro |
| `colaborador` | Meu ponto (`/time-entries/me`, `clock-in`, `clock-out`) |

## 3. Arquitetura e stack

- Backend: Go `1.24`, Chi, sqlx, MySQL, JWT.
- Frontend Web: React + Vite + TypeScript + Mantine/Tailwind.
- Mobile: Cordova (foco em ponto).
- Migracoes: Goose com SQL embutido (`migrations/*.sql`).
- Documentacao OpenAPI: `swagger/openapi.yaml` e UI em `/swagger`.

Arquivos-chave:

- API bootstrap: `cmd/api/main.go`
- Web static server simples: `cmd/web/main.go`
- Rotas HTTP: `internal/http/server.go`
- Handlers: `internal/http/handlers/*`
- Configuracao: `internal/config/config.go`

## 4. Pre-requisitos

- Go 1.24+
- Node.js 18+
- MySQL 8+ (ou compativel)
- NPM

Opcional:

- Docker (para empacotar API)
- Android SDK/JDK (para build mobile Android)

## 5. Configuracao de ambiente

Use o arquivo `railway-env.example` como base.

Variaveis suportadas:

| Variavel | Default | Obrigatoria | Descricao |
| --- | --- | --- | --- |
| `APP_ENV` | `dev` | nao | Ambiente logico |
| `HTTP_ADDR` | `:8080` | nao | Endereco de bind da API |
| `PORT` | - | nao | Fallback (Railway/Heroku style) |
| `DB_HOST` | `127.0.0.1` | nao | Host do MySQL |
| `DB_PORT` | `3306` | nao | Porta do MySQL |
| `DB_USER` | `root` | nao | Usuario do MySQL |
| `DB_PASS` | `luan` | nao | Senha do MySQL |
| `DB_NAME` | `saas` | nao | Nome do banco |
| `JWT_SECRET` | - | sim | Segredo para assinatura JWT |
| `JWT_ISSUER` | `saas-api` | nao | Issuer do token |
| `JWT_TTL_MINUTES` | `60` | nao | TTL do token |
| `RUN_MIGRATIONS` | `true` | nao | Roda migracoes no startup |
| `CLOCKIFY_AUTO_SYNC_ENABLED` | `true` | nao | Habilita scheduler Clockify |
| `CLOCKIFY_AUTO_SYNC_HOUR_UTC` | `3` | nao | Hora UTC do scheduler (0-23) |
| `CLOCKIFY_AUTO_SYNC_LOOKBACK_DAYS` | `2` | nao | Janela em dias (1-30) |

Compatibilidade Railway/MySQL:

- Se `DB_*` nao estiver definido, o sistema tenta usar `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`.

## 6. Subindo o sistema local

### 6.1 Banco de dados

Crie o banco:

```sql
CREATE DATABASE saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 6.2 API

1. Ajuste seu `.env` na raiz (nao commitar segredos).
2. Rode:

```bash
go run ./cmd/api
```

API disponivel em:

- `http://localhost:8080/v1`
- Health: `http://localhost:8080/v1/health`
- Swagger UI: `http://localhost:8080/swagger/`

### 6.3 Frontend Web

No diretorio `web`:

```bash
npm install
npm run dev
```

Por padrao abre em `http://localhost:5173`.

Importante:

- Configure `VITE_API_URL=http://localhost:8080/v1` no `web/.env` para evitar usar URL de producao fallback.

### 6.4 Mobile (ponto colaborador)

No diretorio `mobile`:

```bash
npm install
npm run platform:add:browser
npm run run:browser
```

Depois informe a API (`.../v1`) e faca login com usuario `colaborador`.

### 6.5 Servir frontend compilado com `cmd/web`

Se quiser servir estatico sem Vite:

```bash
npm --prefix web run build
go run ./cmd/web -addr :5500 -dir web/dist
```

Abrir:

- `http://localhost:5500`

## 7. Fluxo de uso completo (por perfil)

Rotas Web principais:

- `/dashboard` (`owner`, `finance`)
- `/finance/ap` (`owner`, `finance`)
- `/finance/ar` (`owner`, `finance`)
- `/hr` (`owner`, `hr`)
- `/members` (`owner`)
- `/ponto` (`colaborador`)

## 7.1 Owner (onboarding)

1. Registrar empresa e owner em `POST /v1/auth/register`.
2. Entrar no Web e validar `Dashboard`.
3. Criar membros administrativos (`/v1/members`) para `hr` e `finance`.
4. (Opcional) Criar centros de custo para classificacao financeira.

## 7.2 RH

Ordem recomendada:

1. Estrutura: departamentos, cargos, locais, times.
2. Colaboradores: criar com dados base (`name`, `email`, `cpf`, `cbo`, `ctps`, etc).
3. Beneficios e documentos por colaborador.
4. Folgas: tipos e solicitacoes.
5. Ponto:
   - Integrar Clockify (workspace + api key) e sincronizar.
   - Ou usar batida interna do colaborador.
6. Banco de horas:
   - Definir configuracoes.
   - Revisar/decidir ajustes.
   - Fechar periodo.
   - Exportar CSV/PDF (geral ou por colaborador).
7. Provisionar conta do colaborador (`POST /v1/employees/{id}/account`).

## 7.3 Financeiro

AP (Contas a pagar):

1. Criar fornecedor.
2. Criar payable (`draft`).
3. (Opcional) Vincular centro de custo enquanto `draft`.
4. Submeter para aprovacao.
5. Aprovar ou rejeitar.
6. Marcar como pago quando `approved`.

AR (Contas a receber):

1. Criar cliente.
2. Criar receivable (`draft`).
3. (Opcional) Vincular centro de custo enquanto `draft`.
4. Emitir (`issued`).
5. Marcar recebido (`paid`) com metodo, ou cancelar.

## 7.4 Colaborador

1. Login.
2. Acessar `Meu Ponto`.
3. `clock-in` para abrir batida.
4. `clock-out` para fechar.
5. Consultar historico e horas do dia em `/v1/time-entries/me`.

## 8. Regras de negocio importantes

## 8.1 Multi-tenant

- Toda operacao e filtrada por `tenant_id` extraido do JWT.
- Usuario sem membership valida nao acessa recursos do tenant.

## 8.2 Ponto interno do colaborador

- `clock-in` exige colaborador ativo e sem batida aberta.
- `clock-out` exige batida aberta.
- Batidas em data de periodo fechado de banco de horas sao bloqueadas.

## 8.3 Status e transicoes

AP (`payables`):

- `draft -> pending_approval -> approved -> paid`
- `pending_approval -> rejected`
- `mark-paid` so quando `approved`
- Edicao (`PATCH /payables/{id}`) apenas em `draft`

AR (`receivables`):

- `draft -> issued -> paid`
- `cancel` permitido em `draft` ou `issued`
- Edicao (`PATCH /receivables/{id}`) apenas em `draft`

Folgas (`time_off_requests`):

- `pending -> approved/rejected/canceled`
- `approved -> canceled`

Banco de horas (`hr_time_bank_adjustments`):

- Ajuste nasce `pending`
- Decisao: `approved` ou `rejected`
- Nao pode decidir ajuste em data de periodo fechado

Fechamentos de banco de horas:

- Nao fecha periodo se houver ajustes pendentes no intervalo
- Nao permite sobreposicao com outro periodo `closed`
- Reabertura altera status para `reopened`

## 8.4 Members e governanca

- `owner` nao pode remover a si proprio.
- `owner` nao pode ser rebaixado se for o ultimo owner.
- Role `colaborador` nao pode ser atribuida pelo endpoint de members; e provisionada pelo RH.

## 9. Referencia de endpoints (fonte atual: `internal/http/server.go`)

Base path: `/v1`

Autenticacao:

- Bearer token em `Authorization: Bearer <JWT>`

## 9.1 Publicos

| Metodo | Rota | Descricao |
| --- | --- | --- |
| GET | `/v1/health` | Healthcheck (`{"ok":true}`) |
| POST | `/v1/auth/register` | Cria tenant + owner |
| POST | `/v1/auth/login` | Login por email/senha |

## 9.2 Autenticado (qualquer role)

| Metodo | Rota | Descricao |
| --- | --- | --- |
| GET | `/v1/me` | Dados basicos do token |
| GET | `/v1/time-entries/me` | Resumo e historico de ponto do colaborador logado |
| POST | `/v1/time-entries/clock-in` | Abre batida interna |
| POST | `/v1/time-entries/clock-out` | Fecha batida interna |

## 9.3 RH (`owner`, `hr`)

Estrutura:

- POST `/v1/departments`
- GET `/v1/departments`
- POST `/v1/positions`
- GET `/v1/positions`
- POST `/v1/locations`
- GET `/v1/locations`
- POST `/v1/teams`
- GET `/v1/teams`

Colaboradores:

- POST `/v1/employees`
- GET `/v1/employees`
- GET `/v1/employees/{id}`
- PATCH `/v1/employees/{id}`
- PATCH `/v1/employees/{id}/status`
- POST `/v1/employees/{id}/compensations`
- GET `/v1/employees/{id}/compensations`
- POST `/v1/employees/{id}/benefits`
- GET `/v1/employees/{id}/benefits`
- DELETE `/v1/employees/{id}/benefits/{benefit_id}`
- POST `/v1/employees/{id}/documents`
- GET `/v1/employees/{id}/documents`

Folgas e beneficios:

- POST `/v1/time-off-types`
- GET `/v1/time-off-types`
- POST `/v1/time-off-requests`
- GET `/v1/time-off-requests`
- PATCH `/v1/time-off-requests/{id}/approve`
- PATCH `/v1/time-off-requests/{id}/reject`
- PATCH `/v1/time-off-requests/{id}/cancel`
- POST `/v1/benefits`
- GET `/v1/benefits`

Clockify e ponto consolidado:

- GET `/v1/integrations/clockify`
- GET `/v1/integrations/clockify/status`
- POST `/v1/integrations/clockify`
- POST `/v1/integrations/clockify/sync`
- GET `/v1/time-entries`

Banco de horas:

- GET `/v1/time-bank/settings`
- PUT `/v1/time-bank/settings`
- GET `/v1/time-bank/summary`
- GET `/v1/time-bank/adjustments`
- POST `/v1/time-bank/adjustments`
- POST `/v1/time-bank/adjustments/{id}/approve`
- POST `/v1/time-bank/adjustments/{id}/reject`
- GET `/v1/time-bank/closures`
- POST `/v1/time-bank/closures/close`
- POST `/v1/time-bank/closures/{id}/reopen`
- GET `/v1/time-bank/closures/{id}/export.csv`
- GET `/v1/time-bank/closures/{id}/cards.pdf`
- GET `/v1/time-bank/closures/{id}/employees`
- GET `/v1/time-bank/closures/{id}/employees/{employee_id}/card.pdf`
- GET `/v1/time-bank/closures/{id}/employees/{employee_id}/card.csv`

## 9.4 RH-only (`hr`)

| Metodo | Rota | Descricao |
| --- | --- | --- |
| POST | `/v1/employees/{id}/account` | Cria/atualiza login do colaborador e vinculo automatico |

## 9.5 Financeiro (`owner`, `finance`)

AP:

- POST `/v1/vendors`
- GET `/v1/vendors`
- POST `/v1/payables`
- GET `/v1/payables`
- PATCH `/v1/payables/{id}`
- POST `/v1/payables/{id}/submit`
- POST `/v1/payables/{id}/approve`
- POST `/v1/payables/{id}/reject`
- POST `/v1/payables/{id}/mark-paid`
- GET `/v1/payables/{id}/events`

AR:

- POST `/v1/customers`
- GET `/v1/customers`
- POST `/v1/receivables`
- GET `/v1/receivables`
- PATCH `/v1/receivables/{id}`
- POST `/v1/receivables/{id}/issue`
- POST `/v1/receivables/{id}/cancel`
- POST `/v1/receivables/{id}/mark-received`
- GET `/v1/receivables/{id}/events`

Custos e dashboard:

- POST `/v1/cost-centers`
- GET `/v1/cost-centers`
- GET `/v1/dashboard/finance/summary`

## 9.6 Owner-only

| Metodo | Rota | Descricao |
| --- | --- | --- |
| GET | `/v1/members` | Lista membros do tenant |
| POST | `/v1/members` | Cria/atualiza membro (`owner/hr/finance`) |
| PATCH | `/v1/members/{user_id}` | Troca role |
| DELETE | `/v1/members/{user_id}` | Remove membro |

## 10. Contratos principais de payload

## 10.1 Auth

Registro:

```json
{
  "company_name": "Minha Empresa",
  "name": "Owner",
  "email": "owner@empresa.com",
  "password": "senha-com-8-ou-mais"
}
```

Login:

```json
{
  "email": "owner@empresa.com",
  "password": "senha-com-8-ou-mais"
}
```

## 10.2 Colaborador (create/update)

Campos opcionais importantes:

- `cpf`
- `cbo`
- `ctps`

Exemplo create:

```json
{
  "name": "Maria Silva",
  "email": "maria@empresa.com",
  "cpf": "12345678900",
  "cbo": "252105",
  "ctps": "1234567",
  "status": "active",
  "hire_date": "2026-02-14",
  "salary_cents": 350000,
  "department_id": 1,
  "position_id": 2,
  "manager_id": 3
}
```

## 10.3 Payable (AP)

```json
{
  "vendor_id": 1,
  "reference": "NF-1001",
  "description": "Servico mensal",
  "amount_cents": 150000,
  "currency": "BRL",
  "due_date": "2026-03-10"
}
```

## 10.4 Receivable (AR)

```json
{
  "customer_id": 1,
  "reference": "FAT-9001",
  "description": "Licenca mensal",
  "amount_cents": 250000,
  "currency": "BRL",
  "due_date": "2026-03-15"
}
```

## 10.5 Clockify

Config:

```json
{
  "api_key": "CLOCKIFY_API_KEY",
  "workspace_id": "CLOCKIFY_WORKSPACE_ID"
}
```

Sync:

```json
{
  "start_date": "2026-02-01",
  "end_date": "2026-02-14",
  "allow_closed_period": false
}
```

## 10.6 Banco de horas

Criar ajuste:

```json
{
  "employee_id": 12,
  "effective_date": "2026-02-14",
  "minutes_delta": 30,
  "reason": "Hora extra aprovada"
}
```

Fechar periodo:

```json
{
  "start_date": "2026-02-01",
  "end_date": "2026-02-14",
  "note": "Fechamento quinzena"
}
```

## 11. Exemplos de uso com cURL

Defina:

```bash
BASE_URL="http://localhost:8080/v1"
TOKEN="<JWT>"
```

Login:

```bash
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@empresa.com","password":"senha12345"}'
```

Criar colaborador:

```bash
curl -X POST "$BASE_URL/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Maria Silva",
    "email":"maria@empresa.com",
    "cpf":"12345678900",
    "cbo":"252105",
    "ctps":"1234567"
  }'
```

Criar conta de colaborador (RH):

```bash
curl -X POST "$BASE_URL/employees/12/account" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria Silva","password":"SenhaInicial@123"}'
```

Submeter e aprovar payable:

```bash
curl -X POST "$BASE_URL/payables/55/submit" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -X POST "$BASE_URL/payables/55/approve" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"message":"ok"}'
curl -X POST "$BASE_URL/payables/55/mark-paid" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"message":"pagamento realizado"}'
```

Emitir e marcar recebimento de receivable:

```bash
curl -X POST "$BASE_URL/receivables/77/issue" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -X POST "$BASE_URL/receivables/77/mark-received" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"method":"pix","message":"recebido"}'
```

## 12. Clockify e sincronizacao automatica

Fluxo:

1. Configurar `api_key` e `workspace_id`.
2. Executar sync manual por periodo.
3. Acompanhar status em `/v1/integrations/clockify/status`.

Scheduler automatico:

- Habilitado por `CLOCKIFY_AUTO_SYNC_ENABLED=true`.
- Executa diariamente na hora UTC configurada.
- Janela configurada por `CLOCKIFY_AUTO_SYNC_LOOKBACK_DAYS`.

CLI utilitaria (`cmd/importer`):

```bash
go run ./cmd/importer -action status -base-url "$BASE_URL" -token "$TOKEN"
go run ./cmd/importer -action sync -base-url "$BASE_URL" -token "$TOKEN" -last-days 30
go run ./cmd/importer -action sync -base-url "$BASE_URL" -token "$TOKEN" -start-date 2026-02-01 -end-date 2026-02-14
```

## 13. Banco de horas e exportacoes

Exportacoes disponiveis:

- Fechamento geral em CSV.
- Cartoes de ponto em PDF (todos colaboradores no fechamento).
- Cartao individual em PDF/CSV por colaborador.

Importante:

- Fechamento cria snapshot em `hr_time_bank_closure_items`.
- Reabrir nao apaga historico; muda status para `reopened`.

## 14. Auditoria

Acoes relevantes sao registradas em `audit_logs` (create/update/delete, sync, close/reopen, clock-in/out etc).

## 15. Deploy

## 15.1 API com Docker

Build:

```bash
docker build -t saas-api:latest .
```

Run:

```bash
docker run --rm -p 8080:8080 --env-file .env saas-api:latest
```

## 15.2 Web no Render

Arquivo `render.yaml` ja configura:

- build `npm install && npm run build`
- publish de `web/dist`
- rewrite SPA para `/index.html`

## 16. Testes e validacao

Backend:

```bash
go test ./...
```

Frontend:

```bash
npm --prefix web run build
```

## 17. Problemas comuns

`401 invalid token`:

- Token ausente/expirado.
- `JWT_SECRET` diferente entre emissao e validacao.

`403 forbidden`:

- Role sem permissao para a rota.

`campo nao permitido`:

- JSON com campo fora do contrato esperado.

`no tenant membership` no login:

- Usuario existe, mas nao tem membership em tenant.

`period is closed for this date`:

- Batida ou ajuste em periodo de banco de horas fechado.

`clockify is not configured`:

- Falta configurar `api_key/workspace_id` por tenant.

## 18. Referencias adicionais

- API OpenAPI: `swagger/openapi.yaml`
- Swagger UI: `/swagger/`
- Docs frontend: `web/README.md`
- Docs mobile: `mobile/README.md`
