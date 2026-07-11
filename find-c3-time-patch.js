(()=>{
const byId=id=>document.getElementById(id);
if(!byId('findPage'))return;

window.renderFindNeeds=function(){
  const body=byId('findNeedBody');
  if(!body)return;
  const rows=findSortRows(state.find.needs);
  body.innerHTML=rows.map((r,i)=>{
    const area=findAreaText(r.code);
    const cls=area?'findHitRow':'findMissingRow';
    const timeHtml=r.createdAt?escapeHtml(new Date(r.createdAt).toLocaleString('vi-VN')):'';
    return `<tr class="${cls}" data-find-need="${escapeAttr(r.id)}"><td>${i+1}</td><td class="findCodeCell">${escapeHtml(r.code||'')}</td><td class="findAreaCell">${area?`<span class="findAreaBadge">${escapeHtml(area)}</span>`:'Chưa có'}</td><td class="findTimeCell">${timeHtml}</td><td>${canEdit()?`<button class="danger" data-find-delete-need="${escapeAttr(r.id)}">Xóa</button>`:''}</td></tr>`;
  }).join('')||'<tr><td colspan="5" class="findEmpty">Chưa có mã cần tìm.</td></tr>';
};

window.addFindLocationCode=async function(code,area,source='Quét mã',quiet=false){
  if(!canEdit()){
    if(!quiet)alert('Tài khoản chỉ xem không được thao tác.');
    return {ok:false,reason:'view'};
  }
  const a=cleanCode(area);
  if(!a){
    if(!quiet){
      playScanErrorBeep();
      showScanBigNotice('CHƯA CHỌN KHU\nHãy chọn khu trước khi quét mã.','err',3500,{lock:false});
    }
    return {ok:false,reason:'Chưa chọn khu',code:findClean(code)};
  }
  const v=findValidateCodeInMaster(code);
  if(!v.ok){
    if(!quiet){
      playScanErrorBeep();
      showScanBigNotice(`KHÔNG CÓ MÃ\n${findClean(code)}\n${v.reason}`,'err',4500,{lock:false});
    }
    return {ok:false,reason:v.reason,code:findClean(code)};
  }
  const clean=v.code;
  const dup=findLocationDuplicate(clean);
  if(dup){
    const oldArea=cleanCode(dup.area)||'KHÔNG RÕ';
    if(!quiet){
      playScanErrorBeep();
      showScanBigNotice(`TRÙNG MÃ CỘT 2\n${clean}\nMã này đang ở khu ${oldArea}.`,'err',4500,{lock:false});
    }
    return {ok:false,reason:`Đã ở khu ${oldArea}`,code:clean,area:oldArea};
  }
  const key=pushKey(`${findDayPath()}/locations`);
  const row={code:clean,area:a,source,createdAt:nowStamp(),createdBy:appUser?.name||'',updatedAt:nowStamp(),updatedBy:appUser?.name||''};
  const hits=(state.find.needs||[]).filter(n=>findClean(n.code)===clean);
  await fbSet(`${findDayPath()}/locations/${key}`,row);
  state.find.locations.unshift({...row,id:key});
  renderFindAll();
  if(hits.length){
    if(!quiet){
      playFindHitBeep();
      showScanBigNotice(`GẶP MÃ CẦN TÌM\n${clean}\nKhu ${a} - bỏ riêng ra rổ.`,'ok',5200,{lock:false});
    }
    return {ok:true,hit:true,code:clean,area:a};
  }
  if(!quiet){
    playScanBeep();
    showScanBigNotice(`ĐÃ GHI VỊ TRÍ\n${clean}\nKhu ${a}`,'ok',1800,{lock:false});
  }
  return {ok:true,hit:false,code:clean,area:a};
};

const needPanel=byId('findPage')?.querySelectorAll('.findGrid>.findPanel')?.[2];
if(needPanel){
  const heads=needPanel.querySelectorAll('thead th');
  if(heads[3])heads[3].textContent='Thời gian';
}
renderFindNeeds();
})();
