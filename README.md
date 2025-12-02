# 🌿 KRIMASS Relay Server

**Zero-Knowledge WebSocket server** для KRIMASS Messenger.

## 🎯 Що це?

WebSocket relay server який:
- ✅ **НЕ декриптує** повідомлення (Zero-Knowledge)
- ✅ Тільки передає зашифровані дані між користувачами
- ✅ Не зберігає контент (In-Memory тільки)
- ✅ S=34 harmony validation

## 🚀 Deployment

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
