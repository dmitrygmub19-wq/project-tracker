export function initLogging() { /* Electron/console logging needs no bootstrap. */ }
export function isDevelopmentFlavor() { return import.meta.env?.DEV ?? false; }
