# 🚀 DEPLOY KRIPROT RELAY SERVER TO RENDER

## One-Click Deploy:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/HarmoniXgpt/krimass-relay-server)

---

## Manual Deploy Instructions:

1. Go to: https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Choose **"Public Git repository"**
4. Paste URL:
   ```
   https://github.com/HarmoniXgpt/krimass-relay-server
   ```
5. Click **"Connect"**
6. Settings will auto-fill from `render.yaml`:
   - Name: `krimass-relay`
   - Build: `npm install && npm run build`
   - Start: `node dist/relay-server.js`
7. Click **"Create Web Service"**

---

## After Deploy:

Server will be live at: `https://krimass-relay-XXXXX.onrender.com`

**Health check:**
```bash
curl https://YOUR-URL/health
```

**Expected response:**
```json
{
  "status": "online",
  "users": 0,
  "version": "2.0.0",
  "message": "🌿 KRIMASS Relay Server - Zero Knowledge"
}
```

---

**© 2025 KRIPROT - Proprietary Code**
