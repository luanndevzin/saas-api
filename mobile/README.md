# Mobile (Expo) - Batida facial

1) Pré-requisitos
- Node 18+ e npm
- Expo CLI: `npm install -g expo`
- Android SDK (ou use Expo Go para testar)

2) Instalar deps
```
cd mobile
npm install
```

3) Rodar em modo dev (Expo Go)
```
npm start
```
Escaneie o QR com o app Expo Go e teste.

4) Fluxo do app
- Login: usa `/auth/login` da API. Salva JWT no SecureStore.
- FaceClock: abre câmera frontal, captura foto e chama `/face/clock` (auto abre/fecha ponto por tenant e identifica rosto pelo template).

5) Variáveis / configuração
- API base default: https://diplomatic-simplicity-production-70e0.up.railway.app/v1
- Para trocar, preencha o campo “API Base” na tela de login.

6) Build APK local (unsigned, para teste rápido)
```
npm run android
```

7) Produção (EAS)
- Configure expo-cli/eas.json e rode `eas build -p android --profile production`.

Arquivos principais:
- `mobile/src/App.tsx`: navegação (Login -> FaceClock)
- `mobile/src/screens/LoginScreen.tsx`: login e base URL
- `mobile/src/screens/FaceClockScreen.tsx`: câmera + /face/clock
- `mobile/src/lib/api.ts`: cliente HTTP com armazenamento seguro do token

Observação: para identificação automática, certifique-se de ter templates salvos (via painel web ou pelo app ao registrar face + bater ponto). Caso o template não exista, o backend responde 404; registre face primeiro pelo web.
