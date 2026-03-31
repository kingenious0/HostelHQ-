import { Logtail } from "@logtail/edge";

/**
 * Better Stack (Logtail) Logger
 * 
 * This logger sends critical security and system logs to a centralized 
 * "Black Box" (Better Stack) for active monitoring.
 * 
 * Note: Logs only fire if the BETTER_STACK_SOURCE_TOKEN is provided.
 */
const token = process.env.BETTER_STACK_SOURCE_TOKEN;

// Only instantiate Logtail if we have a valid token to avoid build-time errors
export const logger = token ? new Logtail(token) : null;

export const logSecurityEvent = (event: string, details: any) => {
  // Always log to local console for immediate debugging visibility
  console.log(`[SECURITY] ${event}`, details);
  
  if (logger) {
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
  // Always log to local console for immediate debugging visibility
  console.error(`[ERROR] ${error.message}`, context);
  
  if (logger) {
    logger.error(error.message, {
      ...context,
      stack: error.stack,
      service: "hostelhq-error-monitor",
    }).catch(err => {
      console.error("Failed to send error log to Better Stack:", err);
    });
  }
};
