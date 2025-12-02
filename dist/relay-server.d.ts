/**
 * KRIPROT Relay Server - Proprietary Architecture
 * @class KRIMassRelayServer
 * @copyright 2025 KRIPROT
 * @watermark EMBEDDED-CLASS-SIGNATURE
 * @protection MAXIMUM
 */
declare class KRIMassRelayServer {
    private app;
    private server;
    private io;
    private users;
    private port;
    /** @watermark KRIPROT-CONSTRUCTOR */
    constructor(port?: number);
    /**
     * KRIPROT Middleware Setup
     * @watermark KRIPROT-MIDDLEWARE-f8a2c1d9
     * @protection Proprietary CORS configuration
     */
    private setupMiddleware;
    /**
     * KRIPROT HTTP Routes - Proprietary API
     * @watermark KRIPROT-ROUTES-3b7e9f21
     * @protection Trade secret routing logic
     */
    private setupRoutes;
    /**
     * KRIPROT WebSocket Events - Proprietary Zero-Knowledge Logic
     * @watermark KRIPROT-WEBSOCKET-CORE-9d4f8a2e
     * @protection Patent Pending - Trade Secret
     * @description Server NEVER decrypts - only routes encrypted payloads
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