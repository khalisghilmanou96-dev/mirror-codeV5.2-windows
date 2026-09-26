const { app, BrowserWindow, ipcMain, dialog, session, clipboard, Menu, desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
let win, rootDir=null, server=null, shellProcess=null;

function createWindow(){
  win=new BrowserWindow({width:1500,height:950,minWidth:1000,minHeight:650,backgroundColor:'#07090d',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});
  win.loadFile(path.join(__dirname,'index.html'));
  win.webContents.on('context-menu',(event,params)=>{
    // Le preview local gère lui-même le clic droit pour repasser en mode code.
    // On évite donc d'afficher le menu Electron au-dessus de l'iframe.
    const frameUrl=String(params.frameURL||params.pageURL||'');
    if(/^http:\/\/(127\.0\.0\.1|localhost):/i.test(frameUrl)){ event.preventDefault(); win.webContents.send('preview-context-toggle'); return; }
    // Le menu natif reste disponible dans les vrais champs éditables hors de la scène.
    if(params.isEditable){
      const menu=Menu.buildFromTemplate([
        {label:'Couper',role:'cut',enabled:params.editFlags.canCut},
        {label:'Copier',role:'copy',enabled:params.editFlags.canCopy},
        {label:'Coller',role:'paste',enabled:params.editFlags.canPaste},
        {type:'separator'},
        {label:'Tout sélectionner',role:'selectAll'}
      ]);
      menu.popup({window:win});
    }
  });
}
app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((wc,permission,callback)=>callback(['media','display-capture'].includes(permission)));
  createWindow();
});
app.on('window-all-closed',()=>{if(server)server.close();if(shellProcess) shellProcess.kill();if(process.platform!=='darwin')app.quit()});

function makeTree(dir,base=dir){
  const ignored=new Set(['node_modules','.git','dist','build','.next']);
  try{return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>!ignored.has(x.name)).sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name)).map(x=>{const p=path.join(dir,x.name);return x.isDirectory()?{name:x.name,path:p,type:'dir',children:makeTree(p,base)}:{name:x.name,path:p,type:'file'};});}catch{return []}
}
function type(p){return ({'.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'})[path.extname(p).toLowerCase()]||'application/octet-stream'}
async function startServer(){
  if(server) await new Promise(r=>server.close(r));
  server=http.createServer((req,res)=>{try{
    const clean=decodeURIComponent((req.url||'/').split('?')[0]);
    let target=path.resolve(rootDir,'.'+clean);
    if(!target.startsWith(path.resolve(rootDir))){res.writeHead(403);return res.end('Forbidden')}
    if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
    if(!fs.existsSync(target)){res.writeHead(404);return res.end('Crée un index.html à la racine du projet.')}
    if(/\.html?$/i.test(target)){let html=fs.readFileSync(target,'utf8');html=html.replace('</body>',`<script>document.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();parent.postMessage({type:'mirror-preview-context'},'*')},{capture:true})<\/script></body>`);res.writeHead(200,{'Content-Type':type(target),'Cache-Control':'no-store, no-cache, must-revalidate'});return res.end(html)} res.writeHead(200,{'Content-Type':type(target),'Cache-Control':'no-store, no-cache, must-revalidate'});fs.createReadStream(target).pipe(res);
  }catch(e){res.writeHead(500);res.end(e.message)}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return `http://127.0.0.1:${server.address().port}/`;
}
ipcMain.handle('open-folder',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory']});if(r.canceled)return null;rootDir=r.filePaths[0];if(shellProcess){shellProcess.kill();shellProcess=null;}return {name:path.basename(rootDir),tree:makeTree(rootDir),previewUrl:await startServer()}});
ipcMain.handle('read-file',async(_,p)=>({path:p,name:path.basename(p),content:fs.readFileSync(p,'utf8')}));
ipcMain.handle('save-file',async(_,p,c)=>{fs.writeFileSync(p,c,'utf8');return true});
function ensureShell(){
  if(shellProcess && !shellProcess.killed) return shellProcess;
  const shell=process.platform==='win32'?(process.env.COMSPEC||'cmd.exe'):(process.env.SHELL||'/bin/bash');
  shellProcess=spawn(shell,[],{cwd:rootDir||process.cwd(),env:{...process.env,TERM:'xterm-256color',FORCE_COLOR:'0',PYTHONUNBUFFERED:'1'},stdio:'pipe'});
  const emitTerminal=d=>{
    const text=d.toString();
    win.webContents.send('terminal-output',text);
    const clean=text.replace(/\x1B\[[0-?]*[ -\/]*[@-~]/g,'');
    const matches=clean.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/[^\s\x1b]*)?/gi)||[];
    if(matches.length){
      let url=matches[matches.length-1].replace(/[),.;]+$/,'');
      url=url.replace('://0.0.0.0', '://127.0.0.1');
      win.webContents.send('preview-url',url);
    }
  };
  shellProcess.stdout.on('data',emitTerminal);
  shellProcess.stderr.on('data',emitTerminal);
  shellProcess.on('close',c=>{win.webContents.send('terminal-output',`\n[shell exit ${c}]\n`);shellProcess=null});
  return shellProcess;
}
ipcMain.on('terminal-command',(_,cmd)=>{const sh=ensureShell();sh.stdin.write(cmd+'\n')});
ipcMain.on('terminal-input',(_,d)=>{const sh=ensureShell();sh.stdin.write(d)});
function needRoot(){if(!rootDir) throw new Error('Ouvre d’abord un projet.');}
ipcMain.handle('refresh-tree',()=>{needRoot();return makeTree(rootDir)});
ipcMain.handle('create-file',async()=>{needRoot();const r=await dialog.showSaveDialog(win,{title:'Créer un fichier',defaultPath:path.join(rootDir,'nouveau-fichier.txt')});if(r.canceled)return null;fs.mkdirSync(path.dirname(r.filePath),{recursive:true});if(!fs.existsSync(r.filePath))fs.writeFileSync(r.filePath,'');return {tree:makeTree(rootDir),path:r.filePath}});
ipcMain.handle('create-folder',async()=>{needRoot();const r=await dialog.showSaveDialog(win,{title:'Créer un dossier',defaultPath:path.join(rootDir,'nouveau-dossier'),buttonLabel:'Créer le dossier'});if(r.canceled)return null;fs.mkdirSync(r.filePath,{recursive:true});return {tree:makeTree(rootDir)}});
ipcMain.handle('import-assets',async()=>{needRoot();const r=await dialog.showOpenDialog(win,{title:'Ajouter des assets',properties:['openFile','multiSelections']});if(r.canceled)return null;const assetDir=path.join(rootDir,'assets');fs.mkdirSync(assetDir,{recursive:true});for(const src of r.filePaths)fs.copyFileSync(src,path.join(assetDir,path.basename(src)));return {tree:makeTree(rootDir),count:r.filePaths.length}});


ipcMain.handle('toggle-fullscreen',()=>{win.setFullScreen(!win.isFullScreen());return win.isFullScreen()});
ipcMain.handle('window-capture-source',async()=>{
  const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:0,height:0}});
  const own=sources.find(s=>String(s.id).includes(String(win.getMediaSourceId?.()||''))) || sources.find(s=>s.name===win.getTitle()) || sources.find(s=>/Mirror Code/i.test(s.name));
  return own?{id:own.id,name:own.name}:null;
});
ipcMain.handle('project-info',()=>rootDir?{root:rootDir,name:path.basename(rootDir),previewUrl:server?`http://127.0.0.1:${server.address().port}/`:null}:null);

ipcMain.handle('clipboard-read',()=>clipboard.readText());
ipcMain.handle('clipboard-write',(_,text)=>{clipboard.writeText(String(text??''));return true});
