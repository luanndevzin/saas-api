# Mobile (Cordova) - Ponto Colaborador

Aplicativo Cordova standalone com:

- tela de login;
- tela de bater entrada/saida;
- historico recente de batidas.

## Rodar no browser (sem celular)

No diretorio `mobile`:

```bash
npm install
npm run platform:add:browser
npm run run:browser
```

## Fluxo do app

1. Informar `API URL` (ex.: `https://seu-backend/v1`).
2. Fazer login com usuario de role `colaborador`.
3. App abre a tela de ponto para registrar entrada e saida.

## Build Android (depois)

Prerequisitos:

- JDK 17
- Android Studio + SDK
- variaveis `JAVA_HOME` e `ANDROID_HOME`

Comandos (em `mobile`):

```bash
npx cordova platform add android
npx cordova build android
```
