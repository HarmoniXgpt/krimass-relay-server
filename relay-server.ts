/**
 * RELAY SERVER - WebSocket
 * Zero-Knowledge сервер для обміну зашифрованими повідомленнями
 * Сервер НЕ ЗНАЄ нічого - тільки передає шифри
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

// Types
interface User {
  id: string;
  socketId: string;
  publicKey: string;
  lastSeen: number;
}

interface EncryptedMessage {
  from: string;
  to: string;
  cipher: string;
  kriKey: string;
  harmony: number;
  timestamp: number;
  nonce: string;
}

interface PeerDiscovery {
  userId: string;
  publicKey: string;
  timestamp: number;
}

/**
 * KRIMASS Relay Server
 */
class KRIMassRelayServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private users: Map<string, User>;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    this.users = new Map();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  /**
   * Middleware
   */
  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  /**
   * HTTP Routes
   */
  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'online',
        users: this.users.size,
        timestamp: Date.now(),
        version: '2.0.0',
        message: '🌿 KRIMASS Relay Server - Zero Knowledge'
      });
    });

    // Список онлайн користувачів (тільки публічні ключі)
    this.app.get('/users/online', (req, res) => {
      const onlineUsers = Array.from(this.users.values()).map(user => ({
        id: user.id,
        publicKey: user.publicKey,
        lastSeen: user.lastSeen
      }));
      res.json({ users: onlineUsers });
    });

    // Знайти користувача по публічному ключу
    this.app.post('/users/find', (req, res) => {
      const { publicKey } = req.body;
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
   * WebSocket Events
   */
  private setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log(`✅ User connected: ${socket.id}`);

      // Реєстрація користувача
      socket.on('register', (data: { userId: string; publicKey: string }) => {
        const user: User = {
          id: data.userId,
          socketId: socket.id,
          publicKey: data.publicKey,
          lastSeen: Date.now()
        };
        
        this.users.set(data.userId, user);
        
        socket.emit('registered', {
          success: true,
          userId: data.userId,
          timestamp: Date.now()
        });

        // Повідомляємо всіх про нового користувача
        this.io.emit('user:online', {
          userId: data.userId,
          publicKey: data.publicKey
        });

        console.log(`👤 User registered: ${data.userId}`);
      });

      // Відправка повідомлення
      socket.on('message:send', (message: EncryptedMessage) => {
        const recipient = this.users.get(message.to);
        
        if (recipient) {
          // Відправляємо ТІЛЬКИ шифр (сервер НЕ ЗНАЄ змісту)
          this.io.to(recipient.socketId).emit('message:receive', {
            from: message.from,
            cipher: message.cipher,
            kriKey: message.kriKey,
            harmony: message.harmony,
            timestamp: message.timestamp,
            nonce: message.nonce
          });

          // Підтвердження відправнику
          socket.emit('message:delivered', {
            messageId: message.timestamp,
            to: message.to,
            timestamp: Date.now()
          });

          console.log(`📨 Message relayed: ${message.from} → ${message.to}`);
        } else {
          socket.emit('message:error', {
            error: 'Recipient not found',
            to: message.to
          });
        }
      });

      // ✅ СПРИНТ 2: Typing indicator
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
