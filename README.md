# 🔐 KRIPROT RELAY SERVER - PROPRIETARY

```
═══════════════════════════════════════════════════════════════════════
⚠️  CONFIDENTIAL - TRADE SECRET - PROPRIETARY CODE
═══════════════════════════════════════════════════════════════════════
© 2025 KRIPROT. ALL RIGHTS RESERVED.

This repository contains PROTECTED INTELLECTUAL PROPERTY.
Unauthorized access, use, copying, or distribution is STRICTLY PROHIBITED.

KRIPROT-WATERMARK: EMBEDDED IN ALL FILES
PROTECTION: Military-grade anti-theft, anti-AI-training
OWNER: KRIPROT (exclusive rights holder)

Violations prosecuted under international trade secret laws.
Contact: legal@kriprot.com (authorized inquiries ONLY)
═══════════════════════════════════════════════════════════════════════
```

## 🎯 Що це? (For Authorized Personnel ONLY)

**Zero-Knowledge WebSocket server** для KRIMASS Messenger.

### ⚠️ КРИТИЧНО: Zero-Knowledge Architecture

Сервер:
- ✅ **НЕ декриптує** повідомлення (математично неможливо)
- ✅ Тільки передає зашифровані дані між користувачами
- ✅ Не зберігає контент (In-Memory тільки)
- ✅ S=34 harmony validation (KRIPROT proprietary)

## 🚀 Deployment (KRIPROT Authorized Only)

### Render.com (Recommended)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
node dist/relay-server.js
```

### Manual
```bash
npm install
npm run build
npm start
```

## 📡 API

### HTTP Endpoints
- `GET /health` - Server status
- `GET /users/online` - Online users list
- `POST /users/find` - Find user by publicKey

### WebSocket Events
- `register` - User connects
- `message:send` - Send encrypted message
- `message:receive` - Receive encrypted message
- `key:exchange` - Public key exchange
- `user:online` / `user:offline` - Presence

## 🔐 Security

**Server знає:**
- ✅ userId + publicKey (routing)
- ✅ Хто онлайн (socketId)
- ✅ S=34 checksum (public validation)

**Server НЕ знає:**
- ❌ Текст повідомлень
- ❌ Контакти
- ❌ Приватні ключі

## 📊 Tech Stack

- Node.js + Express 4.18
- Socket.IO 4.6 (WebSocket)
- TypeScript
- Zero-Knowledge Architecture

## 🌐 Live

Deployed at: https://krimass-relay-server.onrender.com

**Client:** https://krimass-messenger.vercel.app

---

**Built with КРІ-ДОСПЕХИ Protocol** | **TRON 7 PERFECT** | **TRON 13 MODULAR**
