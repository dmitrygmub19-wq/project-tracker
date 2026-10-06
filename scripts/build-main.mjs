import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('build/main',{recursive:true}); await mkdir('build/assets',{recursive:true});
const common={bundle:true,platform:'node',format:'esm',target:'node20',external:['electron'],sourcemap:true};
await build({...common,entryPoints:['main/index.ts'],outfile:'build/main/index.js',alias:{'@glaze/core/backend':'./compat/backend.ts'}});
await build({...common,entryPoints:['renderer/preload.ts'],outfile:'build/assets/preload.cjs',format:'cjs'});
