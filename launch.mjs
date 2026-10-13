import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const url='http://127.0.0.1:4178';
async function isReady(){try{const response=await fetch(url,{signal:AbortSignal.timeout(700)});return response.ok&&(await response.text()).includes('<title>Point Cloud Studio</title>');}catch{return false;}}
if(await isReady())execFile('open',[url]);
else{
 const child=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{stdio:'inherit'});
 let exited=false;child.on('exit',code=>{exited=true;process.exitCode=code??1;});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
 let ready=false;
 for(let i=0;i<30&&!exited;i++){if(await isReady()){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}
 if(ready)execFile('open',[url]);else {console.error('Unable to start the local preview. Check whether port 4178 is already in use.');child.kill();process.exitCode=1;}
}
