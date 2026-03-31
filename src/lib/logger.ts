import { Logtail } from "@logtail/next";

/**
 * Better Stack (Logtail) Logger
 * 
 * This logger will be used to send critical security and system logs
 * to a centralized "Black Box" (Better Stack) for active monitoring.
 */
const token = process.env.BETTER_STACK_SOURCE_TOKEN || "";

export const logger = new Logtail(token);

export const logSecurityEvent = (event: string, details: any) => {
  console.log(`[SECURITY] ${event}`, details);
  
  if (token) {
    logger.info(event, {
      ...details,
      service: "hostelhq-security-monitor",
      timestamp: new Date().toISOString(),
    }).catch(err => {
      console.error("Failed to send log to Better Stack:", err);
    });
  }
};

export const logError = (error: Error, context?: any) => {
  console.error(`[ERROR] ${error.message}`, context);
  
  if (token) {
    logger.error(error.message, {
      ...context,
      stack: error.stack,
      service: "hostelhq-error-monitor",
    }).catch(err => {
      console.error("Failed to send error log to Better Stack:", err);
    });
  }
};
