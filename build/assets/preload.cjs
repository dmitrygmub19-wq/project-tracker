"use strict";

// renderer/preload.ts
var import_electron = require("electron");
var api = {
  nativeTheme: {
    getInfo: () => import_electron.ipcRenderer.invoke("nativeTheme:getInfo"),
    setThemeSource: (source) => import_electron.ipcRenderer.invoke("nativeTheme:setThemeSource", source),
    getShouldUseDarkColors: () => import_electron.ipcRenderer.invoke("nativeTheme:getShouldUseDarkColors"),
    getThemeSource: () => import_electron.ipcRenderer.invoke("nativeTheme:getThemeSource")
  },
  glaze: { ipc: {
    invoke: (channel, ...args) => import_electron.ipcRenderer.invoke(channel, ...args),
    onNotification: (channel, callback) => {
      const listener = (_e, p) => callback(p);
      import_electron.ipcRenderer.on(channel, listener);
      return () => import_electron.ipcRenderer.removeListener(channel, listener);
    },
    isConnected: () => true,
    waitForReady: async () => {
    },
    disconnect: () => {
    }
  } },
  buildFlavor: process.env.NODE_ENV === "development" ? "Development" : "Production"
};
import_electron.contextBridge.exposeInMainWorld("glazeAPI", api);
//# sourceMappingURL=preload.cjs.map
