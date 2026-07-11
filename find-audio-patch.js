(()=>{
const scanIds=new Set(['findLocScanInput','findNeedScanInput']);
const AudioCtx=window.AudioContext||window.webkitAudioContext;
let findAudioCtx=null;
let primed=false;

async function ensureFindAudio(){
  if(!AudioCtx)return null;
  if(!findAudioCtx||findAudioCtx.state==='closed'){
    try{findAudioCtx=new AudioCtx({latencyHint:'interactive'})}catch(e){findAudioCtx=new AudioCtx()}
  }
  if(findAudioCtx.state==='suspended'){
    try{await findAudioCtx.resume()}catch(e){}
  }
  return findAudioCtx&&findAudioCtx.state==='running'?findAudioCtx:null;
}

function scheduleSequence(ctx,kind){
  const seq=kind==='err'
    ? [[340,0,0.17,0.5,'square'],[240,0.20,0.23,0.5,'square']]
    : kind==='hit'
      ? [[900,0,0.10,0.46,'triangle'],[1320,0.12,0.10,0.46,'triangle'],[1760,0.24,0.14,0.46,'triangle']]
      : [[980,0,0.10,0.42,'sine'],[1360,0.11,0.10,0.36,'sine']];
  const t=ctx.currentTime+0.018;
  seq.forEach(([freq,start,dur,gain,type])=>{
    const o=ctx.createOscillator();
    const g=ctx.createGain();
    o.type=type;
    o.frequency.setValueAtTime(freq,t+start);
    g.gain.setValueAtTime(0.0001,t+start);
    g.gain.exponentialRampToValueAtTime(gain,t+start+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t+start+dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t+start);
    o.stop(t+start+dur+0.025);
  });
}

async function primeFindAudio(){
  const ctx=await ensureFindAudio();
  if(!ctx||primed)return !!ctx;
  try{
    const o=ctx.createOscillator();
    const g=ctx.createGain();
    const t=ctx.currentTime+0.005;
    g.gain.setValueAtTime(0.0001,t);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t+0.012);
    primed=true;
  }catch(e){}
  return true;
}

function playFindReliable(kind='ok',attempt=0){
  Promise.resolve(ensureFindAudio()).then(ctx=>{
    if(!ctx){
      if(attempt<2)setTimeout(()=>playFindReliable(kind,attempt+1),55);
      return;
    }
    try{scheduleSequence(ctx,kind)}catch(e){
      if(attempt<2)setTimeout(()=>playFindReliable(kind,attempt+1),55);
    }
  }).catch(()=>{
    if(attempt<2)setTimeout(()=>playFindReliable(kind,attempt+1),55);
  });
}

window.playScanBeep=()=>playFindReliable('ok');
window.playScanErrorBeep=()=>playFindReliable('err');
window.playFindHitBeep=()=>playFindReliable('hit');
try{playScanBeep=window.playScanBeep;playScanErrorBeep=window.playScanErrorBeep;playFindHitBeep=window.playFindHitBeep}catch(e){}

const primeFromEvent=e=>{
  const id=e.target&&e.target.id;
  if(scanIds.has(id)||e.type==='pointerdown')primeFindAudio();
};
document.addEventListener('pointerdown',primeFromEvent,true);
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&scanIds.has(e.target&&e.target.id))primeFindAudio();
},true);
document.addEventListener('focusin',e=>{
  if(scanIds.has(e.target&&e.target.id))primeFindAudio();
},true);
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)primeFindAudio();
});
window.addEventListener('pageshow',primeFindAudio);
})();
