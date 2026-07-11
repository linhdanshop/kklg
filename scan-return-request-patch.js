(()=>{
const byId=id=>document.getElementById(id);
if(!byId('scanPage')||!byId('hangtraPage'))return;

/* QUET MA: direct input above scanned list, kept in same right column */
const scanTableBox=byId('scanBody')?.closest('.scanTableBox');
if(scanTableBox&&!byId('scanDirectBar')){
  const oldParent=scanTableBox.parentNode;
  const workArea=document.createElement('div');
  workArea.id='scanWorkArea';
  workArea.className='scanWorkArea';
  oldParent.insertBefore(workArea,scanTableBox);

  const bar=document.createElement('div');
  bar.id='scanDirectBar';
  bar.className='scanDirectBar';
  bar.innerHTML='<label for="scanDirectInput">Nhập/Quét mã</label><input id="scanDirectInput" type="text" placeholder="Quét mã rồi Enter ghi ngay" autocomplete="off" autocapitalize="characters" spellcheck="false">';
  workArea.appendChild(bar);
  workArea.appendChild(scanTableBox);
}
const oldScanInputBtn=byId('scanInputBtn');
if(oldScanInputBtn)oldScanInputBtn.remove();

const style=document.createElement('style');
style.textContent=`
#scanPage .scanWorkArea{min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;align-self:stretch}
#scanPage .scanDirectBar{display:flex;gap:8px;align-items:center;flex:0 0 auto;padding:8px 10px;border:1px solid #b9c7d6;border-bottom:0;background:#eef7ff;border-radius:8px 8px 0 0}
#scanPage .scanDirectBar label{font-size:17px;font-weight:900;color:#064c83;white-space:nowrap}
#scanPage #scanDirectInput{flex:1;min-width:220px;height:42px;font-size:22px;font-weight:800;color:#c1121f;border:2px solid #3483c9;padding:6px 10px}
#scanPage .scanWorkArea>.scanTableBox{height:calc(100vh - 335px);min-height:0;flex:1;width:100%}
@media(max-width:760px){#scanPage .scanDirectBar{padding:6px;gap:6px;flex-wrap:wrap}#scanPage .scanDirectBar label{font-size:15px}#scanPage #scanDirectInput{width:100%;min-width:0;height:42px;font-size:20px}#scanPage .scanWorkArea>.scanTableBox{height:360px;min-height:320px}}
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

/* QUET MA + HANG TRA use exactly the same OK/ERROR sounds as KIEM DO */
const previousScanBeep=typeof window.playScanBeep==='function'?window.playScanBeep.bind(window):()=>{};
const previousScanErrorBeep=typeof window.playScanErrorBeep==='function'?window.playScanErrorBeep.bind(window):()=>{};
function isSharedSoundTab(){
  try{return state&&['quetma','hangtra'].includes(state.activeTab)}catch(e){return false}
}
function playSharedOk(){
  if(typeof window.playKiemDoOkBeep==='function')return window.playKiemDoOkBeep();
  return previousScanBeep();
}
function playSharedError(){
  if(typeof window.playKiemDoErrorBeep==='function')return window.playKiemDoErrorBeep();
  return previousScanErrorBeep();
}
window.playScanBeep=function(){
  if(isSharedSoundTab())return playSharedOk();
  return previousScanBeep();
};
window.playScanErrorBeep=function(){
  if(isSharedSoundTab())return playSharedError();
  return previousScanErrorBeep();
};
try{playScanBeep=window.playScanBeep;playScanErrorBeep=window.playScanErrorBeep}catch(e){}

const sharedInputs=new Set(['scanDirectInput','retQuickInput']);
['focusin','pointerdown'].forEach(type=>document.addEventListener(type,e=>{
  if(sharedInputs.has(e.target&&e.target.id)&&typeof window.primeKiemDoSound==='function')window.primeKiemDoSound();
},true));
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&sharedInputs.has(e.target&&e.target.id)&&typeof window.primeKiemDoSound==='function')window.primeKiemDoSound();
},true);
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&isSharedSoundTab()&&typeof window.primeKiemDoSound==='function')window.primeKiemDoSound();
});
})();
