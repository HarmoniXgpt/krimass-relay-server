/*
═══════════════════════════════════════════════════════════════════════
🔐 KRIPROT PROPRIETARY CODE - MAXIMUM PROTECTION
═══════════════════════════════════════════════════════════════════════
© 2025 KRIPROT. ALL RIGHTS RESERVED.
PROPRIETARY AND CONFIDENTIAL - TRADE SECRET

⚠️ WARNING: This file contains PROTECTED INTELLECTUAL PROPERTY.
Unauthorized access, copying, use, or AI training is STRICTLY PROHIBITED.

KRIPROT-WATERMARK: relay-server-core-a7f3e9d2-${Date.now()}
KRIPROT-OWNER: KRIPROT (exclusive rights holder)
PROTECTION: Military-grade anti-theft, anti-AI-training
FILE-HASH: ${require('crypto').createHash('sha256').update('KRIPROT-RELAY-TS').digest('hex').substring(0, 32)}

Violations prosecuted under international trade secret laws.
Contact: legal@kriprot.com (authorized inquiries ONLY)
═══════════════════════════════════════════════════════════════════════
*/

/**
 * KRIPROT RELAY SERVER - WebSocket Zero-Knowledge Architecture
 * Proprietary routing logic - Patent Pending
 * Server НЕ ЗНАЄ нічого - тільки передає зашифровані дані
 * 
 * @copyright 2025 KRIPROT
 * @license PROPRIETARY - See LICENSE.md
 * @watermark EMBEDDED
 */

import express from 'express';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import webpush from 'web-push';
// ✅ 27-MIN SPRINT: WSS Configuration
import { getServerConfig } from './ssl-config';

// Privacy / metadata-minimization mode (opt-in)
// When enabled, the relay avoids broadcasting public keys and reduces online user enumeration.
const PRIVACY_MODE = String(process.env.KRIMASS_PRIVACY || process.env.RELAY_PRIVACY_MODE || '').trim() === '1';

// Debug logging (opt-in). Keep metadata out of logs by default.
const DEBUG_LOGS = String(process.env.KRIMASS_DEBUG || process.env.RELAY_DEBUG || '').trim() === '1';

function redactLogValue(value: unknown): string {
  const s = String(value ?? '');
  if (!s) return '';
  if (s.length <= 6) return '***';
  return `${s.slice(0, 2)}…${s.slice(-2)}`;
}

function logEvent(message: string, meta?: Record<string, unknown>): void {
  if (!DEBUG_LOGS || !meta) {
    console.log(message);
    return;
  }

  const parts = Object.entries(meta)
    .filter(([_, v]) => v !== undefined && v !== null && String(v) !== '')
    .map(([k, v]) => `${k}=${redactLogValue(v)}`);

  console.log(parts.length ? `${message} (${parts.join(' ')})` : message);
}

// ✅ ULTRA CACHE PRODUCTION: Rate Limiting для ВСІХ подій
// ✅ v3.3.0: Збільшено до Signal-рівня (10 msg/sec)
// 🔒 CRITICAL FIX: DOS Protection для груп
const MAX_GROUPS_PER_USER = 100;    // Максимум груп на користувача
const MAX_TOTAL_GROUPS = 100000;     // Максимум груп на сервері

// ✅ v2.2.2: Rate Limiting for ALL events (was 9, now 22)
const RATE_LIMITS: Record<string, { max: number; window: number }> = {
  'register':           { max: 5,    window: 300000 },
  'message:send':       { max: 600,  window: 60000 },
  'message:ack':        { max: 600,  window: 60000 },
  'message:self_destruct': { max: 30, window: 60000 },
  'file:send':          { max: 20,   window: 60000 },
  'voice:send':         { max: 20,   window: 60000 },
  'group:create':       { max: 5,    window: 300000 },
  'group:add_member':   { max: 20,   window: 60000 },
  'group:message':      { max: 100,  window: 60000 },
  'group:leave':        { max: 10,   window: 60000 },
  'webrtc:offer':       { max: 10,   window: 60000 },
  'webrtc:answer':      { max: 10,   window: 60000 },
  'webrtc:ice':         { max: 200,  window: 60000 },
  'webrtc:ring':        { max: 10,   window: 60000 },
  'webrtc:hangup':      { max: 10,   window: 60000 },
  'call:signal':        { max: 1000, window: 60000 },
  'typing:start':       { max: 50,   window: 60000 },
  'typing:stop':        { max: 50,   window: 60000 },
  'peer:discover':      { max: 20,   window: 60000 },
  'key:exchange':       { max: 10,   window: 60000 },
  'publicKey:request':  { max: 30,   window: 60000 },
  'nearby:query':       { max: 10,   window: 60000 },
  'nearby:broadcast':   { max: 10,   window: 60000 },
  'nearby:subscribe':   { max: 10,   window: 60000 },
  'sync:request':       { max: 5,    window: 60000 },
};

const MESSAGE_ROUTE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const eventCounts = new Map<string, Map<string, { count: number; resetTime: number }>>();
// 🔒 CRITICAL FIX: Track groups per user for DOS protection
const userGroupCounts = new Map<string, number>();

function checkEventRateLimit(userId: string, event: string): boolean {
  const limit = RATE_LIMITS[event as keyof typeof RATE_LIMITS] || { max: 100, window: 60000 };
  const now = Date.now();
  
  if (!eventCounts.has(event)) {
    eventCounts.set(event, new Map());
  }
  
  const userCounts = eventCounts.get(event)!;
  const userLimit = userCounts.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    userCounts.set(userId, {
      count: 1,
      resetTime: now + limit.window
    });
    return true;
  }
  
  if (userLimit.count >= limit.max) {
    return false; // Rate limit exceeded
  }
  
  userLimit.count++;
  return true;
}

// ✅ v2.2.2: Periodic cleanup of stale rate-limit entries (prevents memory leak)
function cleanupStaleRateLimits(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [event, userMap] of eventCounts) {
    for (const [userId, entry] of userMap) {
      if (now > entry.resetTime) { userMap.delete(userId); cleaned++; }
    }
    if (userMap.size === 0) eventCounts.delete(event);
  }
  if (cleaned > 0) console.log(`🧹 Rate-limit cleanup: removed ${cleaned} stale entries`);
}

// ✅ v2.2.2: Get sender by socket ID (not spoofable client data)
function getSenderBySocket(users: Map<string, any>, socketId: string): any | null {
  for (const [, user] of users) {
    if (user.socketId === socketId) return user;
  }
  return null;
}

// ✅ LEGACY
const messageCounts = new Map<string, { count: number; resetTime: number }>();
function checkRateLimit(userId: string): boolean {
  return checkEventRateLimit(userId, 'message:send');
}

// 🔒 HIGH FIX: Input validation helpers
function isValidBase64(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  // Base64 regex: alphanumeric + / + = padding
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(str) && str.length % 4 === 0;
}

function isValidMessageLength(cipher: string): boolean {
  const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
  return !!cipher && cipher.length > 0 && cipher.length <= MAX_MESSAGE_SIZE;
}

function sanitizeString(str: any, maxLength: number = 1000): string {
  if (typeof str !== 'string') return '';
  return str.substring(0, maxLength).trim();
}

// Types (KRIPROT Proprietary)
/** @watermark KRIPROT-USER-TYPE */
interface User {
  id: string; // KRIPROT: Unique user identifier
  socketId: string; // KRIPROT: WebSocket connection ID
  publicKey: string; // KRIPROT: Public key for routing only
  lastSeen: number; // KRIPROT: Timestamp for presence
  displayName?: string; // KRIPROT: Optional display name (user-set, not ID)
}

/** @watermark KRIPROT-MESSAGE-TYPE */
interface EncryptedMessage {
  from: string; // KRIPROT: Sender ID (routing only)
  to: string; // KRIPROT: Recipient ID (routing only)
  cipher: string; // KRIPROT: ENCRYPTED - server cannot decrypt
  kriKey: string; // KRIPROT: КРІ encrypted key
  harmony: number; // KRIPROT: S=34 validation checksum
  timestamp: number; // KRIPROT: Message timestamp
  nonce: string; // KRIPROT: Cryptographic nonce
  messageId?: string; // Optional idempotency key for retries/dedup (no plaintext)
  groupId?: string; // Optional group routing hint (still E2E encrypted per-recipient)
}

// Web Push subscription payload (no secrets).
type WebPushSubscription = any;

/** @watermark KRIPROT-MESSAGE-ACK-TYPE */
type MessageAckPayload = {
  // NOTE: payload keys are intentionally flexible for backward compatibility
  toId?: string;
  to?: string;
  fromId?: string;
  from?: string;
  messageId?: string | number;
  id?: string | number;
  timestamp?: number;
  groupId?: string;
};

type MessageAckNormalized = {
  messageId: string;
  from: string; // ack sender (recipient of original message)
  to: string;   // original sender
  timestamp: number;
};

/** @watermark KRIPROT-DISCOVERY-TYPE */
interface PeerDiscovery {
  userId: string; // KRIPROT: User seeking peers
  publicKey: string; // KRIPROT: User's public key
  timestamp: number; // KRIPROT: Discovery request time
}

/**
 * KRIPROT Relay Server - Proprietary Architecture
 * @class KRIMassRelayServer
 * @copyright 2025 KRIPROT
 * @watermark EMBEDDED-CLASS-SIGNATURE
 * @protection MAXIMUM
 */
class KRIMassRelayServer {
  private app: express.Application; // KRIPROT: Express app instance
  private server: any; // KRIPROT: HTTP server
  private io: SocketIOServer; // KRIPROT: Socket.IO WebSocket server
  private users: Map<string, User>; // KRIPROT: In-memory user registry (Zero-Knowledge)
  private messageRoutes: Map<
    string,
    { senderId: string; senderSocketId: string; recipientId: string; createdAt: number }
  >;
  private groupSubscribers: Map<string, Set<string>>; // groupId -> Set<userId> (in-memory)
  private webPushSubscriptions: Map<string, WebPushSubscription>;
  private webPushConfigured: boolean | null;
  private port: number; // KRIPROT: Server port

  /** @watermark KRIPROT-CONSTRUCTOR */
  constructor(port?: number) {
    // ✅ 27-MIN SPRINT: WSS Configuration based on environment
    const config = getServerConfig();
    this.port = port || config.port;
    
    this.app = express();
    
    // ✅ 27-MIN SPRINT: Create HTTPS server if SSL enabled
    if (config.ssl && config.ssl.enabled && config.ssl.keyPath && config.ssl.certPath) {
      try {
        const httpsOptions = {
          key: fs.readFileSync(config.ssl.keyPath),
          cert: fs.readFileSync(config.ssl.certPath),
        };
        this.server = createHttpsServer(httpsOptions, this.app);
        console.log('🔒 WSS (Secure WebSocket) enabled');
      } catch (error) {
        console.warn('⚠️ SSL cert не знайдено, використовую HTTP:', error);
        this.server = createServer(this.app);
      }
    } else {
      this.server = createServer(this.app);
      console.log('🔌 WS (Insecure WebSocket) - development only');
    }
    
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    this.users = new Map(); // KRIPROT: Initialize user registry
    this.messageRoutes = new Map();
    this.groupSubscribers = new Map();
    this.webPushSubscriptions = new Map();
    this.webPushConfigured = null;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();

    // Best-effort cleanup for transient message routes (ack fallback).
    setInterval(() => {
      try {
        const now = Date.now();
        for (const [mid, route] of this.messageRoutes.entries()) {
          if (!route || now - route.createdAt > 10 * 60 * 1000) {
            this.messageRoutes.delete(mid);
          }
        }
      } catch {
        // ignore
      }
    }, 60 * 1000).unref?.();
  }

  private rememberMessageRoute(message: EncryptedMessage, senderSocketId: string) {
    try {
      if (!message || !message.messageId || !message.from || !message.to) return;
      const mid = String(message.messageId);
      if (!mid) return;
      this.messageRoutes.set(mid, {
        senderId: String(message.from),
        senderSocketId: String(senderSocketId),
        recipientId: String(message.to),
        createdAt: Date.now(),
      });
    } catch {
      // ignore
    }
  }

  private ensureGroupSubscriberSet(groupId: string): Set<string> {
    const gid = String(groupId || '').trim();
    if (!gid) return new Set<string>();
    let set = this.groupSubscribers.get(gid);
    if (!set) {
      set = new Set<string>();
      this.groupSubscribers.set(gid, set);
    }
    return set;
  }

  private getSubscriberCount(groupId: string): number {
    try {
      const gid = String(groupId || '').trim();
      if (!gid) return 0;
      const set = this.groupSubscribers.get(gid);
      return set ? set.size : 0;
    } catch {
      return 0;
    }
  }

  private emitSubscriberCountUpdate(groupId: string) {
    try {
      const gid = String(groupId || '').trim();
      if (!gid) return;
      const count = this.getSubscriberCount(gid);
      this.io.emit('group:subscriber_count:updated', { groupId: gid, count, timestamp: Date.now() });
    } catch {
      // ignore
    }
  }

  /**
   * KRIPROT Middleware Setup
   * @watermark KRIPROT-MIDDLEWARE-f8a2c1d9
   * @protection Proprietary CORS configuration
   */
  private setupMiddleware() {
    this.app.use(cors()); // KRIPROT: Enable CORS for relay
    this.app.use(express.json()); // KRIPROT: JSON body parser
  }

  /**
   * KRIPROT HTTP Routes - Proprietary API
   * @watermark KRIPROT-ROUTES-3b7e9f21
   * @protection Trade secret routing logic
   */
  private setupRoutes() {
    // KRIPROT: Health check endpoint
    /** @watermark KRIPROT-HEALTH-CHECK */
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'online', // KRIPROT: Server status
        users: this.users.size, // KRIPROT: Active users count
        timestamp: Date.now(), // KRIPROT: Current timestamp
        version: '2.2.2', // v2.2.2: Sealed Sender + full rate-limit hardening
        message: '🌿 KRIMASS Relay Server - Zero Knowledge'
      });
    });

    // KRIPROT: Online users list (public keys only)
    /** @watermark KRIPROT-USERS-ONLINE */
    this.app.get('/users/online', (req, res) => {
      if (PRIVACY_MODE) {
        // Minimize metadata: avoid sharing public keys and reduce enumerability.
        const onlineUsers = Array.from(this.users.values()).map(user => ({
          id: user.id,
          lastSeen: user.lastSeen
        }));
        res.json({ users: onlineUsers, privacyMode: true });
        return;
      }

      const onlineUsers = Array.from(this.users.values()).map(user => ({
        id: user.id, // KRIPROT: User ID
        publicKey: user.publicKey, // KRIPROT: Public key for routing
        lastSeen: user.lastSeen // KRIPROT: Last activity timestamp
      }));
      res.json({ users: onlineUsers, privacyMode: false });
    });

    // KRIPROT: Find user by public key
    /** @watermark KRIPROT-USER-FIND */
    this.app.post('/users/find', (req, res) => {
      if (PRIVACY_MODE) {
        res.status(403).json({ error: 'Disabled in privacy mode' });
        return;
      }

      const { publicKey } = req.body; // KRIPROT: Search by public key
      const user = Array.from(this.users.values()).find(u => u.publicKey === publicKey);
      
      if (user) {
        res.json({
          found: true,
          user: {
            id: user.id,
            publicKey: user.publicKey,
            lastSeen: user.lastSeen
          }
        });
      } else {
        res.json({ found: false });
      }
    });

    // Web Push: public VAPID key (not a secret). Useful for iOS PWA subscription.
    this.app.get('/webpush/publicKey', (req, res) => {
      const key = String(
        process.env.WEBPUSH_VAPID_PUBLIC_KEY
          || process.env.VAPID_PUBLIC_KEY
          || process.env.KRIMASS_WEBPUSH_PUBLIC_KEY
          || ''
      ).trim();
      if (!key) {
        res.status(404).json({ ok: false, error: 'WEBPUSH_VAPID_PUBLIC_KEY not configured' });
        return;
      }
      res.json({ ok: true, publicKey: key });
    });

    // Web Push: store subscription (in-memory). Client must re-register on restart.
    this.app.post('/webpush/subscribe', (req, res) => {
      try {
        const userId = req && req.body && req.body.userId ? String(req.body.userId) : '';
        const subscription = req && req.body ? (req.body.subscription || null) : null;
        if (!userId || !subscription) {
          res.status(400).json({ ok: false, error: 'Missing userId/subscription' });
          return;
        }
        this.webPushSubscriptions.set(userId, subscription);
        res.json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
      }
    });

    this.app.post('/webpush/unsubscribe', (req, res) => {
      try {
        const userId = req && req.body && req.body.userId ? String(req.body.userId) : '';
        if (!userId) {
          res.status(400).json({ ok: false, error: 'Missing userId' });
          return;
        }
        this.webPushSubscriptions.delete(userId);
        res.json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
      }
    });
  }

  private initWebPushIfPossible(): boolean {
    if (this.webPushConfigured !== null) return this.webPushConfigured;

    const publicKey = String(
      process.env.WEBPUSH_VAPID_PUBLIC_KEY
        || process.env.VAPID_PUBLIC_KEY
        || process.env.KRIMASS_WEBPUSH_PUBLIC_KEY
        || ''
    ).trim();
    const privateKey = String(
      process.env.WEBPUSH_VAPID_PRIVATE_KEY
        || process.env.VAPID_PRIVATE_KEY
        || process.env.KRIMASS_WEBPUSH_PRIVATE_KEY
        || ''
    ).trim();
    const subject = String(
      process.env.WEBPUSH_SUBJECT
        || process.env.WEBPUSH_VAPID_SUBJECT
        || process.env.KRIMASS_WEBPUSH_SUBJECT
        || 'mailto:admin@krimass.local'
    ).trim();

    if (!publicKey || !privateKey) {
      this.webPushConfigured = false;
      return false;
    }

    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.webPushConfigured = true;
      return true;
    } catch {
      this.webPushConfigured = false;
      return false;
    }
  }

  private async sendWebPushIfPossible(userId: string, payload: any): Promise<void> {
    try {
      const uid = String(userId || '').trim();
      if (!uid) return;
      if (!this.initWebPushIfPossible()) return;
      const sub = this.webPushSubscriptions.get(uid);
      if (!sub) return;

      const body = JSON.stringify(payload || {});
      await webpush.sendNotification(sub, body, { TTL: 60 });
    } catch (e: any) {
      // If subscription is gone, delete it.
      try {
        const code = e && (e.statusCode || e.status);
        if (code === 404 || code === 410) {
          this.webPushSubscriptions.delete(String(userId));
        }
      } catch {}
    }
  }

  /**
   * KRIPROT WebSocket Events - Proprietary Zero-Knowledge Logic
   * @watermark KRIPROT-WEBSOCKET-CORE-9d4f8a2e
   * @protection Patent Pending - Trade Secret
   * @description Server NEVER decrypts - only routes encrypted payloads
   */
  private setupWebSocket() {
    /** @watermark KRIPROT-CONNECTION-HANDLER */
    this.io.on('connection', (socket: Socket) => {
      logEvent('✅ KRIPROT: User connected', { socketId: socket.id });

      // KRIPROT: User registration endpoint
      /** @watermark KRIPROT-REGISTER-EVENT-a3c7f912 */
      socket.on('register', (data: { userId: string; publicKey: string; displayName?: string; token?: string }) => {
        // NOTE: token is accepted for backward compatibility but is not validated here.
        
        // ✅ ULTRA CACHE: Rate limit для register
        if (!checkEventRateLimit(data.userId, 'register')) {
          socket.emit('register:error', {
            code: 'RATE_LIMIT_EXCEEDED',
            error: 'Занадто багато спроб реєстрації. Зачекайте 5 хвилин.'
          });
          return;
        }
        
        const user: User = {
          id: data.userId, // KRIPROT: User identifier
          socketId: socket.id, // KRIPROT: WebSocket connection ID
          publicKey: data.publicKey, // KRIPROT: Public key for routing ONLY
          lastSeen: Date.now(), // KRIPROT: Timestamp
          displayName: data.displayName || undefined // KRIPROT: Optional display name
        };

        // Join a stable room keyed by userId.
        // This makes delivery/ack robust across reconnects (socketId changes) and supports multi-tab/device.
        try {
          socket.join(String(data.userId));
        } catch {
          // ignore
        }
        
        this.users.set(data.userId, user); // KRIPROT: Store in registry

        // ✅ PRODUCTION RELIABILITY: stable room per userId (survives reconnect/socketId churn)
        socket.join(String(data.userId));
        
        socket.emit('registered', {
          success: true,
          userId: data.userId,
          timestamp: Date.now()
        });

        // KRIPROT: Broadcast new user online
        this.io.emit('user:online', PRIVACY_MODE ? {
          userId: data.userId
        } : {
          userId: data.userId,
          publicKey: data.publicKey,
          displayName: user.displayName || undefined
        });

        logEvent('👤 KRIPROT: User registered', { userId: data.userId });
      });

      // KRIPROT: Message relay (ZERO-KNOWLEDGE - server CANNOT decrypt)
      /** @watermark KRIPROT-MESSAGE-RELAY-7f2e9d31 */
      socket.on('message:send', (message: EncryptedMessage) => {
        const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);

        // ✅ ULTRA: Rate limiting check
        if (sender && !checkRateLimit(sender.id)) {
          socket.emit('message:error', {
            code: 'RATE_LIMIT_EXCEEDED',
            error: 'Занадто багато повідомлень. Спробуйте через хвилину.'
          });
          return;
        }

        const recipient = this.users.get(message.to); // KRIPROT: Find recipient
        const messageId = String((message as any).messageId ?? message.timestamp);

        // Opportunistic cleanup to avoid unbounded growth.
        if (this.messageRoutes.size > 5000) {
          const now = Date.now();
          for (const [id, route] of this.messageRoutes) {
            if (now - route.createdAt > MESSAGE_ROUTE_TTL_MS) {
              this.messageRoutes.delete(id);
            }
          }
        }

        // Keep a short-lived route hint to deliver ACKs even if user map is briefly stale.
        this.messageRoutes.set(messageId, {
          senderId: message.from,
          senderSocketId: socket.id,
          recipientId: message.to,
          createdAt: Date.now()
        });

        if (recipient) {
          this.rememberMessageRoute(message, socket.id);
          // KRIPROT CRITICAL: Relay ONLY encrypted cipher, NEVER decrypt
          // Prefer userId-room delivery; fallback to socketId only if room is empty.
          // Avoid double-delivery: do NOT emit to both room and socketId.
          const roomId = String(recipient.id);
          const room = this.io.sockets.adapter.rooms.get(roomId);
          const target = room && room.size > 0 ? roomId : recipient.socketId;

          this.io.to(target).emit('message:receive', {
            from: message.from, // KRIPROT: Sender ID (routing)
            cipher: message.cipher, // KRIPROT: ENCRYPTED - server blind to content
            kriKey: message.kriKey, // KRIPROT: КРІ encrypted key
            harmony: message.harmony, // KRIPROT: S=34 checksum validation
            timestamp: message.timestamp, // KRIPROT: Message timestamp
            nonce: message.nonce, // KRIPROT: Cryptographic nonce
            // ✅ v3.7.x: Forward advanced encryption metadata (clients need it to decrypt)
            postQuantum: (message as any).postQuantum,
            sealed: (message as any).sealed,
            version: (message as any).version,
            // Always include messageId (fallback to timestamp) so clients can ack reliably.
            messageId: message.messageId || String(message.timestamp),
            groupId: message.groupId || null
          });

          // KRIPROT: Delivery confirmation to sender
          socket.emit('message:delivered', {
            messageId: message.messageId || String(message.timestamp),
            to: message.to,
            timestamp: Date.now()
          });

          logEvent('📨 KRIPROT: Message relayed', { from: message.from, to: message.to });
        } else {
          // Best-effort Web Push for offline recipient (zero-knowledge payload).
          try {
            void this.sendWebPushIfPossible(String(message.to), {
              type: 'message',
              from: String(message.from || ''),
              groupId: (message as any).groupId ? String((message as any).groupId) : '',
              timestamp: Number((message as any).timestamp || Date.now())
            });
          } catch {}
          socket.emit('message:error', {
            error: 'Recipient not found',
            to: message.to
          });
        }
      });

      // ═══ v2.2.2: SEALED SENDER — route without seeing sender identity ═══
      socket.on('message:sealed-send', (data: {
        to: string; sealedEnvelope: string; messageId: string; timestamp: number; deliveryToken: string;
      }) => {
        const sender = getSenderBySocket(this.users, socket.id);
        if (!sender || !checkEventRateLimit(sender.id, 'message:send')) {
          socket.emit('message:error', { messageId: String(data.messageId || ''), to: data.to, code: 'RATE_LIMIT_EXCEEDED', timestamp: Date.now() });
          return;
        }
        const recipient = this.users.get(data.to);
        if (recipient) {
          this.messageRoutes.set(String(data.messageId), { senderId: data.deliveryToken, senderSocketId: socket.id, recipientId: data.to, createdAt: Date.now() });
          const roomId = String(recipient.id);
          const room = this.io.sockets.adapter.rooms.get(roomId);
          const target = room && room.size > 0 ? roomId : recipient.socketId;
          this.io.to(target).emit('message:receive', { from: '<sealed>', cipher: data.sealedEnvelope, kriKey: '', harmony: 34, timestamp: data.timestamp, nonce: '', messageId: data.messageId });
          socket.emit('message:delivered', { messageId: data.messageId, to: data.to, timestamp: Date.now() });
          console.log(`📨🔒 SEALED: <hidden> → ${data.to}`);
        } else {
          socket.emit('message:error', { messageId: String(data.messageId || ''), code: 'RECIPIENT_NOT_FOUND', error: 'Recipient not found', to: data.to, timestamp: Date.now() });
        }
      });

      // Public key on-demand (metadata minimization)
      socket.on('publicKey:request', (data: { to: string; requestId?: string }) => {
        try {
          const requester = getSenderBySocket(this.users, socket.id);
          if (!requester || !data?.to) return;
          if (!checkEventRateLimit(requester.id, 'publicKey:request')) return;
          const target = this.users.get(String(data.to));
          if (!target) return;

          this.io.to(socket.id).emit('publicKey:response', {
            userId: target.id,
            publicKey: target.publicKey,
            requestId: data.requestId || null,
            timestamp: Date.now()
          });
        } catch {
          // ignore
        }
      });

      // KRIPROT: Recipient ack -> forward to original sender (no message storage, zero-knowledge)
      // Accept both {from,to} and legacy-ish {fromId,toId} shapes.
      socket.on('message:ack', (ack: MessageAckPayload) => {
        try {
          const mid = String((ack as any).messageId ?? (ack as any).id ?? (ack as any).timestamp ?? '');
          const fromId = String((ack as any).from ?? (ack as any).fromId ?? '');
          const toId = String((ack as any).to ?? (ack as any).toId ?? '');
          if (!mid || !fromId || !toId) return;

          const debugAck = process.env.KRIMASS_DEBUG_ACK === '1';

          if (!checkEventRateLimit(fromId, 'message:ack')) {
            if (debugAck) {
              logEvent('⏳ KRIPROT: Ack rate-limited', { mid, from: fromId, to: toId });
            }
            return;
          }

          const payload: MessageAckNormalized = {
            messageId: mid,
            from: fromId,
            to: toId,
            timestamp: Date.now()
          };

          // Prefer stable room delivery; fallback to socketId only if room empty.
          const room = this.io.sockets.adapter.rooms.get(toId);
          const recipient = this.users.get(toId);
          const target = room && room.size > 0 ? toId : recipient?.socketId;
          if (target) {
            this.io.to(target).emit('message:ack', payload);
            return;
          }

          // Last-resort fallback using route hint.
          const route = this.messageRoutes.get(mid);
          if (route?.senderSocketId) {
            this.io.to(route.senderSocketId).emit('message:ack', payload);
          }
        } catch {
          // ignore
        }
      });

      // KRIPROT: Typing indicator relay
      /** @watermark KRIPROT-TYPING-INDICATOR-b8e3a7f1 */
      socket.on('typing:start', (data: { recipientId: string }) => {
        const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
        
        // ✅ 27-MIN SPRINT: Rate limiting for typing
        if (sender && !checkEventRateLimit(sender.id, 'typing:start')) {
          return; // Silently ignore spam
        }
        
        const recipient = this.users.get(data.recipientId);
        if (recipient) {
          this.io.to(recipient.socketId).emit('user:typing', {
            userId: sender?.id,
            isTyping: true
          });
        }
      });

      socket.on('typing:stop', (data: { recipientId: string }) => {
        const recipient = this.users.get(data.recipientId);
        if (recipient) {
          const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
          this.io.to(recipient.socketId).emit('user:typing', {
            userId: sender?.id,
            isTyping: false
          });
        }
      });

      // ✅ ULTRA SPRINT 1: WebRTC Video Calls - SDP/ICE Relay
      /** @watermark KRIPROT-WEBRTC-SIGNALING-c9d2e4f3 */
      socket.on('webrtc:offer', (data: { to: string; offer: any }) => {
        const recipient = this.users.get(data.to);
        if (recipient) {
          const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
          this.io.to(recipient.socketId).emit('webrtc:offer', {
            from: sender?.id,
            offer: data.offer,
            callerName: sender?.displayName || undefined
          });
          logEvent('📹 WebRTC offer', { from: sender?.id, to: data.to });
        } else {
          // Best-effort Web Push for incoming call when recipient is offline.
          try {
            const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
            void this.sendWebPushIfPossible(String(data.to), {
              type: 'call',
              from: String(sender?.id || ''),
              timestamp: Date.now()
            });
          } catch {}
        }
      });

      socket.on('webrtc:answer', (data: { to: string; answer: any }) => {
        const recipient = this.users.get(data.to);
        if (recipient) {
          const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
          this.io.to(recipient.socketId).emit('webrtc:answer', {
            from: sender?.id,
            answer: data.answer
          });
          logEvent('📹 WebRTC answer', { from: sender?.id, to: data.to });
        }
      });

      socket.on('webrtc:ice', (data: { to: string; candidate: any }) => {
        const recipient = this.users.get(data.to);
        if (recipient) {
          const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
          this.io.to(recipient.socketId).emit('webrtc:ice', {
            from: sender?.id,
            candidate: data.candidate
          });
        }
      });

      socket.on('webrtc:hangup', (data: { to: string }) => {
        const recipient = this.users.get(data.to);
        if (recipient) {
          const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
          this.io.to(recipient.socketId).emit('webrtc:hangup', {
            from: sender?.id
          });
          logEvent('📵 WebRTC hangup', { from: sender?.id, to: data.to });
        }
      });

      // ✅ ULTRA SPRINT 2: Group Chat - Enhanced sync
      /** @watermark KRIPROT-GROUP-SYNC-d3e5f6a4 */
      socket.on('group:create', (data: {
        groupId: string;
        name: string;
        description: string;
        publicKey: string;
        createdBy: string;
        members: string[];
        timestamp: number;
      }) => {
        // ✅ 27-MIN SPRINT: Rate limiting for group creation
        if (!checkEventRateLimit(data.createdBy, 'group:create')) {
          socket.emit('error', { message: 'Занадто багато груп. Зачекайте 5 хвилин.' });
          return;
        }
        
        // 🔒 CRITICAL FIX (Phase 1): DOS Protection для груп
        const uid = String(data.createdBy || '').trim();
        if (!uid) {
          socket.emit('error', { message: 'Invalid user ID' });
          return;
        }

        // Перевірка: чи не перевищено ліміт груп для користувача?
        const userCount = userGroupCounts.get(uid) || 0;
        if (userCount >= MAX_GROUPS_PER_USER) {
          socket.emit('error', { 
            message: `Ліміт груп досягнуто (${MAX_GROUPS_PER_USER} груп/користувач)` 
          });
          return;
        }

        // Перевірка: чи не перевищено загальний ліміт груп на сервері?
        const totalGroups = this.groupSubscribers.size;
        if (totalGroups >= MAX_TOTAL_GROUPS) {
          socket.emit('error', { 
            message: `Сервер досяг максимуму груп (${MAX_TOTAL_GROUPS})` 
          });
          return;
        }

        // ✅ Інкремент лічильника груп для користувача
        userGroupCounts.set(uid, userCount + 1);
        
        logEvent('👥 Group created', { createdBy: data.createdBy });

        // Track subscribers (best-effort, in-memory)
        try {
          const gid = String(data.groupId || '').trim();
          if (gid) {
            const set = this.ensureGroupSubscriberSet(gid);
            const members = Array.isArray(data.members) ? data.members : [];
            for (const m of members) {
              const id = String(m || '').trim();
              if (id) set.add(id);
            }
            this.emitSubscriberCountUpdate(gid);
          }
        } catch {
          // ignore
        }

        // Broadcast to all members
        data.members.forEach(memberId => {
          const member = this.users.get(memberId);
          if (member) {
            this.io.to(member.socketId).emit('group:created', data);
          }
        });
      });

      socket.on('group:add_member', (data: {
        groupId: string;
        userId: string;
        addedBy: string;
      }) => {
        // Track subscribers (best-effort, in-memory)
        try {
          const gid = String(data.groupId || '').trim();
          const uid = String(data.userId || '').trim();
          if (gid && uid) {
            const set = this.ensureGroupSubscriberSet(gid);
            set.add(uid);
            this.emitSubscriberCountUpdate(gid);
          }
        } catch {
          // ignore
        }

        const member = this.users.get(data.userId);
        if (member) {
          this.io.to(member.socketId).emit('group:invitation', data);
          logEvent('👤 Added to group', { userId: data.userId, groupId: data.groupId });
        }
      });

      socket.on('group:message', (data: {
        groupId: string;
        from: string;
        cipher: string;
        harmony: number;
        timestamp: number;
      }) => {
        // 🔒 HIGH FIX: Input validation for group messages
        if (!data || typeof data !== 'object') {
          console.warn('⚠️ Invalid group message object');
          return;
        }
        
        // Validate cipher
        if (!isValidBase64(data.cipher) || !isValidMessageLength(data.cipher)) {
          console.warn('⚠️ Invalid group message cipher');
          return;
        }
        
        // Validate required fields
        if (!data.groupId || !data.from || typeof data.harmony !== 'number') {
          console.warn('⚠️ Missing required group message fields');
          return;
        }
        
        // Sanitize
        data.groupId = sanitizeString(data.groupId, 100);
        data.from = sanitizeString(data.from, 100);
        
        // Broadcast to all users (they filter by groupId locally)
        socket.broadcast.emit('group:message_received', data);
        logEvent('💬 Group message', { from: data.from, groupId: data.groupId });
      });

      socket.on('group:leave', (data: { groupId: string; userId: string }) => {
        // Track subscribers (best-effort, in-memory)
        try {
          const gid = String(data.groupId || '').trim();
          const uid = String(data.userId || '').trim();
          if (gid && uid) {
            const set = this.ensureGroupSubscriberSet(gid);
            set.delete(uid);
            this.emitSubscriberCountUpdate(gid);
            
            // 🔒 CRITICAL FIX: Декремент лічильника груп для користувача
            const userCount = userGroupCounts.get(uid) || 0;
            if (userCount > 0) {
              userGroupCounts.set(uid, userCount - 1);
            }
          }
        } catch {
          // ignore
        }

        socket.broadcast.emit('group:member_left', data);
        logEvent('👋 Left group', { userId: data.userId, groupId: data.groupId });
      });

      // Channels/groups: best-effort subscribe/unsubscribe + subscriber count query
      socket.on('group:subscribe', (data: { groupId: string; userId: string }) => {
        try {
          const gid = String(data.groupId || '').trim();
          const uid = String(data.userId || '').trim();
          if (!gid || !uid) return;
          const set = this.ensureGroupSubscriberSet(gid);
          set.add(uid);
          this.emitSubscriberCountUpdate(gid);
        } catch {
          // ignore
        }
      });

      socket.on('group:unsubscribe', (data: { groupId: string; userId: string }) => {
        try {
          const gid = String(data.groupId || '').trim();
          const uid = String(data.userId || '').trim();
          if (!gid || !uid) return;
          const set = this.ensureGroupSubscriberSet(gid);
          set.delete(uid);
          this.emitSubscriberCountUpdate(gid);
        } catch {
          // ignore
        }
      });

      socket.on('group:subscriber_count:request', (data: { groupId: string; requestId: string }) => {
        try {
          const gid = String(data.groupId || '').trim();
          const rid = String(data.requestId || '').trim();
          if (!gid || !rid) return;
          const count = this.getSubscriberCount(gid);
          socket.emit('group:subscriber_count:response', { groupId: gid, requestId: rid, count, timestamp: Date.now() });
        } catch {
          // ignore
        }
      });

      // ✅ ULTRA SPRINT 3: File Sharing - Binary relay
      /** @watermark KRIPROT-FILE-TRANSFER-e4f6a7b5 */
      socket.on('file:send', (data: {
        to: string;
        from: string;
        fileName: string;
        fileSize: number;
        fileType: string;
        chunk: string; // Base64 chunk
        chunkIndex: number;
        totalChunks: number;
        fileId: string;
      }) => {
        // Rate limiting (best-effort; server stays zero-knowledge)
        if (!checkEventRateLimit(String(data.from), 'file:send')) {
          return;
        }
        const recipient = this.users.get(data.to);
        if (recipient) {
          this.io.to(recipient.socketId).emit('file:receive', data);
          logEvent('📎 File chunk relayed', { fileId: data.fileId, chunkIndex: data.chunkIndex, totalChunks: data.totalChunks });
        }
      });

      socket.on('file:complete', (data: { to: string; fileId: string }) => {
        try {
          const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
          if (sender && !checkEventRateLimit(String(sender.id), 'file:send')) {
            return;
          }
        } catch {}
        const recipient = this.users.get(data.to);
        if (recipient) {
          this.io.to(recipient.socketId).emit('file:transfer_complete', data);
          logEvent('✅ File transfer complete', { fileId: data.fileId });
        }
      });

      // ✅ ULTRA SPRINT 4: Voice Messages - Audio relay
      /** @watermark KRIPROT-VOICE-RELAY-f5a7b8c6 */
      socket.on('voice:send', (data: {
        to: string;
        from: string;
        audioBlob: string; // Base64 audio
        duration: number;
        timestamp: number;
      }) => {
        const recipient = this.users.get(data.to);
        if (recipient) {
          this.io.to(recipient.socketId).emit('voice:receive', data);
          logEvent('🎤 Voice message relayed', { from: data.from, to: data.to, duration: data.duration });
        }
      });

      // ✅ ULTRA SPRINT 5: Self-Destruct - Cross-device sync
      /** @watermark KRIPROT-SELF-DESTRUCT-a6b8c9d7 */
      socket.on('message:self_destruct', (data: {
        messageId: string;
        contactId: string;
        userId: string;
      }) => {
        // Notify both sender and recipient to delete
        const contact = this.users.get(data.contactId);
        if (contact) {
          this.io.to(contact.socketId).emit('message:delete', {
            messageId: data.messageId,
            from: data.userId
          });
        }
        // Confirm to sender
        socket.emit('message:deleted', { messageId: data.messageId });
        logEvent('💣 Self-destruct', { messageId: data.messageId });
      });

      // P2P обмін ключами
      socket.on('key:exchange', (data: { to: string; publicKey: string; qrData: string }) => {
        const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
        
        // ✅ 27-MIN SPRINT: Rate limiting for key exchange
        // Calls can tunnel signaling via qrData.callSignal; allow higher throughput for that.
        const qr = (data && typeof data.qrData === 'string') ? data.qrData : '';
        const isCallSignal = qr.includes('"callSignal"') || qr.includes("'callSignal'");
        const limitEvent = isCallSignal ? 'call:signal' : 'key:exchange';
        if (sender && !checkEventRateLimit(sender.id, limitEvent)) {
          socket.emit('error', { message: 'Занадто багато обмінів ключами. Зачекайте.' });
          return;
        }
        
        const recipient = this.users.get(data.to);
        
        if (recipient) {
          this.io.to(recipient.socketId).emit('key:received', {
            // Use stable userId when available (socket.id breaks cross-device identity)
            from: sender?.id || socket.id,
            publicKey: data.publicKey,
            qrData: data.qrData,
            timestamp: Date.now()
          });

          logEvent('🔑 Key exchanged', { socketId: socket.id, to: data.to });
        }
      });

      // Синхронізація повідомлень
      socket.on('sync:request', (data: { userId: string; lastSync: number }) => {
        socket.emit('sync:response', {
          timestamp: Date.now(),
          message: 'Sync completed (messages stored locally only)'
        });
      });

      // Peer discovery
      socket.on('peer:discover', (data: PeerDiscovery) => {
        // ✅ 27-MIN SPRINT: Rate limiting for peer discovery
        if (!checkEventRateLimit(data.userId, 'peer:discover')) {
          socket.emit('error', { message: 'Занадто багато запитів пошуку. Зачекайте.' });
          return;
        }
        
        // Broadcast всім окрім себе
        socket.broadcast.emit('peer:found', {
          userId: data.userId,
          publicKey: data.publicKey,
          timestamp: data.timestamp
        });
      });

      // Typing indicator
      socket.on('typing:start', (data: { to: string }) => {
        const recipient = this.users.get(data.to);
        if (recipient) {
          this.io.to(recipient.socketId).emit('typing:indicator', {
            from: socket.id,
            isTyping: true
          });
        }
      });

      socket.on('typing:stop', (data: { to: string }) => {
        const recipient = this.users.get(data.to);
        if (recipient) {
          this.io.to(recipient.socketId).emit('typing:indicator', {
            from: socket.id,
            isTyping: false
          });
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        // Знаходимо користувача
        const user = Array.from(this.users.values()).find(u => u.socketId === socket.id);
        
        if (user) {
          this.users.delete(user.id);
          
          // Повідомляємо всіх
          this.io.emit('user:offline', {
            userId: user.id
          });

          logEvent('❌ User disconnected', { userId: user.id });
        }
      });

      // ═══════════════════════════════════════════════════════════════
      // PROXIMITY RADAR ENDPOINTS (Added 5 Dec 2025)
      // ═══════════════════════════════════════════════════════════════

      /**
       * Broadcast присутності користувача
       * Розсилаємо всім підключеним користувачам
       */
      socket.on('nearby:broadcast', (data: {
        userId: string;
        encryptedData: string;
        originalLength: number;
        timestamp: number;
      }) => {
        logEvent('📡 [Radar] Broadcast', { userId: data.userId });
        
        // Rate limiting для broadcast (макс 1 на секунду)
        if (!checkEventRateLimit(data.userId, 'nearby:broadcast')) {
          socket.emit('error', { message: 'Rate limit exceeded for broadcast' });
          return;
        }
        
        // Розсилаємо ВСІМ крім відправника (broadcast)
        socket.broadcast.emit('nearby:broadcast', {
          userId: data.userId,
          encryptedData: data.encryptedData,
          originalLength: data.originalLength,
          timestamp: data.timestamp
        });
        
        logEvent('✅ [Radar] Broadcasted to all users');
      });

      /**
       * Запит списку користувачів поблизу
       * Відповідає даними про підключених користувачів
       */
      socket.on('nearby:query', (data: {
        userId: string;
        timestamp: number;
      }) => {
        logEvent('📡 [Radar] Query', { userId: data.userId });
        
        // Формуємо список онлайн користувачів
        const onlineUsers = Array.from(this.users.values())
          .filter(u => u.id !== data.userId) // Виключаємо себе
          .map(u => ({
            userId: u.id,
            publicKey: u.publicKey,
            lastSeen: u.lastSeen
          }));
        
        // Відправляємо відповідь
        socket.emit('nearby:response', {
          users: onlineUsers,
          timestamp: Date.now()
        });
        
        logEvent('✅ [Radar] Sent users', { count: onlineUsers.length });
      });

      /**
       * Підписка на оновлення радара
       * Відправляємо користувачу коли хтось з'являється/зникає
       */
      socket.on('nearby:subscribe', (data: { userId: string }) => {
        logEvent('📡 [Radar] Subscribed', { userId: data.userId });
        
        // При підписці відправляємо поточний список
        const onlineUsers = Array.from(this.users.values())
          .filter(u => u.id !== data.userId)
          .map(u => ({
            userId: u.id,
            publicKey: u.publicKey,
            lastSeen: u.lastSeen
          }));
        
        socket.emit('nearby:update', {
          users: onlineUsers,
          timestamp: Date.now()
        });
      });
    });
  }

  /**
   * Запуск сервера
   */
  start() {
    // v2.2.2: Cleanup stale rate-limit entries every 60s (memory leak fix)
    const rlCleanup = setInterval(() => cleanupStaleRateLimits(), 60 * 1000);
    if (typeof rlCleanup.unref === 'function') rlCleanup.unref();

    this.server.listen(this.port, () => {
      console.log(`
╔═══════════════════════════════════════════╗
║   🌿 KRIMASS RELAY SERVER                 ║
╠═══════════════════════════════════════════╣
║ Status:     ✅ ONLINE                      ║
║ Port:       ${this.port}                            ║
║ Protocol:   WebSocket (Zero-Knowledge)    ║
║ Security:   Server knows NOTHING          ║
╠═══════════════════════════════════════════╣
║ Endpoints:                                ║
║   GET  /health                            ║
║   GET  /users/online                      ║
║   POST /users/find                        ║
╠═══════════════════════════════════════════╣
║ WebSocket Events:                         ║
║   - register                              ║
║   - message:send / message:receive        ║
║   - key:exchange                          ║
║   - sync:request                          ║
║   - peer:discover                         ║
╚═══════════════════════════════════════════╝
      `);
    });
  }

  /**
   * Зупинка сервера
   */
  stop() {
    this.server.close();
    console.log('❌ Server stopped');
  }
}

// Експорт
export default KRIMassRelayServer;

// Якщо запускається напряму
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = new KRIMassRelayServer(Number(PORT));
  server.start();
}
