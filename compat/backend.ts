import { app, BrowserWindow as ElectronBrowserWindow, Menu, ipcMain, dialog, nativeTheme } from 'electron';
export { app, Menu, ipcMain, dialog, nativeTheme };
export class BrowserWindow extends ElectronBrowserWindow {
  constructor(options: any = {}) {
    const { id: _id, ...rest } = options;
    super({ ...rest, webPreferences: { contextIsolation: true, nodeIntegration: false, ...(rest.webPreferences || {}) } });
  }
}
const log = (level: string, scope: string, message: string, data?: unknown) => {
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${scope}] ${message}`, data ?? '');
};
export const logger = {
  debug: (s:string,m:string,d?:unknown)=>log('debug',s,m,d),
  info: (s:string,m:string,d?:unknown)=>log('info',s,m,d),
  warn: (s:string,m:string,d?:unknown)=>log('warn',s,m,d),
  error: (s:string,m:string,d?:unknown)=>log('error',s,m,d),
};
