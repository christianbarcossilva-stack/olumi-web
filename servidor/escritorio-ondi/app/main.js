// Ondi escritorio · abre la app web (siempre la última versión) en una ventana propia.
const {app,BrowserWindow,shell,Menu,session}=require('electron');
const path=require('path'); const fs=require('fs');
const URL='https://unitytech.uy/ondi/app/';
// Abrir directo en una pantalla de monitoreo: Ondi.exe --pantalla=p1  (ideal para el PC del televisor; arranca en pantalla completa)
const argPantalla=(process.argv.find(a=>a.startsWith('--pantalla='))||'').split('=')[1]||'';
const estadoPath=()=>path.join(app.getPath('userData'),'ventana.json');
function leerVentana(){ try{ return JSON.parse(fs.readFileSync(estadoPath(),'utf8')); }catch(e){ return {}; } }
let gt=null;
function guardarVentana(){ clearTimeout(gt); gt=setTimeout(()=>{ try{ if(win && !win.isMinimized() && !win.isFullScreen()) fs.writeFileSync(estadoPath(), JSON.stringify(Object.assign(win.getBounds(),{max:win.isMaximized()}))); }catch(e){} }, 500); }
app.setName('Ondi');
if(!app.requestSingleInstanceLock()){app.quit()}
let win=null;
function crear(){
  const v=leerVentana();
  const opts={width:v.width||1280,height:v.height||820,minWidth:420,minHeight:600,title:'Ondi',backgroundColor:'#101419',autoHideMenuBar:true,fullscreen:!!argPantalla,
    icon:path.join(__dirname,'icono.png'),
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:true}};
  if(typeof v.x==='number' && typeof v.y==='number'){ opts.x=v.x; opts.y=v.y; }
  win=new BrowserWindow(opts);
  if(v.max && !argPantalla) win.maximize();
  win.loadURL(URL+(argPantalla?'#pantalla-'+argPantalla:'')).catch(()=>{});
  ['resize','move','maximize','unmaximize'].forEach(ev=>win.on(ev,guardarVentana));
  // si no hay internet, muestra una pantalla propia con reintento
  win.webContents.on('did-fail-load',(e,code,desc,url,isMain)=>{if(isMain&&code!==-3)win.loadFile(path.join(__dirname,'sin-conexion.html'))});
  // links externos (WhatsApp, PDFs, planos…) se abren en el navegador normal
  win.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith(URL))return{action:'allow'};shell.openExternal(url);return{action:'deny'}});
  win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('https://unitytech.uy/')&&!url.startsWith('file:')){e.preventDefault();shell.openExternal(url)}});
  win.on('closed',()=>{win=null});
}
// Solo los permisos que Ondi usa: avisos, portapapeles (copiar enlace) y pantalla completa. Cámara, micrófono y ubicación quedan bloqueados.
app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((wc,perm,cb)=>cb(['notifications','clipboard-read','clipboard-sanitized-write','fullscreen'].includes(perm)));
  const tpl=[...(process.platform==='darwin'?[{label:'Ondi',submenu:[{role:'about',label:'Acerca de Ondi'},{type:'separator'},{role:'hide',label:'Ocultar'},{role:'quit',label:'Salir'}]}]:[]),
    {label:'Edición',submenu:[{role:'undo',label:'Deshacer'},{role:'redo',label:'Rehacer'},{type:'separator'},{role:'cut',label:'Cortar'},{role:'copy',label:'Copiar'},{role:'paste',label:'Pegar'},{role:'selectAll',label:'Seleccionar todo'}]},
    {label:'Ver',submenu:[{role:'reload',label:'Recargar'},{role:'resetZoom',label:'Tamaño normal'},{role:'zoomIn',label:'Agrandar'},{role:'zoomOut',label:'Achicar'},{type:'separator'},{role:'togglefullscreen',label:'Pantalla completa'},{label:'Modo televisor (Pantalla 1)',accelerator:'F10',click:()=>{if(win){win.loadURL(URL+'#pantalla-p1');win.setFullScreen(true)}}}]},
    {label:'Ventana',submenu:[{role:'minimize',label:'Minimizar'},{role:'close',label:'Cerrar'}]}];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
  crear();
  app.on('activate',()=>{if(!win)crear()});
});
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
