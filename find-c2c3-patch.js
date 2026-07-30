@@
 function areaStyle(area){const palette=[['#e8f1ff','#134e8e'],['#fff0e5','#9a4b00'],['#edf9e8','#286317'],['#f4eaff','#6b2ca0'],['#ffeaf1','#9b244d'],['#e7f8f7','#0f6d68'],['#fff8d9','#7a5b00'],['#[...]
 }
+// Fixed locations path (persistent across dates)
+function findFixedPath(){return `${findBasePath()}/fixedLocations`}
@@
-window.renderFindLocations=function(){const body=byId('findLocBody');if(!body)return;const q=norm(state.find.locSearch||''),rows=findSortRows(state.find.locations).filter(r=>!q||norm(r.code).inclu[...]
+window.renderFindLocations=function(){
+  const body=byId('findLocBody');if(!body)return;const q=norm(state.find.locSearch||'');
+  // rows already merged with fixed on load; ensure type column
+  const rows=findSortRows(state.find.locations).filter(r=>!q||norm(r.code).includes(q));
+  body.innerHTML=rows.map((r,i)=>{
+    const cls=(r.type==='fixed')?'findHitRow':(findAreaText(r.code)?'findHitRow':'findMissingRow');
+    const timeHtml=r.createdAt?escapeHtml(new Date(r.createdAt).toLocaleString('vi-VN')):'';
+    const typeLabel=r.type==='fixed'?'Cố định':'Hằng ngày';
+    return `<tr class="${cls}" data-find-loc="${escapeAttr(r.id)}"><td>${i+1}</td><td class="findCodeCell">${escapeHtml(r.code||'')}</td><td class="findAreaCell">${r.area?`<span class="findAreaBadge" style="${areaStyle(r.area)}">${escapeHtml(r.area)}</span>`:escapeHtml(r.area||'')}</td><td>${escapeHtml(typeLabel)}</td><td class="findTimeCell">${timeHtml}</td><td><button class="btn" data-find-delete="${escapeAttr(r.id)}">Xóa</button></td></tr>`
+  }).join('')||'<tr><td colspan="6" class="findEmpty">Chưa có vị trí.</td></tr>';
+  // attach delete handlers
+  [...body.querySelectorAll('[data-find-delete]')].forEach(btn=>btn.addEventListener('click',async e=>{
+    const id=btn.getAttribute('data-find-delete');
+    const row=(state.find.locations||[]).find(x=>x.id===id);
+    if(!row)return;
+    if(row.type==='daily'){
+      if(!confirm('Xóa vị trí Hằng ngày cho mã này (chỉ ảnh hưởng ngày đang mở)?'))return;
+      try{await fbSet(`${findDayPath()}/locations/${id}`,null);setMsg('Đã xóa vị trí Hằng ngày.');await loadFindDay();}catch(e){setMsg('Lỗi xóa: '+(e?.message||e),true)}
+    } else {
+      // fixed
+      if(!confirm('Xóa vị trí Cố định cho mã này?'))return;
+      try{await fbSet(`${findFixedPath()}/${id}`,null);setMsg('Đã xóa vị trí Cố định.');await loadFixedAndMerge();}catch(e){setMsg('Lỗi xóa: '+(e?.message||e),true)}
+    }
+  }));
+}
@@
-window.renderFindNeeds=function(){const body=byId('findNeedBody');if(!body)return;const rows=findSortRows(state.find.needs);body.innerHTML=rows.map((r,i)=>{const areaNow=findAreaText(r.code),area=[...]
+window.renderFindNeeds=function(){const body=byId('findNeedBody');if(!body)return;const rows=findSortRows(state.find.needs);body.innerHTML=rows.map((r,i)=>{const areaNow=findAreaText(r.code),area=[...]
 }
*** End Patch