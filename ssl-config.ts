/**
 * ✅ ULTRA CACHE PRODUCTION: WSS SSL CONFIGURATION
 * WebSocket Secure з SSL/TLS сертифікатами
 * 
 * @watermark KRIXAIR-WSS-PRODUCTION
 * @created 2025-12-04
 */

export interface SSLConfig {
  enabled: boolean;
  keyPath?: string;
  certPath?: string;
  caPath?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  useSSL: boolean;
  ssl?: SSLConfig;
}

/**
 * Production конфігурація (WSS з SSL)
 */
export const productionConfig: ServerConfig = {
  port: 443, // HTTPS standard port
  host: '0.0.0.0',
  useSSL: true,
  ssl: {
    enabled: true,
    // ✅ Let's Encrypt сертифікати (приклад)
    keyPath: '/etc/letsencrypt/live/relay.krimass.app/privkey.pem',
    certPath: '/etc/letsencrypt/live/relay.krimass.app/fullchain.pem',
    caPath: '/etc/letsencrypt/live/relay.krimass.app/chain.pem'
  }
};

/**
 * Development конфігурація (WS без SSL)
 */
export const developmentConfig: ServerConfig = {
  port: 3000,
  host: 'localhost',
  useSSL: false
};

/**
 * Отримати конфігурацію згідно з environment
 */
export function getServerConfig(): ServerConfig {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    // ✅ Production: WSS з SSL
    return productionConfig;
  } else {
    // ✅ Development: WS без SSL
    return developmentConfig;
  }
}

/**
 * Client-side URL (для React Native app)
 */
export function getWebSocketURL(): string {
  const config = getServerConfig();
  
  if (config.useSSL) {
    return `wss://relay.krimass.app`; // ✅ Production WSS
  } else {
    return `ws://localhost:${config.port}`; // ✅ Development WS
  }
}

/**
 * ✅ Інструкція отримання Let's Encrypt сертифікату:
 * 
 * 1. Встановити Certbot:
 *    ```bash
 *    sudo apt-get update
 *    sudo apt-get install certbot
 *    ```
 * 
 * 2. Отримати сертифікат:
 *    ```bash
 *    sudo certbot certonly --standalone -d relay.krimass.app
 *    ```
 * 
 * 3. Сертифікати будуть в:
 *    /etc/letsencrypt/live/relay.krimass.app/
 *    - privkey.pem (приватний ключ)
 *    - fullchain.pem (повний ланцюг сертифікатів)
 *    - chain.pem (проміжні сертифікати)
 * 
 * 4. Автоматичне оновлення (кожні 90 днів):
 *    ```bash
 *    sudo certbot renew --dry-run
 *    ```
 * 
 * 5. Налаштувати cron job:
 *    ```bash
 *    0 12 * * * /usr/bin/certbot renew --quiet
 *    ```
 */

/**
 * ✅ Альтернатива: Cloudflare SSL (безкоштовно)
 * 
 * 1. Додати домен relay.krimass.app в Cloudflare
 * 2. Ввімкнути "Full (strict)" SSL mode
 * 3. Cloudflare автоматично видасть сертифікат
 * 4. В коді просто використати wss://relay.krimass.app
 */
