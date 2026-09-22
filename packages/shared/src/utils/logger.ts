export class Logger {
  static init(config: { dsn?: string; environment?: string }) {
    // Tässä alustettaisiin esim. Sentry.init()
    console.log(`[Logger] Initialized in ${config.environment || 'development'} mode.`);
  }

  static error(message: string, error?: any, context?: Record<string, any>) {
    // Sentry.captureException(error);
    console.error(`[ERROR] ${message}`, error, context || '');
  }

  static info(message: string, context?: Record<string, any>) {
    // Sentry.captureMessage(message);
    console.info(`[INFO] ${message}`, context || '');
  }
}
