/**
 * Environment-aware logging utility
 * Logs to console in development, suppresses in production
 * Sensitive data should never be logged
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
    // In production, you might want to send to error reporting service
    // e.g., Sentry.captureException(args[0])
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  }
};

/**
 * Redact sensitive user IDs for logging
 * Shows first 8 and last 4 characters
 */
export const redactUserId = (id: string): string => {
  if (!id || id.length < 12) return '***';
  return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
};
