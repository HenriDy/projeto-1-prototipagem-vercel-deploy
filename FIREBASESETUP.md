# 🔥 GeoOpportunity AI — Configuração Firebase

## ⚠️ IMPORTANTE: Admin SDK vs Web SDK

### Você tem DOIS tipos de SDK:

| SDK | Onde usar | Seu caso |
|-----|-----------|----------|
| **Web SDK (Client)** | No navegador (index.html) | ✅ JÁ ESTÁ CONFIGURADO |
| **Admin SDK (Server)** | Em servidor Node.js | ❌ NÃO PRECISA para este projeto |

---

## 🚫 O que NÃO fazer com o Admin SDK

O arquivo JSON com `"private_key"` que você tem é o **Admin SDK (service account)**.

**NUNCA** coloque isso em:
- ❌ Arquivos `.js` que rodam no navegador
- ❌ `index.html`
- ❌ `database.js`
- ❌ Qualquer arquivo público

**Por quê?** Porque o Admin SDK tem acesso TOTAL ao seu projeto Firebase — qualquer pessoa que ver esse arquivo pode ler, deletar e modificar TODOS os dados do seu banco.

---

## ✅ O que você PRECISA fazer

O **Web SDK** (client-side) já está configurado no `database.js` com suas credenciais:

```javascript
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyDqRjRv-...",
  authDomain: "projeto-prototipagem-1.firebaseapp.com",
  projectId: "projeto-prototipagem-1",
  ...
};
```

Essas credenciais são **seguras para o navegador** — elas identificam seu projeto mas NÃO dão acesso admin. A segurança é controlada pelas **Firestore Rules**.

---

## 📋 Passos no Firebase Console

### 1. Ativar Autenticação Email/Senha

1. Acesse: https://console.firebase.google.com/project/projeto-prototipagem-1
2. Vá em **Authentication** → **Sign-in method**
3. Clique em **Email/Senha**
4. Ative o toggle **Ativar**
5. Salve

### 2. Criar banco Firestore

1. Vá em **Firestore Database**
2. Clique **Criar banco de dados**
3. Escolha **Iniciar no modo teste** (ou configure as regras abaixo)
4. Escolha a região mais próxima (ex: `southamerica-east1` para Brasil)

### 3. Configurar Regras de Segurança

Vá em **Firestore Database** → **Regras** e cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Usuários: cada um só acessa seus próprios dados
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Sub-coleção de análises
      match /analyses/{analysisId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Clique **Publicar**.

### 4. Ativar Google Maps APIs

No Google Cloud Console (https://console.cloud.google.com):
1. Ative **Maps JavaScript API**
2. Ative **Places API**
3. Sua chave já está no código: `AIzaSyBQFeX6L1PViFWUfr-EcxW6uU3CnFtTTSM`

---

## 📁 Estrutura do Projeto

```
projeto/
├── index.html      ← Interface completa (HTML + CSS + JS)
├── database.js     ← Módulo de banco de dados (Firebase + localStorage)
└── FIREBASE_SETUP.md  ← Este arquivo
```

**NÃO precisa de:**
- ❌ Pasta `server/` ou `backend/`
- ❌ Arquivo `serviceAccountKey.json`
- ❌ Node.js instalado
- ❌ `npm install`

O projeto roda direto no navegador abrindo `index.html` (ou via Live Server).

---

## 🔧 Se você QUISER usar o Admin SDK no futuro

Isso seria para criar um **backend** (servidor) que faça coisas como:
- Verificar pagamentos reais (Stripe, MercadoPago)
- Enviar emails
- Processar dados pesados
- API própria

Nesse caso, você criaria:

```
projeto/
├── index.html
├── database.js
├── server/                    ← NOVA PASTA (servidor)
│   ├── package.json
│   ├── index.js               ← Código Node.js
│   └── serviceAccountKey.json ← Admin SDK (NUNCA committar no Git!)
└── .gitignore                 ← Adicione: server/serviceAccountKey.json
```

Mas isso NÃO é necessário para o projeto atual funcionar.

---

## 🧪 Testando

1. Abra `index.html` no navegador
2. Abra o Console (F12 → Console)
3. Deve aparecer:
   ```
   [DB] ✅ Firebase inicializado com sucesso — Auth + Firestore ativos
   [DB] 📦 database.js carregado — modo: 🔥 Firebase Firestore
   ```
4. Se aparecer `modo: 💾 localStorage`, verifique:
   - Os scripts Firebase estão carregando?
   - O `apiKey` está correto?
   - Tem erro no Console?

---

## 🔒 Segurança

- As credenciais Web SDK (`apiKey`, `authDomain`, etc.) são **públicas por design** — a segurança vem das Firestore Rules
- O Admin SDK (`private_key`) é **secreto** — NUNCA exponha
- Se você já publicou o Admin SDK em algum lugar público, vá ao Google Cloud Console e **regenere a chave** imediatamente
