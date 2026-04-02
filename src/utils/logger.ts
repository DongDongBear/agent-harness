export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',   // gray
  info: '\x1b[36m',    // cyan
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
};

const RESET = '\x1b[0m';

export function createLogger(prefix: string, level: LogLevel = 'info'): Logger {
  const minPriority = LEVEL_PRIORITY[level];

  function log(msgLevel: LogLevel, message: string): void {
    if (LEVEL_PRIORITY[msgLevel] < minPriority) return;
    const color = LEVEL_COLORS[msgLevel];
    const tag = msgLevel.toUpperCase().padEnd(5);
    process.stderr.write(`${color}${tag} [${prefix}]${RESET} ${message}\n`);
  }

  return {
    debug: (message: string) => log('debug', message),
    info: (message: string) => log('info', message),
    warn: (message: string) => log('warn', message),
    error: (message: string) => log('error', message),
  };
}
