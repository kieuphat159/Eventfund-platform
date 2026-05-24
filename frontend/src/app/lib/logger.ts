const isDev = import.meta.env.DEV;

const formatScope = (scope: string) => `[FE:${scope}]`;

export const logger = {
  debug(scope: string, message: string, ...details: unknown[]) {
    if (!isDev) return;
    console.debug(formatScope(scope), message, ...details);
  },

  info(scope: string, message: string, ...details: unknown[]) {
    if (!isDev) return;
    console.info(formatScope(scope), message, ...details);
  },

  warn(scope: string, message: string, ...details: unknown[]) {
    console.warn(formatScope(scope), message, ...details);
  },

  error(scope: string, message: string, ...details: unknown[]) {
    console.error(formatScope(scope), message, ...details);
  },
};
