(()=>{
const scanIds=new Set(['findLocScanInput','findNeedScanInput']);
const AudioCtx=window.AudioContext||window.webkitAudioContext;
const originalOk=typeof window.playScanBeep==='function'?window.playScanBeep.bind(window):()=>{};
const originalErr=typeof window.playScanErrorBeep==='function'?window.playScanErrorBeep.bind(window):()=>{};
const originalHit=typeof window.playFindHitBeep==='function'?window.playFindHitBeep.bind(window):()=>{};
let findAudioCtx=null;
let findSoundWindowUntil=0;
let poolReady=false;
const poolIndex={ok:0,err:0,hit:0};
const audioPools={ok:[],err:[],hit:[]};
const objectUrls=[];

const sequences={
  ok:[
    {freq:820,start:0,dur:.10,amp:.78},
    {freq:1180,start:.11,dur:.11,amp:.82},
    {freq:1560,start:.23,dur:.14,amp:.86}
  ],
  err:[
    {freq:560,start:0,dur:.21,amp:1},{freq:1120,start:0,dur:.21,amp:1},{freq:2240,start:0,dur:.21,amp:.64},
    {freq:470,start:.24,dur:.22,amp:1},{freq:940,start:.24,dur:.22,amp:1},{freq:1880,start:.24,dur:.22,amp:.68},
    {freq:390,start:.49,dur:.25,amp:1},{freq:780,start:.49,dur:.25,amp:1},{freq:1560,start:.49,dur:.25,amp:.72},
    {freq:320,start:.77,dur:.34,amp:1},{freq:640,start:.77,dur:.34,amp:1},{freq:1280,start:.77,dur:.34,amp:.78}
  ],
  hit:[
    {freq:720,start:0,dur:.18,amp:.84},{freq:1440,start:0,dur:.18,amp:1},{freq:2880,start:0,dur:.18,amp:.62},
    {freq:880,start:.20,dur:.18,amp:.88},{freq:1760,start:.20,dur:.18,amp:1},{freq:3520,start:.20,dur:.18,amp:.60},
    {freq:1080,start:.40,dur:.18,amp:.90},{freq:2160,start:.40,dur:.18,amp:1},{freq:4320,start:.40,dur:.18,amp:.56},
    {freq:1380,start:.61,dur:.27,amp:.96},{freq:2760,start:.61,dur:.27,amp:1},{freq:4140,start:.61,dur:.27,amp:.50}
  ]
};

function writeAscii(view,offset,text){
  for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));
}
function makeWavUrl(kind){
  const sampleRate=44100;
  const seq=sequences[kind]||sequences.ok;
  const duration=Math.max(...seq.map(x=>x.start+x.dur))+.06;
  const samples=Math.ceil(duration*sampleRate);
  const buffer=new ArrayBuffer(44+samples*2);
  const view=new DataView(buffer);
  writeAscii(view,0,'RIFF');
  view.setUint32(4,36+samples*2,true);
  writeAscii(view,8,'WAVE');
  writeAscii(view,12,'fmt ');
  view.setUint32(16,16,true);
  view.setUint16(20,1,true);
  view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*2,true);
  view.setUint16(32,2,true);
  view.setUint16(34,16,true);
  writeAscii(view,36,'data');
  view.setUint32(40,samples*2,true);
  for(let i=0;i<samples;i++){
    const t=i/sampleRate;
    let value=0;
    for(const tone of seq){
      const local=t-tone.start;
      if(local<0||local>tone.dur)continue;
      const attack=Math.min(1,local/(kind==='hit'?.005:kind==='err'?.003:.008));
      const release=Math.min(1,(tone.dur-local)/(kind==='hit'?.03:kind==='err'?.035:.025));
      const env=Math.max(0,Math.min(attack,release));
      value+=Math.sin(2*Math.PI*tone.freq*local)*tone.amp*env;
    }
    value=kind==='hit'?Math.tanh(value*1.45):kind==='err'?Math.tanh(value*2.20):Math.max(-1,Math.min(1,value));
    view.setInt16(44+i*2,Math.round(value*32767),true);
  }
  const url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
  objectUrls.push(url);
  return url;
}
function buildPools(){
  if(poolReady)return;
  poolReady=true;
  for(const kind of ['ok','err','hit']){
    const src=makeWavUrl(kind);
    for(let i=0;i<8;i++){
      const audio=new Audio(src);
      audio.preload='auto';
      audio.volume=1;
      audio.load();
      audioPools[kind].push(audio);
    }
  }
}
async function ensureContext(){
  if(!AudioCtx)return null;
  if(!findAudioCtx||findAudioCtx.state==='closed'){
    try{findAudioCtx=new AudioCtx({latencyHint:'interactive'})}catch(e){findAudioCtx=new AudioCtx()}
  }
  if(findAudioCtx.state==='suspended'){
    try{await findAudioCtx.resume()}catch(e){}
  }
  return findAudioCtx&&findAudioCtx.state==='running'?findAudioCtx:null;
}
function webAudioBackup(kind){
  Promise.resolve(ensureContext()).then(ctx=>{
    if(!ctx)return;
    const seq=sequences[kind]||sequences.ok;
    const base=ctx.currentTime+.012;
    const backupGain=kind==='hit'?.34:kind==='err'?.56:.24;
    for(const tone of seq){
      const o=ctx.createOscillator();
      const g=ctx.createGain();
      o.type=kind==='err'?'sawtooth':kind==='hit'?'sawtooth':'triangle';
      o.frequency.setValueAtTime(tone.freq,base+tone.start);
      g.gain.setValueAtTime(.0001,base+tone.start);
      g.gain.exponentialRampToValueAtTime(backupGain,base+tone.start+.004);
      g.gain.exponentialRampToValueAtTime(.0001,base+tone.start+tone.dur);
      o.connect(g);g.connect(ctx.destination);
      o.start(base+tone.start);
      o.stop(base+tone.start+tone.dur+.025);
    }
  }).catch(()=>{});
}
function playPool(kind){
  buildPools();
  const pool=audioPools[kind]||audioPools.ok;
  const idx=poolIndex[kind]%pool.length;
  poolIndex[kind]=(idx+1)%pool.length;
  const audio=pool[idx];
  try{audio.pause();audio.currentTime=0}catch(e){}
  let result;
  try{result=audio.play()}catch(e){result=Promise.reject(e)}
  let backupDone=false;
  const backup=()=>{if(backupDone)return;backupDone=true;webAudioBackup(kind)};
  Promise.resolve(result).catch(backup);
  setTimeout(backup,25);
}
function primeFindSound(){
  buildPools();
  ensureContext();
}
function inFindScanWindow(){return Date.now()<=findSoundWindowUntil}
function markFindScan(){findSoundWindowUntil=Date.now()+900;primeFindSound()}

window.playKiemDoOkBeep=()=>playPool('ok');
window.playKiemDoErrorBeep=()=>playPool('err');
window.playKiemDoHitBeep=()=>playPool('hit');
window.primeKiemDoSound=primeFindSound;

window.playScanBeep=function(){
  if(inFindScanWindow())return window.playKiemDoOkBeep();
  return originalOk();
};
window.playScanErrorBeep=function(){
  if(inFindScanWindow())return window.playKiemDoErrorBeep();
  return originalErr();
};
window.playFindHitBeep=function(){
  if(inFindScanWindow())return window.playKiemDoHitBeep();
  return originalHit();
};
try{playScanBeep=window.playScanBeep;playScanErrorBeep=window.playScanErrorBeep;playFindHitBeep=window.playFindHitBeep}catch(e){}

document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&scanIds.has(e.target&&e.target.id))markFindScan();
},true);
document.addEventListener('focusin',e=>{
  if(scanIds.has(e.target&&e.target.id))primeFindSound();
},true);
document.addEventListener('pointerdown',e=>{
  if(scanIds.has(e.target&&e.target.id))primeFindSound();
},true);
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)primeFindSound();
});
window.addEventListener('pageshow',primeFindSound);
window.addEventListener('beforeunload',()=>objectUrls.forEach(url=>URL.revokeObjectURL(url)));
})();
