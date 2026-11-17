'use strict';
const $ = id => document.getElementById(id);
const S = {meta:null,frame:null,index:0,selected:55177,horizon:5,playing:false,loading:false,request:0,lanes:{verified:false,lanes:[]},routes:{routes:[]},drawing:false,vertices:[],routeDrawing:false,routePoints:[],chat:[],view:{cx:0,cy:0,span:92}};
let labels={Car:'Ô tô',Van:'Xe van',Truck:'Xe tải',Bus:'Xe buýt',Motorcycle:'Xe máy',Cyclist:'Xe đạp',Pedestrian:'Người đi bộ'};
const colors={Car:'#7ac8ed',Van:'#8fb5ed',Truck:'#b0adf0',Bus:'#c4a1ec',Motorcycle:'#eca3bc',Cyclist:'#efc17a',Pedestrian:'#6dd8b4'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=s=>s?s.slice(11,23):'—';
function toast(message){$('toast').textContent=I18n.translate(message);$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5500);}
async function api(path,body){const response=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,language:I18n.language})});const data=await response.json();if(!response.ok)throw Error(data.error||'Không thể đọc dữ liệu');return data;}
function pause(){S.playing=false;$('play').textContent='▶';$('play').setAttribute('aria-label','Phát dữ liệu');}
async function loadFrame(index){
  const request=++S.request;S.loading=true;
  try{const data=await api(`/api/frame?index=${index}&horizon=${S.horizon}`);if(request!==S.request)return;S.index=index;S.frame=data;$('seek').value=index;render();}
  catch(e){pause();toast(e.message);}finally{if(request===S.request)S.loading=false;}
}
function selectedObject(){return S.frame?.objects.find(o=>o.id===S.selected);}
function select(id){S.selected=Number(id);render();}
function render(){
  if(!S.frame)return;
  const f=S.frame,o=selectedObject();
  $('count').textContent=f.objects.length;
  const counts={};for(const p of f.objects)counts[p.class_name]=(counts[p.class_name]||0)+1;
  $('classSummary').textContent=Object.entries(counts).map(([k,v])=>`${v} ${labels[k]||k}`).join(' · ');
  $('selectedMetric').textContent=S.selected===null?'—':`#${S.selected}`;
  $('selectedClass').textContent=o?labels[o.class_name]||o.class_name:'Không có mặt tại thời điểm này';
  $('alertCount').textContent=f.alerts.length;
  $('horizonMetric').textContent=S.horizon;
  document.querySelector('[data-prompt="Đối tượng này đi đâu trong 5 giây?"]').textContent=`${S.horizon} giây tới sẽ đi đâu?`;
  $('clock').textContent=time(f.timestamp);
  $('frameLabel').textContent=`Khung hình ${S.index+1} / ${S.meta.frames}`;
  $('contextLabel').textContent=`${S.selected!==null?'ID '+S.selected+' · ':''}${time(f.timestamp)}`;
  renderRows();renderDetail();draw();
}
function renderRows(){
  const query=$('search').value.trim(),filter=$('classFilter').value;
  let visible=S.frame.objects.filter(o=>(!query||String(o.id).includes(query))&&(!filter||o.class_name===filter));
  const present=new Set(S.frame.objects.map(o=>o.id));
  const historical=query?S.meta.catalog.filter(o=>!present.has(o.id)&&String(o.id).includes(query)&&(!filter||o.class_name===filter)).slice(0,30):[];
  $('visibleCount').textContent=`${visible.length} trong cảnh`;
  $('objectRows').innerHTML=visible.map(o=>`<tr class="${o.id===S.selected?'selected':''}"><td><b>#${o.id}</b><small>${esc(labels[o.class_name]||o.class_name)}</small></td><td>${(o.speed*3.6).toFixed(1)} <small>km/h*</small></td><td><span class="tag ${o.lane.status==='warning'?'warning':''}">${esc(o.lane.lane||'Chưa xác định')}</span></td><td><button data-select="${o.id}" aria-label="Chọn ID ${o.id}">↗</button></td></tr>`).join('')+historical.map(o=>`<tr><td><b>#${o.id}</b><small>${esc(labels[o.class_name]||o.class_name)} · ngoài cảnh</small></td><td colspan="2"><small>Đi tới quan sát đầu tiên</small></td><td><button data-jump="${o.id}" data-frame="${o.first}" aria-label="Đi tới ID ${o.id}">→</button></td></tr>`).join('');
  if(!visible.length&&!historical.length)$('objectRows').innerHTML='<tr><td colspan="4">Không tìm thấy đối tượng phù hợp.</td></tr>';
  $('objectRows').querySelectorAll('[data-select]').forEach(b=>{b.onclick=()=>select(b.dataset.select);b.closest('tr').onclick=()=>select(b.dataset.select);});
  $('objectRows').querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{pause();S.selected=Number(b.dataset.jump);loadFrame(Number(b.dataset.frame));});
}
function renderDetail(){
  const o=selectedObject();$('detailTitle').textContent=o?`ID ${o.id} · ${labels[o.class_name]||o.class_name}`:'Phân tích đối tượng';
  if(!o){$('detail').innerHTML='<p>ID đang chọn không có mặt trong khung hình này. Chọn đối tượng khác hoặc tìm ID để chuyển đến lần quan sát đầu tiên.</p>';}
  else{
    const p=o.prediction.at(-1),heading=o.speed>=.5?`${(Math.atan2(o.vy,o.vx)*180/Math.PI).toFixed(0)}°`:'Chưa ổn định';
    const routeNote=o.route_match?`Dự đoán bám tuyến ${o.route_match.id} · cách tim tuyến ${o.route_match.distance} m · lệch hướng ${o.route_match.heading_delta}°.`:(S.routes.routes.length?'Không khớp tuyến đã vẽ; đang ngoại suy theo vận tốc thẳng.':'Chưa có tuyến vẽ; đang ngoại suy theo vận tốc thẳng.');
    $('detail').innerHTML=`<div class="detail-grid"><div><small>VẬN TỐC HIỆN TẠI*</small><strong>${(o.speed*3.6).toFixed(1)} km/h</strong></div><div><small>HƯỚNG / TRỤC +X</small><strong>${heading}</strong></div><div><small>VỊ TRÍ X, Y*</small><strong>${o.x.toFixed(1)}, ${o.y.toFixed(1)} m</strong></div><div><small>SAU ${S.horizon} GIÂY*</small><strong>${p.x.toFixed(1)}, ${p.y.toFixed(1)} m</strong></div></div><div class="lane-verdict">${esc(o.lane.text)}</div><div class="route-verdict">${esc(routeNote)}</div><p class="prediction-note">* Giả định đơn vị m, m/s. Dự đoán bám tuyến vẽ khi khớp vị trí và hướng; chưa xét đèn tín hiệu hoặc ý định người lái.</p>`;
  }
  const pairs=S.frame.alerts.filter(p=>S.selected===null||p.ids.includes(S.selected));
  $('alerts').innerHTML=pairs.slice(0,3).map(p=>`<div class="alert-item">△ ID ${p.ids.join(' / ')} · khoảng cách tâm ${p.distance} m sau ${p.t} s</div>`).join('');
  if(pairs.length)$('alerts').insertAdjacentHTML('beforeend','<p class="prediction-note">Cảnh báo khoảng cách theo vòng tròn bao thân xe; có thể cảnh báo dư.</p>');
}
const canvas=$('map'),ctx=canvas.getContext('2d');
let mapping={scale:1,ox:0,oy:0},googleMap=null,mapProjection=null,originPicking=false;
const defaultMapCenter={lat:49.97182,lng:9.159078};
let mapOrigin={...defaultMapCenter};
try{const saved=JSON.parse(localStorage.getItem('k305-map-origin')||'null');if(saved&&Number.isFinite(saved.lat)&&Number.isFinite(saved.lng))mapOrigin=saved;}catch{}
try{$('mapRotation').value=localStorage.getItem('k305-map-rotation')||'0';}catch{}
function sensorToLatLng(x,y){const a=Number($('mapRotation').value||0)*Math.PI/180,east=x*Math.cos(a)-y*Math.sin(a),north=x*Math.sin(a)+y*Math.cos(a);return {lat:mapOrigin.lat+north/111320,lng:mapOrigin.lng+east/(111320*Math.cos(mapOrigin.lat*Math.PI/180))};}
function latLngToSensor(latLng){const east=(latLng.lng()-mapOrigin.lng)*111320*Math.cos(mapOrigin.lat*Math.PI/180),north=(latLng.lat()-mapOrigin.lat)*111320,a=Number($('mapRotation').value||0)*Math.PI/180;return [+((east*Math.cos(a)+north*Math.sin(a))).toFixed(3),+((-east*Math.sin(a)+north*Math.cos(a))).toFixed(3)];}
function point(x,y){if(mapProjection){const ll=sensorToLatLng(x,y),p=mapProjection.fromLatLngToDivPixel(new google.maps.LatLng(ll.lat,ll.lng));if(p)return [p.x,p.y];}return [mapping.ox+x*mapping.scale,mapping.oy-y*mapping.scale];}
function path(points){ctx.beginPath();points.forEach((p,i)=>{const [x,y]=point(p.x??p[0],p.y??p[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});}
function draw(){
  if(!S.frame)return;
  const box=canvas.getBoundingClientRect(),w=box.width,h=box.height,dpr=window.devicePixelRatio||1;
  if(!w||!h)return;
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  let scale=Math.min(w,h)/S.view.span;mapping={scale,ox:w/2-S.view.cx*scale,oy:h/2+S.view.cy*scale};
  if(mapProjection){const a=point(0,0),b=point(10,0);scale=Math.hypot(b[0]-a[0],b[1]-a[1])/10;}
  ctx.clearRect(0,0,w,h);
  if(!mapProjection){ctx.fillStyle='#102d39';ctx.fillRect(0,0,w,h);for(let v=-150;v<=150;v+=10){ctx.strokeStyle=v===0?'#31505c':'#1b3b48';ctx.lineWidth=v===0?1:.6;const [x]=point(v,0),[,y]=point(0,v);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();if(v%20===0){ctx.fillStyle='#547785';ctx.font='8px Segoe UI';if(x>20&&x<w-20)ctx.fillText(v,x+4,h-34);if(y>35&&y<h-45)ctx.fillText(v,8,y-4);}}}
  const lanes=S.drawing||!$('laneEditor').hidden?S.lanes:S.frame.lanes;
  lanes.lanes.forEach(l=>{path(l.polygon);ctx.closePath();ctx.fillStyle=lanes.verified?'#429e7420':'#dbb35c18';ctx.fill();ctx.strokeStyle=lanes.verified?'#54b39b88':'#d9b56188';ctx.setLineDash([4,4]);ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);const cx=l.polygon.reduce((a,p)=>a+p[0],0)/l.polygon.length,cy=l.polygon.reduce((a,p)=>a+p[1],0)/l.polygon.length;const [px,py]=point(cx,cy);ctx.fillStyle='#b0c8b9';ctx.font='9px Segoe UI';ctx.fillText(l.id,px+6,py-6);const angle=l.heading*Math.PI/180;const [ex,ey]=point(cx+Math.cos(angle)*4,cy+Math.sin(angle)*4);arrow(px,py,ex,ey,'#9abf9c',1.5);});
  if($('routesToggle').checked){const palette=['#16191d','#16191d','#ffe128','#ffe128','#ffe128','#ff3645','#ff3645','#ff3645','#22bd68','#54d4dd','#b99aff'],activeRoute=selectedObject()?.route_match?.id;S.routes.routes.forEach((r,i)=>{const active=r.id===activeRoute,color=palette[i%palette.length];path(r.points);ctx.strokeStyle=active?'#ffffffcc':'#ffffff66';ctx.lineWidth=active?4:2;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();path(r.points);ctx.strokeStyle=color;ctx.globalAlpha=active?1:.42;ctx.lineWidth=active?2.4:1.1;ctx.stroke();ctx.globalAlpha=1;});}
  for(const o of S.frame.objects){const color=colors[o.class_name]||'#b5c5ce';if($('trails').checked&&o.history.length>1){path(o.history);ctx.strokeStyle=color+(o.id===S.selected?'bb':'35');ctx.lineWidth=o.id===S.selected?2:1;ctx.stroke();}}
  const selected=selectedObject();
  if(selected&&$('predict').checked){path(selected.prediction);ctx.strokeStyle='#f6ce87';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);for(const p of selected.prediction.filter(p=>Number.isInteger(p.t)&&p.t>0)){const [x,y]=point(p.x,p.y);ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fillStyle='#f6ce87';ctx.fill();if(p.t===S.horizon){ctx.font='10px Segoe UI';ctx.fillText(`+${p.t}s`,x+7,y-7);}}}
  for(const o of S.frame.objects){const color=colors[o.class_name]||'#b5c5ce',[x,y]=point(o.x,o.y),chosen=o.id===S.selected;
    if(chosen){ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.strokeStyle='#e2fbf6';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#88d9c822';ctx.fill();}
    ctx.save();ctx.translate(x,y);ctx.rotate(-o.yaw);ctx.fillStyle=color;
    if(o.class_name==='Pedestrian'){ctx.beginPath();ctx.arc(0,0,3.3,0,Math.PI*2);ctx.fill();}
    else if(o.class_name==='Cyclist'){ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(-4,-3);ctx.lineTo(-4,3);ctx.closePath();ctx.fill();}
    else{const bw=Math.max(7,o.length*scale),bh=Math.max(3,o.width*scale);ctx.fillRect(-bw/2,-bh/2,bw,bh);ctx.fillStyle='#0e324499';ctx.fillRect(bw/4,-bh/2,1,bh);}
    ctx.restore();
    if(o.speed>.5){const [ex,ey]=point(o.x+o.vx*.6,o.y+o.vy*.6);arrow(x,y,ex,ey,color+'88',1);}
    ctx.font=chosen?'bold 10px Segoe UI':'9px Segoe UI';ctx.lineWidth=2.5;ctx.strokeStyle='#10232ddd';ctx.strokeText(o.id,x+9,y-8);ctx.fillStyle=chosen?'#fff':color;ctx.fillText(o.id,x+9,y-8);
  }
  const drawingPoints=S.routeDrawing?S.routePoints:S.vertices;
  if(drawingPoints.length){path(drawingPoints);ctx.strokeStyle=S.routeDrawing?'#ffdd59':'#efcc78';ctx.lineWidth=2.5;ctx.stroke();drawingPoints.forEach((p,i)=>{const [x,y]=point(...p);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle=S.routeDrawing?'#ffdd59':'#efcc78';ctx.fill();ctx.font='10px Segoe UI';ctx.fillText(i+1,x+6,y-6);});}
  const bar=10*scale;ctx.strokeStyle='#94b4be';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w-25-bar,h-43);ctx.lineTo(w-25,h-43);ctx.stroke();ctx.font='8px Segoe UI';ctx.fillStyle='#94b4be';ctx.fillText('10 m*',w-25-bar,h-49);
}
function arrow(x,y,ex,ey,color,width){const a=Math.atan2(ey-y,ex-x);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.moveTo(ex-4*Math.cos(a-.5),ey-4*Math.sin(a-.5));ctx.lineTo(ex,ey);ctx.lineTo(ex-4*Math.cos(a+.5),ey-4*Math.sin(a+.5));ctx.stroke();}
function mapClick(latLng,px,py){if(originPicking){mapOrigin={lat:latLng.lat(),lng:latLng.lng()};originPicking=false;try{localStorage.setItem('k305-map-origin',JSON.stringify(mapOrigin));}catch{}$('mapStatus').textContent=I18n.translate('Gốc cảm biến đã cập nhật; kiểm tra góc +X để căn đúng tuyến.');$('setOrigin').classList.remove('primary');draw();return;}if(S.routeDrawing){S.routePoints.push(latLngToSensor(latLng));$('routePointCount').textContent=`${S.routePoints.length} điểm`;draw();return;}if(S.drawing){S.vertices.push(latLngToSensor(latLng));$('vertexCount').textContent=`${S.vertices.length} đỉnh`;draw();return;}let closest=null,distance=22;for(const o of S.frame?.objects||[]){const p=point(o.x,o.y),d=Math.hypot(p[0]-px,p[1]-py);if(d<distance){closest=o;distance=d;}}if(closest)select(closest.id);}
canvas.onclick=e=>{if(mapProjection)return;const b=canvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;if(S.routeDrawing){S.routePoints.push([+((x-mapping.ox)/mapping.scale).toFixed(3),+((mapping.oy-y)/mapping.scale).toFixed(3)]);$('routePointCount').textContent=`${S.routePoints.length} điểm`;draw();return;}if(S.drawing){S.vertices.push([+((x-mapping.ox)/mapping.scale).toFixed(3),+((mapping.oy-y)/mapping.scale).toFixed(3)]);$('vertexCount').textContent=`${S.vertices.length} đỉnh`;draw();return;}let closest=null,distance=22;for(const o of S.frame?.objects||[]){const p=point(o.x,o.y),d=Math.hypot(p[0]-x,p[1]-y);if(d<distance){closest=o;distance=d;}}if(closest)select(closest.id);};
canvas.addEventListener('wheel',e=>{e.preventDefault();S.view.span=Math.max(25,Math.min(180,S.view.span*(e.deltaY>0?1.1:.9)));draw();},{passive:false});
new ResizeObserver(draw).observe(canvas.parentElement);
$('fit').onclick=()=>{S.view={cx:0,cy:0,span:92};if(googleMap)googleMap.setCenter(mapOrigin);if(mapProjection)googleMap.setZoom(19);draw();};
$('trails').onchange=$('predict').onchange=$('routesToggle').onchange=draw;
$('mapRotation').onchange=()=>{const n=Number($('mapRotation').value);if(!Number.isFinite(n)||n < -180||n>180){$('mapRotation').value=0;return;}try{localStorage.setItem('k305-map-rotation',String(n));}catch{}draw();};
$('setOrigin').onclick=()=>{originPicking=true;$('setOrigin').classList.add('primary');$('mapStatus').textContent=I18n.translate('Nhấp vào tâm giao lộ trên bản đồ để đặt gốc X/Y.');};
window.initGoogleMap=()=>{try{googleMap=new google.maps.Map($('googleMap'),{center:mapOrigin,zoom:19,mapTypeId:'hybrid',streetViewControl:false,mapTypeControl:true,fullscreenControl:true,gestureHandling:'greedy'});const overlay=new google.maps.OverlayView();overlay.onAdd=function(){};overlay.draw=function(){mapProjection=this.getProjection();draw();};overlay.onRemove=function(){mapProjection=null;};overlay.setMap(googleMap);googleMap.addListener('click',e=>{if(!e.latLng)return;const p=mapProjection?.fromLatLngToDivPixel(e.latLng);if(p)mapClick(e.latLng,p.x,p.y);});googleMap.addListener('idle',draw);$('mapStatus').textContent=I18n.translate('Google Maps đang hoạt động · vị trí và hướng X/Y cần hiệu chỉnh.');$('mapWrap').classList.remove('is-fallback');$('mapSetup').hidden=true;$('setOrigin').disabled=false;canvas.style.pointerEvents='none';}catch(e){googleMap=null;mapProjection=null;mapSetup('Google Maps không tải được. Kiểm tra khóa API, billing và quyền Maps JavaScript API.');}};
function mapSetup(text){$('mapStatus').textContent=I18n.translate(text);$('mapSetup').innerHTML=`<strong>${esc(I18n.translate('Google Maps chưa được kết nối'))}</strong><span>${esc(I18n.translate(text))}</span><a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank" rel="noopener noreferrer">${esc(I18n.translate('Cách thiết lập Google Maps API ↗'))}</a><a href="https://www.google.com/maps/search/?api=1&amp;query=49.97182%2C9.159078" target="_blank" rel="noopener noreferrer">${esc(I18n.translate('Mở K305 trên Google Maps ↗'))}</a>`;$('mapSetup').hidden=false;$('mapWrap').classList.add('is-fallback');$('setOrigin').disabled=true;canvas.style.pointerEvents='auto';draw();}
async function initMap(){try{const config=await api('/api/maps-config');if(config.center&&!localStorage.getItem('k305-map-origin'))mapOrigin=config.center;if(!config.api_key){mapSetup('Cần GOOGLE_MAPS_API_KEY trên máy chủ cục bộ. Bản đồ tọa độ vẫn hoạt động; không dùng ảnh chụp.');return;}const script=document.createElement('script');script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.api_key)}&callback=initGoogleMap&v=weekly`;script.async=true;script.defer=true;script.onerror=()=>mapSetup('Không tải được Google Maps. Kiểm tra khóa API và kết nối mạng.');document.head.append(script);}catch(e){mapSetup('Không thể đọc cấu hình Google Maps.');}}
initMap();
$('search').oninput=$('classFilter').onchange=()=>S.frame&&renderRows();
$('seek').oninput=()=>{pause();loadFrame(Number($('seek').value));};
$('horizon').onchange=()=>{S.horizon=Number($('horizon').value);loadFrame(S.index);};
$('play').onclick=()=>{if(S.playing){pause();return;}if(S.index>=S.meta.frames-1){S.index=0;loadFrame(0);}S.playing=true;S.anchorTime=performance.now();S.anchorIndex=S.index;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Tạm dừng');};
$('rate').onchange=()=>{S.anchorTime=performance.now();S.anchorIndex=S.index;};
function tick(now){if(S.playing&&S.meta&&!S.loading){const target=S.meta.times[S.anchorIndex]+(now-S.anchorTime)/1000*Number($('rate').value);let lo=S.index,hi=S.meta.frames;while(lo<hi){const mid=(lo+hi)>>1;if(S.meta.times[mid]<=target)lo=mid+1;else hi=mid;}const next=Math.min(S.meta.frames-1,Math.max(0,lo-1));if(next!==S.index)loadFrame(next);if(next===S.meta.frames-1)pause();}requestAnimationFrame(tick);}requestAnimationFrame(tick);
function message(text,role,meta){const el=document.createElement('div');el.className=`message ${role}`;el.dataset.noTranslate='true';el.lang=meta?.language||I18n.language;if(role!=='user'&&!meta)text=I18n.translate(text);if(role==='user'){el.textContent=text;}else{const icon=document.createElement('div');icon.className='avatar';icon.textContent='✧';const content=document.createElement('div');const title=document.createElement('span');title.className='message-author';title.textContent='TRAFFIC COPILOT';const p=document.createElement('p');p.textContent=text;content.append(title,p);if(meta){const note=document.createElement('div');note.className='evidence';note.textContent=I18n.translate(`${time(meta.timestamp)} · khung ${meta.frame+1} · ${meta.mode==='openai'?'AI API':'phân tích cục bộ'}`);content.append(note);}el.append(icon,content);}$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight;return el;}
let sending=false;
async function ask(prompt){if(sending||!S.frame||!prompt.trim())return;pause();sending=true;$('send').disabled=true;message(prompt,'user');$('question').value='';const pending=message('Đang đọc dữ liệu tại thời điểm đã chọn…','assistant');try{const result=await api('/api/chat',{prompt,index:S.index,selected:S.selected,horizon:S.horizon,use_ai:$('useAI').checked});pending.remove();message(result.answer,'assistant',result);S.chat.push({question:prompt,...result});if(result.horizon!==S.horizon){S.horizon=result.horizon;$('horizon').value=S.horizon;await loadFrame(S.index);}}catch(e){pending.remove();message(e.message,'assistant');}finally{sending=false;$('send').disabled=false;}}
$('chatForm').onsubmit=e=>{e.preventDefault();ask($('question').value);};
$('question').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask($('question').value);}};
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>ask(I18n.translate(b.dataset.prompt.replace('5 giây',`${S.horizon} giây`))));
$('useAI').onchange=()=>{$('chatMode').textContent=$('useAI').checked?'AI API':'Cục bộ';$('aiNote').textContent=$('useAI').checked?'Câu hỏi và dữ liệu cảnh được gửi tới OpenAI':'Phân tích tại máy · không cần khóa API';};
function download(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>{if(!S.frame)return;download(`k305-frame-${S.index}.json`,{source:S.meta.source,selected:S.selected,analysis:S.frame,chat:S.chat});toast('Đã xuất JSON chứa dữ liệu cảnh, dự đoán và hội thoại.');};
$('help').onclick=()=>$('helpDialog').showModal();
function renderLaneList(){$('laneList').innerHTML=S.lanes.lanes.length?S.lanes.lanes.map((l,i)=>`<div class="lane-row"><span>${esc(l.id)} · ${l.polygon.length} đỉnh · ${l.heading}° · ${esc(l.allowed.join(', '))}</span><button data-remove="${i}">Xóa</button></div>`).join(''):'<p>Chưa có làn nào được khai báo.</p>';$('laneList').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{S.lanes.lanes.splice(Number(b.dataset.remove),1);$('verified').checked=false;S.lanes.verified=false;renderLaneList();draw();});}
function renderRouteList(){$('routeList').innerHTML=S.routes.routes.length?S.routes.routes.map((r,i)=>`<div class="lane-row"><span>↗ ${esc(r.id)} · ${r.points.length} điểm</span><button data-remove-route="${i}">Xóa</button></div>`).join(''):`<p>${esc(I18n.translate('Chưa có tuyến nào. Vẽ theo chiều xe chạy trên bản đồ K305.'))}</p>`;$('routeList').querySelectorAll('[data-remove-route]').forEach(b=>b.onclick=()=>{S.routes.routes.splice(Number(b.dataset.removeRoute),1);renderRouteList();draw();});}
$('laneToggle').onclick=async()=>{pause();try{S.lanes=await api('/api/lanes');$('verified').checked=S.lanes.verified;renderLaneList();$('laneEditor').hidden=false;$('laneEditor').scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){toast(e.message);}};
function cancelDraw(){S.drawing=false;S.vertices=[];$('vertexCount').textContent='0 đỉnh';$('mapHint').textContent='Nhấp vào một đối tượng để phân tích';draw();}
$('routeToggle').onclick=async()=>{pause();try{S.routes=await api('/api/routes');renderRouteList();$('routeEditor').hidden=false;$('routeEditor').scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){toast(e.message);}};
$('closeRoutes').onclick=()=>{$('routeEditor').hidden=true;cancelRouteDraw();};
function cancelRouteDraw(){S.routeDrawing=false;S.routePoints=[];$('routePointCount').textContent='0 điểm';$('mapHint').textContent='Nhấp vào một đối tượng để phân tích';draw();}
$('drawRoute').onclick=()=>{pause();S.drawing=false;S.routeDrawing=true;S.routePoints=[];$('routePointCount').textContent='0 điểm';$('mapHint').textContent='VẼ TUYẾN · Bấm dọc tim đường theo chiều xe chạy';canvas.scrollIntoView({behavior:'smooth',block:'center'});draw();};
$('undoRoutePoint').onclick=()=>{S.routePoints.pop();$('routePointCount').textContent=`${S.routePoints.length} điểm`;draw();};
$('cancelRoute').onclick=cancelRouteDraw;
$('addRoute').onclick=()=>{if(S.routePoints.length<2){toast('Hãy chọn ít nhất 2 điểm theo chiều di chuyển.');return;}const name=$('routeName').value.trim();if(!name||S.routes.routes.some(r=>r.id===name)){toast('Tên tuyến không được trống hoặc trùng.');return;}S.routes.routes.push({id:name,points:S.routePoints.slice()});cancelRouteDraw();renderRouteList();$('routeName').value=`${{vi:'Tuyến',en:'Route',de:'Route'}[I18n.language]} ${S.routes.routes.length+1}`;toast('Đã thêm tuyến vào bản nháp; nhấn Lưu tuyến để áp dụng.');};
$('saveRoutes').onclick=async()=>{try{S.routes=await api('/api/routes',S.routes);renderRouteList();await loadFrame(S.index);toast('Đã lưu tuyến. Dự đoán sẽ bám tuyến khi xe khớp vị trí và hướng.');}catch(e){toast(e.message);}};
$('downloadRoutes').onclick=()=>download('k305-routes.json',S.routes);
$('closeLanes').onclick=()=>{$('laneEditor').hidden=true;cancelDraw();};
$('drawLane').onclick=()=>{pause();S.drawing=true;S.vertices=[];$('vertexCount').textContent='0 đỉnh';$('mapHint').textContent='VẼ LÀN · Nhấp các đỉnh quanh biên; sau đó chọn “Thêm đa giác”';canvas.scrollIntoView({behavior:'smooth',block:'center'});draw();};
$('undoPoint').onclick=()=>{S.vertices.pop();$('vertexCount').textContent=`${S.vertices.length} đỉnh`;draw();};
$('cancelDraw').onclick=cancelDraw;
$('addLane').onclick=()=>{if(S.vertices.length<3){toast('Hãy chọn ít nhất 3 đỉnh trên bản đồ.');return;}const name=$('laneName').value.trim(),heading=Number($('laneHeading').value);if(!name||S.lanes.lanes.some(l=>l.id===name)||!Number.isFinite(heading)||heading < -180||heading>180){toast('Kiểm tra tên làn không trùng và góc từ -180 đến 180.');return;}const groups={motor:['Car','Van','Truck','Bus','Motorcycle'],cycle:['Cyclist'],pedestrian:['Pedestrian'],all:Object.keys(labels)};S.lanes.lanes.push({id:name,polygon:S.vertices.slice(),heading,allowed:groups[$('laneAllowed').value]});S.lanes.verified=false;$('verified').checked=false;cancelDraw();renderLaneList();$('laneName').value=`${{vi:'Làn',en:'Lane',de:'Fahrspur'}[I18n.language]} ${S.lanes.lanes.length+1}`;toast('Đã thêm vào bản nháp. Kiểm tra cấu hình rồi nhấn Lưu.');};
$('verified').onchange=()=>{S.lanes.verified=$('verified').checked;draw();};
$('saveLanes').onclick=async()=>{try{S.lanes=await api('/api/lanes',{...S.lanes,verified:$('verified').checked});await loadFrame(S.index);toast('Đã lưu cấu hình làn trên máy.');}catch(e){toast(e.message);}};
$('downloadLanes').onclick=()=>download('k305-lanes.json',{...S.lanes,verified:$('verified').checked});
$('importLanes').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('File làn quá lớn.');const config=JSON.parse(await file.text());if(!Array.isArray(config.lanes)||config.lanes.length>100||config.lanes.some(l=>typeof l.id!=='string'||!Array.isArray(l.allowed)||!Array.isArray(l.polygon)||l.polygon.length<3||l.polygon.length>100||l.polygon.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v)))||!Number.isFinite(l.heading)))throw Error('File không đúng cấu trúc làn.');S.lanes={...config,verified:false};$('verified').checked=false;renderLaneList();draw();toast('Đã nhập bản nháp. Kiểm tra và lưu để áp dụng.');}catch(e){toast(e.message);}finally{e.target.value='';}};
async function init(){try{await I18n.ready;updateLanguageLabels();S.meta=await api('/api/meta');$('seek').max=S.meta.frames-1;$('startTime').textContent=time(S.meta.start).slice(0,8);$('endTime').textContent=time(S.meta.end).slice(0,8);$('datasetInfo').textContent=`K305 · ${S.meta.frames.toLocaleString(I18n.language)} khung hình · ${S.meta.tracks} ID · ${S.meta.source}`;for(const k of Object.keys(S.meta.classes)){const option=document.createElement('option');option.value=k;option.textContent=labels[k]||k;$('classFilter').append(option);}$('useAI').disabled=!S.meta.ai_available;if(!S.meta.ai_available)$('useAI').title='Chưa cấu hình OPENAI_API_KEY và OPENAI_MODEL; xem hướng dẫn (?)';S.lanes=await api('/api/lanes');S.routes=await api('/api/routes');await loadFrame(0);}catch(e){$('classSummary').textContent='Không thể tải dữ liệu';toast(e.message);}}init();

let automaticLaneName='Làn 1';
function updateLanguageLabels(){
  if($('laneName').value===automaticLaneName){automaticLaneName=`${{vi:'Làn',en:'Lane',de:'Fahrspur'}[I18n.language]} ${S.lanes.lanes.length+1}`;$('laneName').value=automaticLaneName;}
  const source={Car:'Ô tô',Van:'Xe van',Truck:'Xe tải',Bus:'Xe buýt',Motorcycle:'Xe máy',Cyclist:'Xe đạp',Pedestrian:'Người đi bộ'};
  labels=Object.fromEntries(Object.entries(source).map(([key,value])=>[key,I18n.translate(value)]));
  for(const option of $('classFilter').options)if(option.value)option.textContent=labels[option.value]||option.value;
}
$('language').onchange=()=>{
  I18n.setLanguage($('language').value);updateLanguageLabels();
  if(S.meta)$('datasetInfo').textContent=`K305 · ${S.meta.frames.toLocaleString(I18n.language)} khung hình · ${S.meta.tracks} ID · ${S.meta.source}`;
  render();renderLaneList();I18n.apply();
};
