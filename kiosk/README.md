# Kiosk de Ponto (somente clock-in/out)

Frontend ultra-simples para bater ponto usando a sua API (`/time-entries/clock-in` e `/time-entries/clock-out`).

## Como usar
1) Gere um token JWT com role `hr` ou `owner` (pode ser de um usuário técnico) na sua API.
2) Hospede o conteúdo da pasta `kiosk` como estático (Render, Vercel, S3, nginx ou `npx serve kiosk`).
3) Abra `index.html`, preencha:
   - **API Base**: ex: `https://sua-api.com/v1`
   - **Token JWT**: o token de serviço
   - (opcional) **Auto clock**: escolha `Entrada` ou `Saída` para rodar automaticamente ao ler QR.
4) Clique em **Salvar & Carregar colaboradores**.

## QR Codes
- Conteúdo aceito: apenas o número do `employee_id` ou JSON `{"employee_id":123}`.
- Ao ler, o app seleciona o colaborador. Se o modo auto estiver ativo, dispara clock-in/out.

## Segurança
- O token fica no `localStorage` do navegador; use apenas em dispositivos confiáveis ou gere um token de serviço com permissões limitadas.
- Trave o tablet em modo kiosk e, se quiser mais proteção, coloque um PIN no próprio dispositivo/sistema.

## Rodar localmente
```bash
npx serve kiosk   # ou qualquer servidor estático
```

Sem build: é tudo HTML/JS/CSS puro com `html5-qrcode` via CDN.
