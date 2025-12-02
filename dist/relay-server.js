"use strict";
/**
 * RELAY SERVER - WebSocket
 * Zero-Knowledge сервер для обміну зашифрованими повідомленнями
 * Сервер НЕ ЗНАЄ нічого - тільки передає шифри
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
/**
 * KRIMASS Relay Server
 */
class KRIMassRelayServer {
    constructor(port = 3000) {
        this.port = port;
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        this.io = new socket_io_1.Server(this.server, {
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
    setupMiddleware() {
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json());
    }
    /**
     * HTTP Routes
     */
    setupRoutes() {
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
            }
            else {
                res.json({ found: false });
            }
        });
    }
    /**
     * WebSocket Events
     */
    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log(`✅ User connected: ${socket.id}`);
            // Реєстрація користувача
            socket.on('register', (data) => {
                const user = {
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
            socket.on('message:send', (message) => {
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
                }
                else {
                    socket.emit('message:error', {
                        error: 'Recipient not found',
                        to: message.to
                    });
                }
            });
            // ✅ СПРИНТ 2: Typing indicator
            socket.on('typing:start', (data) => {
                const recipient = this.users.get(data.recipientId);
                if (recipient) {
                    const sender = Array.from(this.users.values()).find(u => u.socketId === socket.id);
                    this.io.to(recipient.socketId).emit('user:typing', {
                        userId: sender?.id,
                        isTyping: true
                    });
                }
            });
            socket.on('typing:stop', (data) => {
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
            socket.on('group:create', (data) => {
                console.log(`📡 Group created: ${data.name}`);
                socket.broadcast.emit('group:created', data);
            });
            socket.on('group:add_member', (data) => {
                const member = this.users.get(data.userId);
                if (member) {
                    this.io.to(member.socketId).emit('group:invitation', data);
                }
            });
            socket.on('group:message', (data) => {
                socket.broadcast.emit('group:message_received', data);
            });
            // P2P обмін ключами
            socket.on('key:exchange', (data) => {
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
            socket.on('sync:request', (data) => {
                socket.emit('sync:response', {
                    timestamp: Date.now(),
                    message: 'Sync completed (messages stored locally only)'
                });
            });
            // Peer discovery
            socket.on('peer:discover', (data) => {
                // Broadcast всім окрім себе
                socket.broadcast.emit('peer:found', {
                    userId: data.userId,
                    publicKey: data.publicKey,
                    timestamp: data.timestamp
                });
            });
            // Typing indicator
            socket.on('typing:start', (data) => {
                const recipient = this.users.get(data.to);
                if (recipient) {
                    this.io.to(recipient.socketId).emit('typing:indicator', {
                        from: socket.id,
                        isTyping: true
                    });
                }
            });
            socket.on('typing:stop', (data) => {
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
exports.default = KRIMassRelayServer;
// Якщо запускається напряму
if (require.main === module) {
    const server = new KRIMassRelayServer(3000);
    server.start();
}
//# sourceMappingURL=relay-server.js.map