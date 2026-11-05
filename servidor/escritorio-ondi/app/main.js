// Ondi escritorio · abre la app web (siempre la última versión) en una ventana propia.
const {app,BrowserWindow,shell,Menu,session,dialog}=require('electron');
const path=require('path');
const URL='https://unitytech.uy/ondi/app/';
app.setName('Ondi');
if(!app.requestSingleInstanceLock()){app.quit()}
let win=null;
function crear(){
  win=new BrowserWindow({width:1280,height:820,minWidth:420,minHeight:600,title:'Ondi',backgroundColor:'#101419',autoHideMenuBar:true,
    icon:path.join(__dirname,'icono.png'),
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:true}});
  win.loadURL(URL).catch(()=>{});
  // si no hay internet, muestra una pantalla propia con reintento
  win.webContents.on('did-fail-load',(e,code,desc,url,isMain)=>{if(isMain&&code!==-3)win.loadFile(path.join(__dirname,'sin-conexion.html'))});
  // links externos (WhatsApp, PDFs, planos…) se abren en el navegador normal
  win.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith(URL))return{action:'allow'};shell.openExternal(url);return{action:'deny'}});
  win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('https://unitytech.uy/')&&!url.startsWith('file:')){e.preventDefault();shell.openExternal(url)}});
  win.on('closed',()=>{win=null});
}
// cámara y micrófono (no se usan por ahora)
app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((wc,perm,cb)=>cb(['media','notifications','clipboard-read','fullscreen','geolocation'].includes(perm)));
  const tpl=[...(process.platform==='darwin'?[{label:'Ondi',submenu:[{role:'about',label:'Acerca de Ondi'},{type:'separator'},{role:'hide',label:'Ocultar'},{role:'quit',label:'Salir'}]}]:[]),
    {label:'Edición',submenu:[{role:'undo',label:'Deshacer'},{role:'redo',label:'Rehacer'},{type:'separator'},{role:'cut',label:'Cortar'},{role:'copy',label:'Copiar'},{role:'paste',label:'Pegar'},{role:'selectAll',label:'Seleccionar todo'}]},
    {label:'Ver',submenu:[{role:'reload',label:'Recargar'},{role:'resetZoom',label:'Tamaño normal'},{role:'zoomIn',label:'Agrandar'},{role:'zoomOut',label:'Achicar'},{type:'separator'},{role:'togglefullscreen',label:'Pantalla completa'}]},
    {label:'Ventana',submenu:[{role:'minimize',label:'Minimizar'},{role:'close',label:'Cerrar'}]}];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
  crear();
  app.on('activate',()=>{if(!win)crear()});
});
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
