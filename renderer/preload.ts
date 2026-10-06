import { contextBridge, ipcRenderer } from 'electron';
const api = {
  nativeTheme: {
    getInfo: () => ipcRenderer.invoke('nativeTheme:getInfo'),
    setThemeSource: (source: 'system'|'light'|'dark') => ipcRenderer.invoke('nativeTheme:setThemeSource', source),
    getShouldUseDarkColors: () => ipcRenderer.invoke('nativeTheme:getShouldUseDarkColors'),
    getThemeSource: () => ipcRenderer.invoke('nativeTheme:getThemeSource'),
  },
  glaze: { ipc: {
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    onNotification: (channel: string, callback: (params:unknown)=>void) => { const listener=(_e:unknown,p:unknown)=>callback(p); ipcRenderer.on(channel,listener); return ()=>ipcRenderer.removeListener(channel,listener); },
    isConnected: () => true, waitForReady: async () => {}, disconnect: () => {},
  }},
  buildFlavor: process.env.NODE_ENV === 'development' ? 'Development' : 'Production',
};
contextBridge.exposeInMainWorld('glazeAPI', api);
