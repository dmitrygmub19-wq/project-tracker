import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
const vite=spawn(process.platform==='win32'?'npx.cmd':'npx',['vite','--host','127.0.0.1'],{stdio:['ignore','pipe','inherit']});
let started=false;
vite.stdout.on('data',async b=>{ process.stdout.write(b); const s=b.toString(); if(!started && /Local:/.test(s)){ started=true; await writeFile('.devserverhost','http://127.0.0.1:5173'); const build=spawn(process.execPath,['scripts/build-main.mjs'],{stdio:'inherit'}); build.on('exit',code=>{ if(code) process.exit(code); const e=spawn(process.platform==='win32'?'npx.cmd':'npx',['electron','build/main/index.js'],{stdio:'inherit'}); e.on('exit',async c=>{try{await unlink('.devserverhost')}catch{} vite.kill(); process.exit(c??0);});}); }});
process.on('SIGINT',()=>vite.kill());
