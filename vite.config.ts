import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({
  plugins:[react(),tailwindcss()],
  base:'./',
  resolve:{alias:{
    '@glaze/core/components':path.resolve(__dirname,'compat/components.tsx'),
    '@glaze/core/hooks':path.resolve(__dirname,'compat/hooks.ts'),
    '@glaze/core/utils':path.resolve(__dirname,'compat/utils.ts'),
    '@glaze/core/ipc':path.resolve(__dirname,'compat/ipc.ts'),
  }},
  build:{outDir:'build',emptyOutDir:false,rollupOptions:{input:{main:path.resolve(__dirname,'main-window.html'),settings:path.resolve(__dirname,'settings-window.html')}}},
});
