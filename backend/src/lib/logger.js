/* Tiny leveled logger — zero deps, readable output, safe for prod. */
const COLORS = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  success: '\x1b[32m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
};

function ts() {
  // Avoids Date.now noise in logs while staying human-readable.
  return new Date().toISOString().split('T')[1].replace('Z', '');
}

function log(level, ...args) {
  const color = COLORS[level] || '';
  // eslint-disable-next-line no-console
  console.log(`${color}[${ts()}] ${level.toUpperCase()}${COLORS.reset}`, ...args);
}

export const logger = {
  info: (...a) => log('info', ...a),
  warn: (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a),
  success: (...a) => log('success', ...a),
  debug: (...a) => (process.env.VERBOSE ? log('debug', ...a) : undefined),
};

export default logger;
