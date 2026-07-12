(()=>{
const byId=id=>document.getElementById(id);
if(!byId('findPage'))return;

let repeatHitTimer=null;

function clean(v){
  try{return findClean(v)}catch(e){return String(v||'').trim().toUpperCase()}
}

function findRepeatHit(code){
  const c=clean(code);
  if(!c)return null;
  const loc=(state.find.locations||[]).find(r=>clean(r.code)===c);
  if(!loc)return null;
  const need=(state.find.needs||[]).find(r=>clean(r.code)===c);
  if(!need)return null;
  return {code:c,area:clean(loc.area)||'KHÔNG RÕ'};
}

function showRepeatHit(hit){
  const current=byId('findFastNotice');
  const notice=current?current.cloneNode(false):document.createElement('div');
  if(current)current.replaceWith(notice);
  else document.body.appendChild(notice);
  notice.id='findFastNotice';
  notice.className='findFastNotice hit';
  notice.innerHTML=`<div class="findFastNoticeTitle">GẶP MÃ CẦN TÌM</div><div class="findFastNoticeCode">${escapeHtml(hit.code)}</div><div class="findFastNoticeDetail">Khu ${escapeHtml(hit.area)} - bỏ riêng ra rổ</div>`;
  notice.classList.remove('hidden');
  if(repeatHitTimer)clearTimeout(repeatHitTimer);
  repeatHitTimer=setTimeout(()=>notice.classList.add('hidden'),3400);
}

document.addEventListener('keydown',e=>{
  const target=e.target;
  if(e.key!=='Enter'||!target||target.id!=='findLocScanInput')return;
  const hit=findRepeatHit(target.value);
  if(!hit)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  target.value='';
  try{target.focus()}catch(err){}
  try{playFindHitBeep()}catch(err){}
  showRepeatHit(hit);
},true);
})();
