/**
 * RELAY SERVER - WebSocket
 * Zero-Knowledge сервер для обміну зашифрованими повідомленнями
 * Сервер НЕ ЗНАЄ нічого - тільки передає шифри
 */
/**
 * KRIMASS Relay Server
 */
declare class KRIMassRelayServer {
    private app;
    private server;
    private io;
    private users;
    private port;
    constructor(port?: number);
    /**
     * Middleware
     */
    private setupMiddleware;
    /**
     * HTTP Routes
     */
    private setupRoutes;
    /**
     * WebSocket Events
     */
    private setupWebSocket;
    /**
     * Запуск сервера
     */
    start(): void;
    /**
     * Зупинка сервера
     */
    stop(): void;
}
export default KRIMassRelayServer;
//# sourceMappingURL=relay-server.d.ts.map