let editor,filePath=null,previewUrl=null,camStream=null,recorder=null,chunks=[],timer=null;
const $=id=>document.getElementById(id);
const starter=`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mirror Code</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111827;color:white;font-family:Arial}
    .card{padding:40px;border-radius:24px;background:rgba(59,130,246,.35);backdrop-filter:blur(12px);text-align:center}
    h1{font-size:48px;margin:0 0 12px}
  </style>
</head>
<body>
  <div class="card">
    <h1>Mirror Code</h1>
    <p>Écris ici : le preview se met à jour en direct.</p>
  </div>
</body>
</html>`;

function updateScratchPreview(){
 if(!editor || filePath || previewUrl) return;
 $('preview').removeAttribute('src');
 $('preview').srcdoc=editor.getValue();
 $('status').textContent='LIVE ✓';
}

require.config({paths:{vs:'../node_modules/monaco-editor/min/vs'}});
require(['vs/editor/editor.main'],()=>{
 editor=monaco.editor.create($('editor'),{
   value:starter,language:'html',theme:'vs-dark',automaticLayout:true,fontSize:15,
   minimap:{enabled:false},scrollBeyondLastLine:false,padding:{top:18},fontLigatures:true,
   readOnly:false,domReadOnly:false,tabIndex:0
 });
 editor.onDidChangeModelContent(()=>{
   $('status').textContent='Modification…';
   clearTimeout(timer);
   if($('auto').checked) timer=setTimeout(()=> filePath ? save(true) : updateScratchPreview(),300);
 });
 setTimeout(()=>{ updateScratchPreview(); editor.focus(); },100);

// V3.2 — collage explicite dans Monaco + profondeur 3D légère au mouvement
editor.onKeyDown(async e=>{
  if((e.ctrlKey||e.metaKey) && e.keyCode===monaco.KeyCode.KeyV){
    // Monaco gère normalement Ctrl/Cmd+V. Ce fallback utilise le presse-papiers Electron/Web API.
    try{
      const text=window.api.clipboardRead ? await window.api.clipboardRead() : await navigator.clipboard.readText();
      if(text){
        e.preventDefault();
        const sel=editor.getSelection();
        editor.executeEdits('paste',[{range:sel,text,forceMoveMarkers:true}]);
        editor.pushUndoStop();
      }
    }catch(_){ /* le collage natif Monaco reste disponible */ }
  }
  if((e.ctrlKey||e.metaKey) && e.keyCode===monaco.KeyCode.KeyC){
    const sel=editor.getSelection(); const text=editor.getModel().getValueInRange(sel);
    if(text && window.api.clipboardWrite) await window.api.clipboardWrite(text);
  }
  if((e.ctrlKey||e.metaKey) && e.keyCode===monaco.KeyCode.KeyX){
    const sel=editor.getSelection(); const text=editor.getModel().getValueInRange(sel);
    if(text && window.api.clipboardWrite) await window.api.clipboardWrite(text);
  }
});
const stage=$('stage');
// V4.5: couches fixes — aucun mouvement lié à la souris.
stage.classList.remove('depthTilt');
stage.style.perspectiveOrigin='50% 50%';
});

const langs={js:'javascript',mjs:'javascript',ts:'typescript',tsx:'typescript',jsx:'javascript',html:'html',htm:'html',css:'css',scss:'scss',json:'json',md:'markdown',py:'python',php:'php',java:'java',c:'c',cpp:'cpp'};
function language(p){return langs[(p.split('.').pop()||'').toLowerCase()]||'plaintext'}
function render(nodes,host){host.innerHTML='';for(const n of nodes){const wrap=document.createElement('div');wrap.className='node';const row=document.createElement('div');row.className='nodeLabel '+n.type;row.textContent=(n.type==='dir'?'▾ ':'· ')+n.name;wrap.appendChild(row);if(n.type==='dir'){const child=document.createElement('div');child.className='children';render(n.children,child);wrap.appendChild(child);row.onclick=()=>child.hidden=!child.hidden}else row.onclick=()=>openFile(n.path);host.appendChild(wrap)}}
async function refreshTree(){try{const tree=await window.api.refreshTree();render(tree,$('tree'))}catch(e){$('status').textContent=e.message||'Ouvre un projet'}}
$('newFile').onclick=async()=>{try{const r=await window.api.createFile();if(r){render(r.tree,$('tree'));if(r.path)openFile(r.path)}}catch(e){alert(e.message)}};
$('newFolder').onclick=async()=>{try{const r=await window.api.createFolder();if(r)render(r.tree,$('tree'))}catch(e){alert(e.message)}};
$('assets').onclick=async()=>{try{const r=await window.api.importAssets();if(r){render(r.tree,$('tree'));$('status').textContent=r.count+' asset(s) ajouté(s)'}}catch(e){alert(e.message)}};
function togglePreview(force){const next=force ?? !document.body.classList.contains('previewInteractive');document.body.classList.toggle('previewInteractive',next);$('interact').textContent=next?'PREVIEW: INTERACTIF':'PREVIEW: PASSIF';if(!next)setTimeout(()=>editor?.focus(),0)}
async function openFile(p){try{const f=await window.api.readFile(p);filePath=f.path;$('filename').textContent=f.name;editor.setValue(f.content);monaco.editor.setModelLanguage(editor.getModel(),language(p));$('status').textContent='Ouvert';setTimeout(()=>editor.focus(),0)}catch(e){$('status').textContent='Erreur lecture'}}
async function save(auto=false){if(!editor)return;if(!filePath){updateScratchPreview();$('status').textContent='Brouillon LIVE ✓';return}await window.api.saveFile(filePath,editor.getValue());$('status').textContent=auto?'LIVE ✓':'Sauvegardé';reload()}
function reload(){if(!previewUrl){updateScratchPreview();return}$('preview').srcdoc='';$('preview').src=previewUrl+(previewUrl.includes('?')?'&':'?')+'v='+Date.now()}
$('folder').onclick=async()=>{const p=await window.api.openFolder();if(!p)return;previewUrl=p.previewUrl;$('project').textContent=p.name;$('out').textContent+='\n[projet] '+p.name+' — terminal lié à la racine\n';render(p.tree,$('tree'));reload();const html=p.tree.find(x=>x.type==='file'&&/^index\.html?$/i.test(x.name));if(html)openFile(html.path)};
$('save').onclick=()=>save(false);$('reload').onclick=reload;
$('camera').onclick=async()=>{if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;$('cam').srcObject=null;$('camBlur').srcObject=null;$('camera').textContent='CAMERA';return}try{camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1920},height:{ideal:1080},aspectRatio:{ideal:1.7777778},resizeMode:'none'},audio:false});$('cam').srcObject=camStream;$('camBlur').srcObject=camStream;$('camera').textContent='CAMERA ✓';setTimeout(()=>editor?.focus(),0)}catch(e){alert('Impossible d’activer la caméra : '+e.message)}};
function slider(id,target){$(id).oninput=e=>{const v=e.target.value;$(target).style.opacity=v/100;e.target.nextElementSibling.textContent=v+'%'}}slider('previewOpacity','previewLayer');slider('codeOpacity','editorLayer');$('camOpacity').oninput=e=>{const v=e.target.value;$('cam').style.opacity=v/100;$('camBlur').style.opacity=Math.min(.78,(v/100)*1.45);e.target.nextElementSibling.textContent=v+'%'};
$('interact').onclick=()=>togglePreview();
// Clic droit : passe instantanément du code au preview, et inversement.
// V4.6 — clic droit robuste : en capture pour passer avant Monaco.
// En mode code, clic droit dans la scène => Preview interactif.
// En mode preview, le document chargé dans l'iframe envoie un postMessage => retour au code.
$('stage').addEventListener('contextmenu',e=>{
  e.preventDefault();
  e.stopPropagation();
  togglePreview();
},{capture:true});

// V4.4 — roulette synchronisée entre le code et le Preview.
// On synchronise la progression (0..100 %) plutôt que les pixels, car les deux contenus
// n'ont généralement pas la même hauteur. Le mode actif reçoit le scroll naturel et
// l'autre couche est replacée à la même progression.
let syncingWheel=false;
function editorScrollRatio(){
  if(!editor) return 0;
  const max=Math.max(0,editor.getScrollHeight()-editor.getLayoutInfo().height);
  return max ? Math.max(0,Math.min(1,editor.getScrollTop()/max)) : 0;
}
function setEditorScrollRatio(r){
  if(!editor) return;
  const max=Math.max(0,editor.getScrollHeight()-editor.getLayoutInfo().height);
  editor.setScrollTop(max*Math.max(0,Math.min(1,r)),monaco.editor.ScrollType.Immediate);
}
function previewWindow(){
  try{return $('preview').contentWindow}catch(_){return null}
}
function previewScrollRatio(){
  try{
    const w=previewWindow(),d=w.document.documentElement,b=w.document.body;
    const top=w.scrollY||d.scrollTop||b.scrollTop||0;
    const full=Math.max(d.scrollHeight,b.scrollHeight);
    const max=Math.max(0,full-w.innerHeight);
    return max ? Math.max(0,Math.min(1,top/max)) : 0;
  }catch(_){return null}
}
function setPreviewScrollRatio(r){
  try{
    const w=previewWindow(),d=w.document.documentElement,b=w.document.body;
    const full=Math.max(d.scrollHeight,b.scrollHeight),max=Math.max(0,full-w.innerHeight);
    w.scrollTo({top:max*Math.max(0,Math.min(1,r)),behavior:'auto'});
    return true;
  }catch(_){return false}
}
$('stage').addEventListener('wheel',e=>{
  if(syncingWheel) return;
  syncingWheel=true;
  const interactive=document.body.classList.contains('previewInteractive');
  if(interactive){
    // En mode Preview, l'iframe défile naturellement. On attend une frame puis on aligne Monaco.
    requestAnimationFrame(()=>{const r=previewScrollRatio();if(r!==null)setEditorScrollRatio(r);syncingWheel=false});
  }else{
    // En mode Code, Monaco reçoit la roulette. On aligne le Preview juste après son déplacement.
    requestAnimationFrame(()=>{setPreviewScrollRatio(editorScrollRatio());syncingWheel=false});
  }
},{capture:true,passive:true});

// Synchronisation aussi quand Monaco défile au trackpad / scrollbar / clavier.
editor?.onDidScrollChange?.(ev=>{
  if(syncingWheel || document.body.classList.contains('previewInteractive')) return;
  syncingWheel=true;setPreviewScrollRatio(editorScrollRatio());requestAnimationFrame(()=>syncingWheel=false);
});
window.addEventListener('message',e=>{
  if(e.source===$('preview').contentWindow && e.data?.type==='mirror-preview-context'){
    togglePreview(false);
  }
});
$('cmd').onkeydown=e=>{if(e.key==='Enter'){const c=e.target.value.trim();if(c){$('out').textContent+='\n› '+c+'\n';window.api.run(c)}e.target.value=''}};
window.api.onOutput(d=>{$('out').textContent+=d;$('out').scrollTop=$('out').scrollHeight});
window.api.onPreviewUrl?.(url=>{
  if(!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)) return;
  previewUrl=url;
  $('status').textContent='SERVEUR LOCAL ✓ '+url;
  $('preview').srcdoc='';
  $('preview').src=url;
});
window.api.onPreviewContextToggle?.(()=>togglePreview(false));
$('fullscreen').onclick=async()=>{const on=await window.api.toggleFullscreen();$('fullscreen').textContent=on?'EXIT FULLSCREEN':'FULLSCREEN'};
$('focus').onclick=()=>{document.body.classList.toggle('focusMode');$('focus').textContent=document.body.classList.contains('focusMode')?'EXIT FOCUS':'FOCUS';setTimeout(()=>editor?.layout(),50)};
$('terminalToggle').onclick=()=>{document.body.classList.toggle('terminalClosed');$('terminalToggle').textContent=document.body.classList.contains('terminalClosed')?'TERMINAL ↑':'TERMINAL ↓';setTimeout(()=>editor?.layout(),50)};
$('terminalClose').onclick=()=>{document.body.classList.add('terminalClosed');$('terminalToggle').textContent='TERMINAL ↑';setTimeout(()=>editor?.layout(),50)};
$('record').onclick=async()=>{if(recorder?.state==='recording'){recorder.stop();return}try{
  const source=await window.api.captureSource();
  if(!source) throw new Error('Fenêtre Mirror Code introuvable pour la capture.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:source.id,maxFrameRate:30}}});
  chunks=[];recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'});
  recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  recorder.onstop=()=>{const blob=new Blob(chunks,{type:'video/webm'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mirror-code-'+Date.now()+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);stream.getTracks().forEach(t=>t.stop());$('record').textContent='● REC';$('record').classList.remove('recording')};
  recorder.start(1000);$('record').textContent='■ STOP';$('record').classList.add('recording')
}catch(e){alert('Enregistrement impossible : '+e.message)}};
window.addEventListener('keydown',async e=>{
  if(e.key==='Escape'){
    if(document.body.classList.contains('focusMode')){
      e.preventDefault();
      document.body.classList.remove('focusMode');
      $('focus').textContent='FOCUS';
      setTimeout(()=>editor?.layout(),50);
      return;
    }
    if(document.fullscreenElement){
      e.preventDefault();
      await document.exitFullscreen().catch(()=>{});
      $('fullscreen').textContent='FULLSCREEN';
      setTimeout(()=>editor?.layout(),50);
      return;
    }
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save(false)}
});
$('stage').addEventListener('mousedown',e=>{if(!document.body.classList.contains('previewInteractive') && !e.target.closest('.monaco-editor')) setTimeout(()=>editor?.focus(),0)});


// Mirror Code V5.2 — terminal vertical resize
(() => {
  const handle = document.getElementById('terminalResizeHandle');
  if (!handle) return;

  const candidates = [
    document.getElementById('terminalPanel'),
    document.getElementById('terminalContainer'),
    document.getElementById('terminalDock'),
    document.getElementById('terminalPane'),
    document.querySelector('.terminal-panel'),
    document.querySelector('.terminal-container'),
    document.querySelector('.terminal-dock'),
    document.querySelector('.terminal-pane'),
    document.querySelector('[class*="terminal"]')
  ].filter(Boolean);

  const terminal = candidates.find(el => el !== handle);
  if (!terminal) return;

  const MIN_H = 120;
  const MAX_RATIO = 0.72;
  let dragging = false;

  const applyHeight = (height) => {
    const maxH = Math.max(MIN_H, Math.floor(window.innerHeight * MAX_RATIO));
    const h = Math.max(MIN_H, Math.min(maxH, height));
    terminal.style.height = `${h}px`;
    terminal.style.minHeight = `${MIN_H}px`;
    terminal.style.maxHeight = `${Math.floor(window.innerHeight * MAX_RATIO)}px`;
    terminal.style.flex = '0 0 auto';
    localStorage.setItem('mirrorCodeTerminalHeight', String(h));
    window.dispatchEvent(new Event('resize'));
  };

  const saved = Number(localStorage.getItem('mirrorCodeTerminalHeight'));
  if (Number.isFinite(saved) && saved > 0) applyHeight(saved);

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    handle.setPointerCapture?.(e.pointerId);
    handle.classList.add('is-resizing');
    document.body.classList.add('terminal-resizing');
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    // Terminal is docked at the bottom: its height is viewport bottom minus pointer Y.
    applyHeight(window.innerHeight - e.clientY);
  });

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('is-resizing');
    document.body.classList.remove('terminal-resizing');
  };
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);

  window.addEventListener('resize', () => {
    const current = terminal.getBoundingClientRect().height;
    const maxH = Math.floor(window.innerHeight * MAX_RATIO);
    if (current > maxH) applyHeight(maxH);
  });
})();
