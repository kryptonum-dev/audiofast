import { IS_PRODUCTION_DEPLOYMENT } from './constants';

type LogContext = Record<string, unknown> | undefined;

function formatContext(context?: LogContext) {
  if (!context) return '';
  try {
    return `\ncontext: ${JSON.stringify(context, null, 2)}`;
  } catch {
    return '';
  }
}

export function logInfo(message: string, context?: LogContext) {
  // Keep info logs quiet in production unless preview deployment
  if (IS_PRODUCTION_DEPLOYMENT) return;
  console.log(`ℹ️ ${message}${formatContext(context)}`);
}

export function logWarn(message: string, context?: LogContext) {
  console.warn(`⚠️ ${message}${formatContext(context)}`);
}

export function logError(
  message: string,
  error?: unknown,
  context?: LogContext
) {
  const normalized =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
  console.error(
    `🚨 ${message}${normalized ? `\nerror: ${JSON.stringify(normalized, null, 2)}` : ''}${formatContext(
      context
    )}`
  );
}

// Convenience wrapper for async operations
export async function withErrorLogging<T>(
  label: string,
  operation: () => Promise<T>,
  context?: LogContext
): Promise<T | null> {
  try {
    return await operation();
  } catch (err) {
    logError(label, err, context);
    return null;
  }
}
