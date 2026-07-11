(()=>{
const byId=id=>document.getElementById(id);
if(!byId('scanPage')||!byId('hangtraPage'))return;

/* QUET MA: direct input above scanned list */
const scanTableBox=byId('scanBody')?.closest('.scanTableBox');
if(scanTableBox&&!byId('scanDirectBar')){
  const bar=document.createElement('div');
  bar.id='scanDirectBar';
  bar.className='scanDirectBar';
  bar.innerHTML='<label for="scanDirectInput">Nhập/Quét mã</label><input id="scanDirectInput" type="text" placeholder="Quét mã rồi Enter ghi ngay" autocomplete="off" autocapitalize="characters" spellcheck="false">';
  scanTableBox.parentNode.insertBefore(bar,scanTableBox);
}
const oldScanInputBtn=byId('scanInputBtn');
if(oldScanInputBtn)oldScanInputBtn.remove();

const style=document.createElement('style');
style.textContent=`
#scanPage .scanDirectBar{display:flex;gap:8px;align-items:center;padding:8px 10px;border:1px solid #b9c7d6;border-bottom:0;background:#eef7ff;border-radius:8px 8px 0 0}
#scanPage .scanDirectBar label{font-size:17px;font-weight:900;color:#064c83;white-space:nowrap}
#scanPage #scanDirectInput{flex:1;min-width:220px;height:42px;font-size:22px;font-weight:800;color:#c1121f;border:2px solid #3483c9;padding:6px 10px}
#scanPage .scanTableBox{height:calc(100vh - 335px)}
@media(max-width:760px){#scanPage .scanDirectBar{padding:6px;gap:6px;flex-wrap:wrap}#scanPage .scanDirectBar label{font-size:15px}#scanPage #scanDirectInput{width:100%;min-width:0;height:42px;font-size:20px}}
`;
document.head.appendChild(style);

let scanDirectQueue=Promise.resolve();
function focusScanDirect(){setTimeout(()=>{try{byId('scanDirectInput')?.focus()}catch(e){}},30)}
function submitScanDirect(){
  const inp=byId('scanDirectInput');
  if(!inp)return;
  if(typeof canEdit==='function'&&!canEdit()){inp.value='';return}
  if(typeof isScanNoticeBlocked==='function'&&isScanNoticeBlocked()){
    inp.value='';
    try{scanBlockedAttemptBeep()}catch(e){}
    focusScanDirect();
    return;
  }
  const code=String(inp.value||'').trim();
  if(!code)return;
  inp.value='';
  focusScanDirect();
  scanDirectQueue=scanDirectQueue.then(async()=>{
    try{await addOneScanCode(code,false)}catch(e){
      try{setMsg(`Lỗi quét mã: ${e?.message||e}`,true)}catch(er){}
    }
  });
}
const directInput=byId('scanDirectInput');
if(directInput){
  directInput.addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;
    e.preventDefault();
    e.stopPropagation();
    submitScanDirect();
  },true);
}

const prevRenderScanPermissionUI=typeof window.renderScanPermissionUI==='function'?window.renderScanPermissionUI:null;
window.renderScanPermissionUI=function(){
  if(prevRenderScanPermissionUI)prevRenderScanPermissionUI();
  const inp=byId('scanDirectInput');
  if(inp)inp.disabled=typeof canEdit==='function'?!canEdit():false;
};
try{renderScanPermissionUI=window.renderScanPermissionUI}catch(e){}
try{window.renderScanPermissionUI()}catch(e){}

/* Loud success beep only for QUET MA and HANG TRA */
const previousScanBeep=typeof window.playScanBeep==='function'?window.playScanBeep.bind(window):()=>{};
const AudioCtx=window.AudioContext||window.webkitAudioContext;
let loudCtx=null;
let loudPoolReady=false;
let loudPoolIndex=0;
const loudPool=[];
let loudObjectUrl='';

function writeAscii(view,offset,text){for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))}
function buildLoudScanWav(){
  const sampleRate=44100;
  const tones=[
    {freq:980,start:0,dur:.12,amp:1},
    {freq:1320,start:.13,dur:.11,amp:.96}
  ];
  const duration=.30;
  const samples=Math.ceil(duration*sampleRate);
  const buffer=new ArrayBuffer(44+samples*2);
  const view=new DataView(buffer);
  writeAscii(view,0,'RIFF');view.setUint32(4,36+samples*2,true);writeAscii(view,8,'WAVE');writeAscii(view,12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);writeAscii(view,36,'data');view.setUint32(40,samples*2,true);
  for(let i=0;i<samples;i++){
    const t=i/sampleRate;
    let value=0;
    for(const tone of tones){
      const local=t-tone.start;
      if(local<0||local>tone.dur)continue;
      const attack=Math.min(1,local/.004),release=Math.min(1,(tone.dur-local)/.02),env=Math.max(0,Math.min(attack,release));
      value+=Math.sin(2*Math.PI*tone.freq*local)*tone.amp*env;
    }
    value=Math.tanh(value*2.35);
    view.setInt16(44+i*2,Math.round(value*32767),true);
  }
  return URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
}
function buildLoudPool(){
  if(loudPoolReady)return;
  loudPoolReady=true;
  loudObjectUrl=buildLoudScanWav();
  for(let i=0;i<8;i++){
    const audio=new Audio(loudObjectUrl);
    audio.preload='auto';audio.volume=1;audio.load();loudPool.push(audio);
  }
}
async function ensureLoudCtx(){
  if(!AudioCtx)return null;
  if(!loudCtx||loudCtx.state==='closed'){
    try{loudCtx=new AudioCtx({latencyHint:'interactive'})}catch(e){loudCtx=new AudioCtx()}
  }
  if(loudCtx.state==='suspended'){try{await loudCtx.resume()}catch(e){}}
  return loudCtx&&loudCtx.state==='running'?loudCtx:null;
}
function loudWebAudioBackup(){
  Promise.resolve(ensureLoudCtx()).then(ctx=>{
    if(!ctx)return;
    const t=ctx.currentTime+.008;
    const make=(freq,start,dur,gain)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='square';o.frequency.setValueAtTime(freq,t+start);g.gain.setValueAtTime(.0001,t+start);g.gain.exponentialRampToValueAtTime(gain,t+start+.004);g.gain.exponentialRampToValueAtTime(.0001,t+start+dur);o.connect(g);g.connect(ctx.destination);o.start(t+start);o.stop(t+start+dur+.02);
    };
    make(980,0,.12,.54);make(1320,.13,.11,.50);
  }).catch(()=>{});
}
function playLoudScanBeep(){
  buildLoudPool();
  ensureLoudCtx();
  const audio=loudPool[loudPoolIndex%loudPool.length];
  loudPoolIndex=(loudPoolIndex+1)%loudPool.length;
  try{audio.pause();audio.currentTime=0}catch(e){}
  try{Promise.resolve(audio.play()).catch(()=>loudWebAudioBackup())}catch(e){loudWebAudioBackup()}
  setTimeout(loudWebAudioBackup,22);
}
function isLoudTab(){
  try{return state&&['quetma','hangtra'].includes(state.activeTab)}catch(e){return false}
}
window.playScanBeep=function(){
  if(isLoudTab())return playLoudScanBeep();
  return previousScanBeep();
};
try{playScanBeep=window.playScanBeep}catch(e){}

['focusin','pointerdown'].forEach(type=>document.addEventListener(type,e=>{
  if(e.target&&e.target.id==='scanDirectInput'){buildLoudPool();ensureLoudCtx()}
},true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isLoudTab()){buildLoudPool();ensureLoudCtx()}});
window.addEventListener('beforeunload',()=>{if(loudObjectUrl)URL.revokeObjectURL(loudObjectUrl)});
})();
