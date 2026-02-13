# Mobile (Cordova)

Shell Cordova para executar o frontend web como app mobile.

## Testar sem celular (browser)

No diretório `web`:

```bash
npm run cordova:run:browser
```

Esse comando:

1. builda o web com `base=./`;
2. copia `web/dist` para `mobile/www`;
3. abre o app Cordova no browser.

## Build Android (depois)

Prerequisitos:

- JDK 17
- Android Studio + SDK
- Variaveis `JAVA_HOME` e `ANDROID_HOME`

Comandos (em `mobile`):

```bash
npx cordova platform add android
npx cordova build android
```
