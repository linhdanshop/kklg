(()=>{
const byId=id=>document.getElementById(id);
if(!byId('findPage'))return;

const pendingLocCodes=new Set();
const pendingNeedCodes=new Set();
let findNoticeTimer=null;
let findNoticeLockUntil=0;
let findNoticePriority=0;

const areaNorm=v=>cleanCode(v);
const areaPath=()=>`${findBasePath()}/areas`;

// Fixed locations path (persistent across dates)
function findFixedPath(){return `${findBasePath()}/fixedLocations`}

// Load fixed locations and merge into state.find.locations (preserve fixed priority)
async function loadFixedAndMerge(){
  try{
    const fixedRaw=await fbGet(findFixedPath()).catch(()=>null)||{};
    const fixedArr=Object.entries(fixedRaw||{}).map(([id,v])=>({...v,id,type:'fixed'}));
    const fixedMap=new Set(fixedArr.map(r=>findClean(r.code)));
    state.find.fixedLocations=fixedArr;
    // If state.find.locations already contains daily from loadFindDay, merge preserving fixed-first, and avoid duplicates
    const dailyArr=(state.find.locations||[]).filter(r=>r.type!=='fixed');
    const dailyFiltered=dailyArr.filter(r=>!fixedMap.has(findClean(r.code))).map(r=>({...r,type:r.type||'daily'}));
    state.find.locations=[...fixedArr,...dailyFiltered];
    renderFindLocations();
    renderFindStats();
  }catch(e){console.warn('loadFixedAndMerge error',e)}
}

// If original loadFindDay exists, wrap it to also load fixed after
if(typeof loadFindDay==='function'){
  const OLD_loadFindDay=loadFindDay;
  loadFindDay=async function(){
    await OLD_loadFindDay.apply(this,arguments);
    await loadFixedAndMerge();
  }
} else {
  // attempt initial load
  setTimeout(()=>loadFixedAndMerge(),300);
}

function areaStyleFast(area){
  const palette=[['#e8f1ff','#134e8e'],['#fff0e5','#9a4b00'],['#edf9e8','#286317'],['#f4eaff','#6b2ca0'],['#ffeaf1','#9b244d'],['#e7f8f7','#0f6d68'],['#fff8d9','#7a5b00'],['#eef0ff','#4046a3'],['#f6ecdf','#6b2a00'],['#fff8f0','#7a2c4a']];
  const t=areaNorm(area)||'-';let h=0;
  for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))>>>0;
  const p=palette[h%palette.length];
  return `background:${p[0]};color:${p[1]};border-color:${p[1]}55`;
}
function ensureFindNotice(){
  let el=byId('findFastNotice');
  if(el)return el;
  el=document.createElement('div');
  el.id='findFastNotice';
  el.className='findFastNotice hidden';
  document.body.appendChild(el);
  return el;
}
function showFindNotice(type,title,code,detail='',duration=1100){
  const now=Date.now();
  const priority=type==='hit'?3:type==='err'?2:1;
  if(now<findNoticeLockUntil&&priority<findNoticePriority)return;
  const el=ensureFindNotice();
  findNoticePriority=priority;
  findNoticeLockUntil=type==='hit'?now+3400:0;
  el.className=`findFastNotice ${type}`;
  el.innerHTML=`<div class="findFastNoticeTitle">${escapeHtml(title)}</div><div class="findFastNoticeCode">${escapeHtml(code||'')}</div>${detail?`<div class="findFastNoticeDetail">${escapeHtml(detail)}</div>`:''}`;
  el.classList.remove('hidden');
  if(findNoticeTimer)clearTimeout(findNoticeTimer);
  findNoticeTimer=setTimeout(()=>{
    el.classList.add('hidden');
    findNoticePriority=0;
    findNoticeLockUntil=0;
  },duration);
}
function renderFastWork(){
  renderFindStats();
  renderFindLocations();
  renderFindNeeds();
  renderFindPermissionUI();
}
function renderAreasFast(){
  const sel=byId('findAreaSelect');
  if(!sel)return;
  const old=areaNorm(sel.value);
  const rows=[...new Set((state.find.areas||[]).map(areaNorm).filter(Boolean))];
  sel.innerHTML=rows.map(a=>`<option value="${escapeAttr(a)}">${escapeHtml(a)}</option>`).join('')||'<option value="">-- Chưa có khu --</option>';
  sel.value=rows.includes(old)?old:(rows[0]||'');
}
async function saveAreasFast(){
  const items={};
  (state.find.areas||[]).map(areaNorm).filter(Boolean).forEach((name,i)=>items[codeKey(name)]={name,order:i+1,updatedAt:nowStamp(),updatedBy:appUser?.name||''});
  await fbSet(areaPath(),{configured:true,items,updatedAt:nowStamp(),updatedBy:appUser?.name||''});
}
async function addAreaFast(){
  if(!isAdmin())return alert('Chỉ Admin được tạo khu.');
  const name=areaNorm(prompt('Nhập tên khu mới. Ví dụ: A, B, C hoặc 1, 2, 3:',''));
  if(!name)return;
  if((state.find.areas||[]).some(a=>areaNorm(a)===name)){
    renderAreasFast();
    byId('findAreaSelect').value=name;
    return alert(`Khu ${name} đã có.`);
  }
  state.find.areas=[...(state.find.areas||[]),name];
  await saveAreasFast();
  renderAreasFast();
  byId('findAreaSelect').value=name;
  setMsg(`Đã tạo khu ${name}.`);
}
async function deleteAreaFast(){
  if(!isAdmin())return alert('Chỉ Admin được xóa khu.');
  const name=areaNorm(byId('findAreaSelect')?.value);
  if(!name)return alert('Chưa chọn khu để xóa.');
  const used=(state.find.locations||[]).filter(r=>areaNorm(r.area)===name).length;
  if(!confirm(`Xóa khu ${name} khỏi danh sách khu mặc định?${used?` Có ${vnNum(used)} dòng cột 2 đang ghi khu này; dữ liệu dòng vẫn giữ.`:''}`))return;
  state.find.areas=(state.find.areas||[]).filter(a=>areaNorm(a)!==name);
  await saveAreasFast();
  renderAreasFast();
  setMsg(`Đã xóa khu ${name} khỏi danh sách khu mặc định.`);
}

// Bulk add locations (supports type 'daily' or 'fixed')
window.addManyFindLocations=async function(rows, area, source='Up file', type='daily'){
  if(!canEdit())return alert('Tài khoản chỉ xem không được thao tác.');
  rows = rows||[];
  let total=rows.length, added=0, existed=0;
  const fixedRaw=await fbGet(findFixedPath()).catch(()=>null)||{};
  const fixedSet=new Set(Object.values(fixedRaw||{}).map(v=>findClean(typeof v==='string'?v:v.code)));
  // load today's daily map
  const todayLocRaw=await fbGet(`${findDayPath()}/locations`).catch(()=>null)||{};
  const dailySet=new Set(Object.values(todayLocRaw||{}).map(v=>findClean(v.code)));
  for(const r of rows){
    const code=findClean(r.code||r);
    const a=areaNorm(r.area||area);
    if(!code)continue;
    if(type==='fixed'){
      if(fixedSet.has(code)){existed++;continue}
      const id=codeKey(code);
      const entry={code,area:a,source,createdAt:nowStamp(),createdBy:appUser?.name||''};
      try{await fbSet(`${findFixedPath()}/${id}`,entry);added++;fixedSet.add(code);}catch(e){console.warn('fixed write fail',e)}
    } else {
      // daily
      if(fixedSet.has(code)||dailySet.has(code)){existed++;continue}
      const key=pushKey(`${findDayPath()}/locations`);
      const entry={code,area:a,source,createdAt:nowStamp(),createdBy:appUser?.name||'',updatedAt:nowStamp(),updatedBy:appUser?.name||''};
      try{await fbSet(`${findDayPath()}/locations/${key}`,entry);added++;dailySet.add(code);}catch(e){console.warn('daily write fail',e)}
    }
  }
  setMsg(`Upload: Đã đọc ${vnNum(total)} mã; Thêm ${vnNum(added)}; Đã tồn tại ${vnNum(existed)}`);
  await loadFixedAndMerge();
  return {total,added,existed};
}

// Export displayed locations (fixed + today's daily)
window.exportFindLocationsDisplayed=function(){
  const rows=state.find.locations||[];
  const aoa=[['STT','Mã','Khu','Loại','Thời gian']];
  rows.forEach((r,i)=>{
    const time=(r.createdAt||r.updatedAt||'');
    aoa.push([i+1,r.code,r.area,r.type==='fixed'?'Cố định':'Hằng ngày',time]);
  });
  const ws=XLSX.utils.aoa_to_sheet(aoa),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Locations');XLSX.writeFile(wb,`kiem_do_locations_${state.dateISO}.xlsx`);
}

// Delete daily & needs for a given month (format YYYY-MM)
window.deleteFindDailyByMonth=async function(month){
  if(!isAdmin())return alert('Chỉ Admin mới được thực hiện.');
  if(!month||!/^[0-9]{4}-[0-9]{2}$/.test(month))return alert('Tháng không hợp lệ (YYYY-MM).');
  if(!confirm(`Xóa dữ liệu Daily và Cần Tìm cho tháng ${month}? Hành động không thể hoàn tác.`))return;
  const [y,m]=month.split('-').map(Number);
  const days=new Date(y,m,0).getDate();
  for(let d=1;d<=days;d++){
    const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    try{await fbSet(`${findBasePath()}/days/${iso}/locations`,null);await fbSet(`${findBasePath()}/days/${iso}/needs`,null);}catch(e){console.warn('deleteFindDailyByMonth failed for',iso,e)}
  }
  setMsg(`Đã xóa dữ liệu Daily và Cần Tìm cho tháng ${month}.`);
}

window.renderFindNeeds=function(){
  const body=byId('findNeedBody');
  if(!body)return;
  const rows=findSortRows(state.find.needs);
  body.innerHTML=rows.map((r,i)=>{
    const area=findAreaText(r.code);
    const cls=area?'findHitRow':'findMissingRow';
    const timeHtml=r.createdAt?escapeHtml(new Date(r.createdAt).toLocaleString('vi-VN')):'';
    return `<tr class="${cls}" data-find-need="${escapeAttr(r.id)}"><td>${i+1}</td><td class="findCodeCell">${escapeHtml(r.code||'')}</td><td class="findAreaCell">${area?`<span class="findAreaBadge" style="${areaStyleFast(area)}">${escapeHtml(area)}</span>`:escapeHtml(r.foundArea||'')}</td><td class="findTimeCell">${timeHtml}</td></tr>`
  }).join('')||'<tr><td colspan="5" class="findEmpty">Chưa có mã cần tìm.</td></tr>';
};

function fastAddLocation(code,area,source='Quét mã',quiet=false){
  if(!canEdit()){
    if(!quiet)alert('Tài khoản chỉ xem không được thao tác.');
    return {ok:false,reason:'view'};
  }
  const a=areaNorm(area);
  const raw=findClean(code);
  if(!a){
    if(!quiet){playScanErrorBeep();showFindNotice('err','CHƯA CHỌN KHU',raw,'Chọn khu trước khi quét',1800)}
    return {ok:false,reason:'Chưa chọn khu',code:raw};
  }
  const v=findValidateCodeInMaster(code);
  if(!v.ok){
    if(!quiet){playScanErrorBeep();showFindNotice('err','KHÔNG CÓ MÃ',raw,v.reason,1900)}
    return {ok:false,reason:v.reason,code:raw};
  }
  const clean=v.code;
  const dup=findLocationDuplicate(clean);
  if(dup||pendingLocCodes.has(clean)){
    const oldArea=areaNorm(dup?.area)||'ĐANG GHI';
    if(!quiet){playScanErrorBeep();showFindNotice('err','TRÙNG MÃ CỘT 2',clean,`Đang ở khu ${oldArea}`,2200)}
    return {ok:false,reason:`Đã ở khu ${oldArea}`,code:clean,area:oldArea};
  }
  const key=pushKey(`${findDayPath()}/locations`);
  const row={code:clean,area:a,source,createdAt:nowStamp(),createdBy:appUser?.name||'',updatedAt:nowStamp(),updatedBy:appUser?.name||''};
  const hits=(state.find.needs||[]).filter(n=>findClean(n.code)===clean);
  pendingLocCodes.add(clean);
  state.find.locations.unshift({...row,id:key});
  renderFastWork();
  if(hits.length){
    if(!quiet){playFindHitBeep();showFindNotice('hit','GẶP MÃ CẦN TÌM',clean,`Khu ${a} - bỏ riêng ra rổ`,3400)}
  }else if(!quiet){
    playScanBeep();
    showFindNotice('ok','ĐÃ GHI VỊ TRÍ',clean,`Khu ${a}`,950);
  }
  Promise.resolve(fbSet(`${findDayPath()}/locations/${key}`,row)).then(()=>{
    pendingLocCodes.delete(clean);
  }).catch(err=>{
    pendingLocCodes.delete(clean);
    state.find.locations=(state.find.locations||[]).filter(r=>r.id!==key);
    renderFastWork();
    playScanErrorBeep();
    showFindNotice('err','LỖI GHI FIREBASE',clean,err?.message||'Không ghi được dữ liệu',3200);
  });
  return {ok:true,hit:!!hits.length,code:clean,area:a};
}

function fastAddNeed(code,source='Quét mã',quiet=false){
  if(!canEdit()){
    if(!quiet)alert('Tài khoản chỉ xem không được thao tác.');
    return {ok:false,reason:'view'};
  }
  const v=findValidateCodeInMaster(code);
  const raw=findClean(code);
  if(!v.ok){
    if(!quiet){playScanErrorBeep();showFindNotice('err','KHÔNG CÓ MÃ',raw,v.reason,1900)}
    return {ok:false,reason:v.reason,code:raw};
  }
  const clean=v.code;
  if((state.find.needs||[]).some(n=>findClean(n.code)===clean)||pendingNeedCodes.has(clean)){
    if(!quiet){playScanErrorBeep();showFindNotice('err','TRÙNG MÃ CẦN TÌM',clean,'Mã đã có trong cột 3',2000)}
    return {ok:false,reason:'Trùng cột 3',code:clean};
  }
  const key=codeKey(clean);
  const row={code:clean,source,createdAt:nowStamp(),createdBy:appUser?.name||''};
  pendingNeedCodes.add(clean);
  state.find.needs.unshift({...row,id:key});
  renderFastWork();
  const area=findAreaText(clean);
  if(!quiet){
    playScanBeep();
    showFindNotice('ok','ĐÃ THÊM CẦN TÌM',clean,area?`Khu chứa ${area}`:'Chưa có vị trí',1100);
  }
  Promise.resolve(fbSet(`${findDayPath()}/needs/${key}`,row)).then(()=>{
    pendingNeedCodes.delete(clean);
  }).catch(err=>{
    pendingNeedCodes.delete(clean);
    state.find.needs=(state.find.needs||[]).filter(r=>r.id!==key);
    renderFastWork();
    playScanErrorBeep();
    showFindNotice('err','LỖI GHI FIREBASE',clean,err?.message||'Không ghi được dữ liệu',3200);
  });
  return {ok:true,code:clean};
}
window.addFindLocationCode=fastAddLocation;
window.addFindNeedCode=fastAddNeed;

window.renderFindPermissionUI=function(){
  const admin=isAdmin(),edit=canEdit();
  ['findMasterInputBtn','findMasterClearBtn','findAreaAddBtn','findAreaDeleteBtn'].forEach(id=>setUnavailable(id,!admin));
  ['findLocImportBtn','findLocClearBtn','findNeedImportBtn','findNeedClearBtn','findLocManualAddBtn','findNeedManualAddBtn'].forEach(id=>setUnavailable(id,!edit));
  ['findLocScanInput','findLocManualInput','findNeedScanInput','findNeedManualInput','findAreaSelect','findLocSearch'].forEach(id=>{const el=byId(id);if(el)el.disabled=!edit});
  setUnavailable('findMasterExportBtn',!(admin||edit||isViewOnly()));
};

function submitLocation(inputId,source){
  const inp=byId(inputId);
  const code=inp?.value||'';
  const area=areaNorm(byId('findAreaSelect')?.value);
  if(!findClean(code))return;
  inp.value='';
  inp.focus();
  fastAddLocation(code,area,source,false);
}
function submitNeed(inputId,source){
  const inp=byId(inputId);
  const code=inp?.value||'';
  if(!findClean(code))return;
  inp.value='';
  inp.focus();
  fastAddNeed(code,source,false);
}
function onEnter(el,fn){
  el?.addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;
    e.preventDefault();
    e.stopPropagation();
    fn();
  });
}
function patchFastUI(){
  const panels=byId('findPage').querySelectorAll('.findGrid>.findPanel');
  if(panels.length<3)return;
  const locTools=panels[1].querySelector('.findPanelTools');
  const needTools=panels[2].querySelector('.findPanelTools');
  locTools.innerHTML=`
    <div class="findFastLine findFastAreaLine"><label>Khu</label><select id="findAreaSelect" class="findAreaSelect"></select><button id="findAreaAddBtn" class="primary">+ Khu</button><button id="findAreaDeleteBtn" class="danger">Xóa khu</button></div>
    <div class="findFastLine"><label>Loại</label><select id="findLocTypeSelect" class="findAreaSelect"><option value="daily">Hằng ngày</option><option value="fixed">Cố định</option></select><button id="findLocExportBtn" class="btn">Xuất Excel</button></div>
    <div class="findFastLine"><label class="findFastLabel scan">Quét mã</label><input id="findLocScanInput" class="findDirectInput findScanOnly" placeholder="Quét mã - Enter ghi ngay" autocomplete="off" autocapitalize="characters"></div>
    <div class="findFastLine"><label class="findFastLabel manual">Nhập tay</label><input id="findLocManualInput" list="findCodeSuggest" class="findDirectInput" placeholder="Nhập mã sản phẩm"></div>
    <div class="findFastLine"><button id="findLocManualAddBtn" class="primary">Thêm</button><button id="findLocImportBtn" class="btn">Up file</button><input id="findLocFileInput" type="file" accept=".xlsx,.xls" style="display:none"></div>
  `;
  needTools.innerHTML=`
    <div class="findFastLine"><label class="findFastLabel scan">Quét mã</label><input id="findNeedScanInput" class="findDirectInput findScanOnly" placeholder="Quét mã - Enter ghi ngay" autocomplete="off" autocapitalize="characters"></div>
    <div class="findFastLine"><label class="findFastLabel manual">Nhập tay</label><input id="findNeedManualInput" list="findCodeSuggest" class="findDirectInput" placeholder="Nhập mã cần tìm"></div>
  `;
  const heads=panels[2].querySelectorAll('thead th');
  if(heads[3])heads[3].textContent='Thời gian';
  const style=document.createElement('style');
  style.textContent=`
    #findPage .findPanelTools{display:block;padding:6px}
    #findPage .findFastLine{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0}
    #findPage .findFastAreaLine{padding-bottom:3px;border-bottom:1px dashed #d7dee7}
    #findPage .findFastLabel{min-width:76px;padding:7px 8px;border-radius:6px;text-align:center;font-weight:900}
    #findPage .findFastLabel.scan{background:#e8f5ff;color:#064c83}
    #findPage .findFastLabel.manual{background:#fff7dd;color:#7a5200}
    #findPage .findDirectInput{min-width:220px;flex:1;height:38px;font-size:17px;font-weight:700}
    #findPage .findScanOnly{border:2px solid #3483c9;background:#f8fcff}
    #findPage .findAreaSelect{min-width:105px;font-weight:900}
    #findPage .findAreaBadge{display:inline-block;min-width:48px;padding:4px 8px;border:1px solid;border-radius:999px;font-weight:900;line-height:1.05}
    .findFastNotice{position:fixed;z-index:13050;top:72px;left:50%;transform:translateX(-50%);min-width:560px;max-width:900px;padding:12px 22px;border:4px solid;border-radius:14px;box-shadow:0 12px 35px rgba(0,0,0,.32);text-align:center;background:#fff}
    .findFastNotice.ok{background:#ecfdf5;border-color:#16a34a;color:#14532d}
    .findFastNotice.err{background:#fff1f2;border-color:#dc2626;color:#991b1b}
    .findFastNotice.hit{background:#fff8d9;border-color:#e59b00;color:#7a4a00}
    .findFastNoticeTitle{font-size:24px;font-weight:1000}
    .findFastNoticeCode{font-size:38px;font-weight:1000;line-height:1.05;margin:4px 0}
    .findFastNoticeDetail{font-size:19px;font-weight:900}
    @media(max-width:760px){.findFastNotice{top:58px;min-width:calc(100vw - 20px);max-width:calc(100vw - 20px);padding:10px 12px}.findFastNoticeCode{font-size:30px}#findPage .findFastLabel{min-width:70px}#findPage .findDirectInput{min-width:160px}}
  `;
  document.head.appendChild(style);
  renderAreasFast();
  byId('findAreaAddBtn').addEventListener('click',addAreaFast);
  byId('findAreaDeleteBtn').addEventListener('click',deleteAreaFast);
  byId('findLocExportBtn').addEventListener('click',()=>exportFindLocationsDisplayed());
  onEnter(byId('findLocScanInput'),()=>submitLocation('findLocScanInput','Quét mã'));
  onEnter(byId('findLocManualInput'),()=>submitLocation('findLocManualInput','Nhập tay'));
  onEnter(byId('findNeedScanInput'),()=>submitNeed('findNeedScanInput','Quét mã'));
  onEnter(byId('findNeedManualInput'),()=>submitNeed('findNeedManualInput','Nhập tay'));
  byId('findLocManualAddBtn').addEventListener('click',()=>submitLocation('findLocManualInput','Nhập tay'));
  byId('findNeedManualAddBtn').addEventListener('click',()=>submitNeed('findNeedManualInput','Nhập tay'));
  byId('findLocImportBtn').addEventListener('click',()=>byId('findLocFileInput').click());
  byId('findNeedImportBtn').addEventListener('click',()=>byId('findNeedFileInput').click());
  byId('findLocFileInput').addEventListener('change',async e=>{
    const file=e.target.files?.[0];
    try{
      if(file){
        const area=areaNorm(byId('findAreaSelect')?.value);
        const type=byId('findLocTypeSelect')?.value||'daily';
        const rows=await readFindLocationRowsFromExcel(file,area);
        await addManyFindLocations(rows,area,'Up file',type);
      }
    }finally{e.target.value=''}
  });
  byId('findNeedFileInput').addEventListener('change',async e=>{
    const file=e.target.files?.[0];
    try{
      if(file){
        const codes=await readCodeListFromExcel(file);
        await addManyFindNeeds(codes,'Up file');
      }
    }finally{e.target.value=''}
  });
  byId('findLocClearBtn').addEventListener('click',clearFindLocations);
  byId('findNeedClearBtn').addEventListener('click',clearFindNeeds);
  byId('findLocSearch').addEventListener('input',()=>{
    state.find.locSearch=byId('findLocSearch').value;
    renderFindLocations();
  });
  renderFastWork();
  setTimeout(()=>byId('findLocScanInput')?.focus(),80);
}
patchFastUI();
})();
