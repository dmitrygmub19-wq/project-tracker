/**
 * Handler Registration
 *
 * Register all your IPC handlers here
 */

import { appHandlers } from "./app.js";
import { registerTrackerHandlers } from "./tracker.js";
import { openSettingsWindow } from "../windows/settings-window.js";

import { ipcMain, logger, nativeTheme } from "@glaze/core/backend";

export function registerHandlers(): void {
  logger.info("handlers", "Registering IPC handlers...");

  // Register app handlers using ipcMain API
  ipcMain.handle("app:getInfo", async (_event) => {
    return await appHandlers.getInfo();
  });

  ipcMain.handle("nativeTheme:getInfo", async () => ({ themeSource: nativeTheme.themeSource, shouldUseDarkColors: nativeTheme.shouldUseDarkColors }));
  ipcMain.handle("nativeTheme:setThemeSource", async (_event, source: "system" | "light" | "dark") => { nativeTheme.themeSource = source; return true; });
  ipcMain.handle("nativeTheme:getShouldUseDarkColors", async () => nativeTheme.shouldUseDarkColors);
  ipcMain.handle("nativeTheme:getThemeSource", async () => nativeTheme.themeSource);

  // Settings window handler
  ipcMain.handle("window:openSettings", async (_event) => {
    await openSettingsWindow();
  });

  // Register tracker handlers (weekly project/task tracker)
  registerTrackerHandlers();

  logger.info("handlers", "All IPC handlers registered");
}
