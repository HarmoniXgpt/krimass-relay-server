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
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

// Types (KRIPROT Proprietary)
/** @watermark KRIPROT-USER-TYPE */
interface User {
  id: string; // KRIPROT: Unique user identifier
  socketId: string; // KRIPROT: WebSocket connection ID
  publicKey: string; // KRIPROT: Public key for routing only
  lastSeen: number; // KRIPROT: Timestamp for presence
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
}

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
  private port: number; // KRIPROT: Server port

  /** @watermark KRIPROT-CONSTRUCTOR */
  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*', // KRIPROT: Allow all origins for public relay
        methods: ['GET', 'POST'] // KRIPROT: HTTP methods allowed
      }
    });
    this.users = new Map(); // KRIPROT: Initialize user registry

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
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
        version: '2.0.0', // KRIPROT: Server version
        message: '🌿 KRIMASS Relay Server - Zero Knowledge'
      });
    });

    // KRIPROT: Online users list (public keys only)
    /** @watermark KRIPROT-USERS-ONLINE */
    this.app.get('/users/online', (req, res) => {
      const onlineUsers = Array.from(this.users.values()).map(user => ({
        id: user.id, // KRIPROT: User ID
        publicKey: user.publicKey, // KRIPROT: Public key for routing
        lastSeen: user.lastSeen // KRIPROT: Last activity timestamp
      }));
      res.json({ users: onlineUsers });
    });

    // KRIPROT: Find user by public key
    /** @watermark KRIPROT-USER-FIND */
    this.app.post('/users/find', (req, res) => {
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
  }

  /**
   * KRIPROT WebSocket Events - Proprietary Zero-Knowledge Logic
   * @watermark KRIPROT-WEBSOCKET-CORE-9d4f8a2e
   * @protection Patent Pending - Trade Secret
   * @description Server NEVER decrypts - only routes encrypted payloads
   */
  private setupWebSocket() {
    /** @watermark KRIPROT-CONNECTION-HANDLER */
    this.io.on('connection', (socket) => {
      console.log(`✅ KRIPROT: User connected: ${socket.id}`);

      // KRIPROT: User registration endpoint
      /** @watermark KRIPROT-REGISTER-EVENT-a3c7f912 */
      socket.on('register', (data: { userId: string; publicKey: string }) => {
        const user: User = {
          id: data.userId, // KRIPROT: User identifier
          socketId: socket.id, // KRIPROT: WebSocket connection ID
          publicKey: data.publicKey, // KRIPROT: Public key for routing ONLY
          lastSeen: Date.now() // KRIPROT: Timestamp
        };
        
        this.users.set(data.userId, user); // KRIPROT: Store in registry
        
        socket.emit('registered', {
          success: true,
          userId: data.userId,
          timestamp: Date.now()
        });

        // KRIPROT: Broadcast new user online
        this.io.emit('user:online', {
          userId: data.userId,
          publicKey: data.publicKey
        });

        console.log(`👤 KRIPROT: User registered: ${data.userId}`);
      });

      // KRIPROT: Message relay (ZERO-KNOWLEDGE - server CANNOT decrypt)
      /** @watermark KRIPROT-MESSAGE-RELAY-7f2e9d31 */
      socket.on('message:send', (message: EncryptedMessage) => {
        const recipient = this.users.get(message.to); // KRIPROT: Find recipient
        
        if (recipient) {
          // KRIPROT CRITICAL: Relay ONLY encrypted cipher, NEVER decrypt
          this.io.to(recipient.socketId).emit('message:receive', {
            from: message.from, // KRIPROT: Sender ID (routing)
            cipher: message.cipher, // KRIPROT: ENCRYPTED - server blind to content
            kriKey: message.kriKey, // KRIPROT: КРІ encrypted key
            harmony: message.harmony, // KRIPROT: S=34 checksum validation
            timestamp: message.timestamp, // KRIPROT: Message timestamp
            nonce: message.nonce // KRIPROT: Cryptographic nonce
          });

          // KRIPROT: Delivery confirmation to sender
          socket.emit('message:delivered', {
            messageId: message.timestamp,
            to: message.to,
            timestamp: Date.now()
          });

          console.log(`📨 KRIPROT: Message relayed: ${message.from} → ${message.to}`);
        } else {
          socket.emit('message:error', {
            error: 'Recipient not found',
            to: message.to
          });
        }
      });

      // KRIPROT: Typing indicator relay
      /** @watermark KRIPROT-TYPING-INDICATOR-b8e3a7f1 */
      socket.on('typing:start', (data: { recipientId: string }) => {
        const recipient = this.users.get(data.recipientId);
        if (recipient) {
          const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
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

      // ✅ СПРИНТ 3: Group synchronization
      socket.on('group:create', (data: {
        groupId: string;
        name: string;
        description: string;
        publicKey: string;
        createdBy: string;
        timestamp: number;
      }) => {
        console.log(`📡 Group created: ${data.name}`);
        socket.broadcast.emit('group:created', data);
      });

      socket.on('group:add_member', (data: {
        groupId: string;
        userId: string;
        addedBy: string;
      }) => {
        const member = this.users.get(data.userId);
        if (member) {
          this.io.to(member.socketId).emit('group:invitation', data);
        }
      });

      socket.on('group:message', (data: {
        groupId: string;
        message: any;
      }) => {
        socket.broadcast.emit('group:message_received', data);
      });

      // P2P обмін ключами
      socket.on('key:exchange', (data: { to: string; publicKey: string; qrData: string }) => {
        const recipient = this.users.get(data.to);
        
        if (recipient) {
          this.io.to(recipient.socketId).emit('key:received', {
            from: socket.id,
            publicKey: data.publicKey,
            qrData: data.qrData,
            timestamp: Date.now()
          });

          console.log(`🔑 Key exchanged: ${socket.id} → ${data.to}`);
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

          console.log(`❌ User disconnected: ${user.id}`);
        }
      });
    });
  }

  /**
   * Запуск сервера
   */
  start() {
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
