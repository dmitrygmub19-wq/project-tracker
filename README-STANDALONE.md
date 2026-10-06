# Project Board — standalone edition

This copy removes the Glaze runtime dependency and runs as a normal Electron + React + Vite desktop app.

## Requirements
- Node.js 20 or newer
- npm

## Run in development
```bash
npm install
npm run dev
```

## Build the app assets
```bash
npm run build
npm start
```

## Important: existing Project Board data
The source code and your saved board data are separate. This standalone app uses Electron's normal `userData` directory. Before relying on it, copy/import your existing Glaze tracker JSON files into the new app's data directory. Keep your original Glaze installation and backup until you have confirmed all boards are present.

## What changed
- Glaze desktop runtime replaced with Electron.
- Glaze IPC bridge replaced with Electron `contextBridge`/`ipcRenderer`.
- Glaze backend APIs mapped to Electron (`BrowserWindow`, `ipcMain`, dialogs, native theme).
- Glaze UI primitives replaced by local compatibility components built on Radix UI + Tailwind.
- Normal Vite build and development commands added.

The application still uses the `window.glazeAPI` name internally to minimize changes to your business logic; it is now provided locally by Electron and does not require Glaze.
