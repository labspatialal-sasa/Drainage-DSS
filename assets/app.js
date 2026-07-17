/* Drainage Network DSS Dashboard */
(function(){
"use strict";

/* ─── Color helpers ─── */
const RATING_COLORS={
  "Low":["#DCEEDD","#1E7B45"],"Good":["#DCEEDD","#1E7B45"],"Adequate":["#DCEEDD","#1E7B45"],
  "Medium":["#FCF0D2","#8A5E04"],"Moderate":["#FCF0D2","#8A5E04"],
  "Medium-High":["#FBE2C8","#B6560F"],"Restricted":["#FBE2C8","#B6560F"],
  "High":["#F8D7D5","#B3261E"],"Poor":["#F8D7D5","#B3261E"],"Capacity Deficient":["#F8D7D5","#B3261E"],
  "Critical Control Point":["#7B1B1B","#FFFFFF"],
  "P1":["#F8D7D5","#B3261E"],"P2":["#FCF0D2","#8A5E04"],"P3":["#DCEEDD","#1E7B45"],
};
function ratingColor(v){return RATING_COLORS[v]||["#EEF1F3","#7C8A96"];}
function utilColor(v){
  if(v<=100)return["#DCEEDD","#1E7B45"];
  if(v<=300)return["#FBE2C8","#B6560F"];
  return["#F8D7D5","#B3261E"];
}
function chipHtml(value,isUtil){
  if(value===undefined||value===null||value==="")return'<span class="chip chip-gray">&mdash;</span>';
  const[bg,tx]=isUtil?utilColor(value):ratingColor(value);
  const cls=tx==="#1E7B45"?"chip-green":tx==="#8A5E04"?"chip-amber":tx==="#B6560F"?"chip-orange":tx==="#FFFFFF"?"chip-maroon":tx==="#B3261E"?"chip-red":"chip-gray";
  return`<span class="chip ${cls}">${value}${isUtil?"%":""}</span>`;
}

/* ─── Map ─── */
const map=L.map("map",{zoomControl:true,minZoom:3,maxZoom:19});
window.__map=map;
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{
  attribution:'&copy; OpenStreetMap contributors &copy; CARTO',subdomains:"abcd",maxZoom:19
}).addTo(map);
L.control.scale({position:"bottomleft",metric:true,imperial:false}).addTo(map);

let delhiBounds=null;
{
  const dl=L.geoJSON(GEO["1_About_Delhi__Delhi_Boundary"],{style:{color:"#0B3D5C",weight:2.5,dashArray:"6,4",fill:false}});
  delhiBounds=dl.getBounds();
  map.fitBounds(delhiBounds,{padding:[20,20]});
}

/* ─── Style functions ─── */
function mixColor(hA,hB,t){
  const a=hexRgb(hA),b=hexRgb(hB);
  return`rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`;
}
function hexRgb(h){h=h.replace("#","");return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}

function styleFor(styleKey,feature){
  switch(styleKey){
    case"boundary":return{color:"#0B3D5C",weight:2.5,dashArray:"6,4",fill:false};
    case"soil":{const p=["#D8C9A3","#C7B186","#E3D4B0","#B79F73"];const i=(feature.properties.SNUM||0)%p.length;return{color:"#8A7242",weight:1,fillColor:p[i],fillOpacity:0.45};}
    case"sar_flood":return{color:"#1C7293",weight:1,fillColor:"#3FA7C9",fillOpacity:0.35};
    case"building":{const h=feature.properties.height||0;const t=Math.max(0,Math.min(1,(h-3)/15));return{color:"#5A3D22",weight:0.6,fillColor:mixColor("#EADFC4","#6B4423",t),fillOpacity:0.65};}
    case"drain_footprint":return{color:"#0E6E7A",weight:1,fillColor:"#5FB8C4",fillOpacity:0.45};
    case"aoi":return{color:"#B9893D",weight:1.6,dashArray:"5,4",fill:false};
    case"transect":return{color:"#7C8A96",weight:1.2};
    case"outlet":return{radius:5,color:"#0B3D5C",weight:1.5,fillColor:"#3FA7C9",fillOpacity:0.9};
    case"stream_order":{const g=feature.properties.GRID_CODE||feature.properties.grid_code||1;const t=Math.min(1,g/6);return{color:mixColor("#AEDFEF","#0B3D5C",t),weight:1.4+t*2};}
    case"longest_path":return{color:"#0B3D5C",weight:3};
    case"watershed":return{color:"#7A8F5A",weight:1.2,dashArray:"4,3",fillColor:"#D8E4C4",fillOpacity:0.28};
    case"catchment":return{color:"#8F7AAF",weight:1.2,dashArray:"4,3",fillColor:"#E2D8EE",fillOpacity:0.28};
    case"chainage":return{radius:3.5,color:"#0B3D5C",weight:1,fillColor:"#fff",fillOpacity:1};
    case"place_note":return{radius:4,color:"#7C8A96",weight:1,fillColor:"#C3CDD3",fillOpacity:1};
    case"centreline":return{color:"#46566B",weight:4};
    default:return{color:"#1C7293",weight:2};
  }
}

/* ─── Correction 2: Dimension popup builder ─── */
function dimensionBox(props){
  // Try known field names from Drain Chainage and Drain Shape layers
  const w=props.Width||props.width||props.w||props.WIDTH||null;
  const d=props.Depth||props.depth||props.d||props.DEPTH||null;
  const ch=props.Chainage||props.chainage||props.CHAINAGE||null;
  const len=props.Shape_Length||props.SHAPE_Length||props.length||props.len||null;
  const type=props.Drain_Type||props.Type||props.type||null;
  const name=props.Name||props.name||props.DRAIN_NAME||props.Reach||props.reach||null;

  if(!w&&!d&&!ch&&!len) return "";
  let rows="";
  if(name) rows+=`<div class="dim-row"><span>Drain / Reach</span><span>${name}</span></div>`;
  if(type) rows+=`<div class="dim-row"><span>Type</span><span>${type}</span></div>`;
  if(w)    rows+=`<div class="dim-row"><span>Width</span><span>${parseFloat(w).toFixed(2)} m</span></div>`;
  if(d)    rows+=`<div class="dim-row"><span>Depth</span><span>${parseFloat(d).toFixed(2)} m</span></div>`;
  if(w&&d) rows+=`<div class="dim-row"><span>Cross Section</span><span>${(parseFloat(w)*parseFloat(d)).toFixed(2)} m&sup2;</span></div>`;
  if(ch)   rows+=`<div class="dim-row"><span>Chainage</span><span>${parseFloat(ch).toFixed(2)} m</span></div>`;
  if(len)  rows+=`<div class="dim-row"><span>Length</span><span>${parseFloat(len).toFixed(2)} m</span></div>`;
  return `<div class="popup-dim-box"><div class="dim-title">&#9; Dimensions</div>${rows}</div>`;
}

/* DSS reach popup — already has full dimensions */
function dssPopup(props){
  return`<div class="popup-title">${props.reach} <span style="color:#7C8A96;font-weight:400">(FID ${props.fid})</span></div>
  <div class="popup-dim-box">
    <div class="dim-title">&#9; Dimensions</div>
    <div class="dim-row"><span>Type</span><span>${props.type}</span></div>
    <div class="dim-row"><span>Width</span><span>${props.w} m</span></div>
    <div class="dim-row"><span>Depth</span><span>${props.d} m</span></div>
    <div class="dim-row"><span>Cross Section</span><span>${(props.w*props.d).toFixed(2)} m&sup2;</span></div>
    <div class="dim-row"><span>Length</span><span>${props.len.toFixed(1)} m</span></div>
    <div class="dim-row"><span>Division / Ward</span><span>${props.div} / ${props.ward}</span></div>
  </div>
  <div class="popup-row"><span>Capacity / Flow</span><span>${props.cap} / ${props.flow} m&sup3;/s</span></div>
  <div class="popup-row"><span>Utilization</span><span>${chipHtml(props.util,true)}</span></div>
  <div class="popup-row"><span>Silt Risk</span><span>${chipHtml(props.siltRisk)}</span></div>
  <div class="popup-row"><span>Backflow Risk</span><span>${chipHtml(props.backflow)}</span></div>
  <div class="popup-row"><span>Accessibility</span><span>${chipHtml(props.access)}</span></div>
  <div class="popup-row"><span>Priority</span><span>${chipHtml(props.priority)}</span></div>
  <div class="popup-row"><span>Final Status</span><span>${chipHtml(props.status)}</span></div>
  ${props.remarks?`<div style="margin-top:6px;font-size:11.5px;color:#5B6B79">${props.remarks}</div>`:""}`;
}

function prettyKey(k){return k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function genericPopup(feature,layerName,showDimensions){
  const props=feature.properties||{};
  // Show dimension box at the top if flagged
  const dimBlock=showDimensions?dimensionBox(props):"";
  let rows="";
  Object.keys(props).slice(0,12).forEach(k=>{
    if(["Id","SrcFID","Width","Depth","Chainage","Shape_Length","SHAPE_Length"].includes(k)&&showDimensions) return;// already in dim box
    let v=props[k];
    if(v===null||v===undefined||v==="") return;
    if(typeof v==="string"&&v.length>90) v=v.slice(0,87)+"...";
    rows+=`<div class="popup-row"><span>${prettyKey(k)}</span><span>${v}</span></div>`;
  });
  return`<div class="popup-title">${layerName}</div>${dimBlock}${rows||'<div class="popup-row"><span>No attributes</span></div>'}`;
}

/* ─── Layer registry ─── */
const activeLeafletLayers={};
const layerMeta={};
let currentDrainKey="";

function uidFor(drainKey,groupName,layerName){return`${drainKey||"delhi"}::${groupName}::${layerName}`;}

function buildVectorLayer(layerDef){
  const data=GEO[layerDef.geo];if(!data)return null;
  const showDim=!!layerDef.showDimensions;
  return L.geoJSON(data,{
    pointToLayer:(feature,latlng)=>L.circleMarker(latlng,styleFor(layerDef.style,feature)),
    style:(feature)=>styleFor(layerDef.style,feature),
    onEachFeature:(feature,layer)=>{
      layer.bindPopup(genericPopup(feature,layerDef.name,showDim));
    },
  });
}

function buildDssThemeLayer(drainKey,field){
  const data=DSS[drainKey];if(!data)return null;
  const isUtil=field==="util";
  return L.geoJSON(data,{
    style:(feature)=>{
      const v=feature.properties[field];
      const[bg,tx]=isUtil?utilColor(v):ratingColor(v);
      return{color:tx,weight:5,opacity:0.95};
    },
    onEachFeature:(feature,layer)=>{
      layer.bindPopup(dssPopup(feature.properties));
      layer.on("mouseover",()=>layer.setStyle({weight:8}));
      layer.on("mouseout",()=>layer.setStyle({weight:5}));
    },
  });
}

function buildDssBaseLayer(drainKey){
  const data=DSS[drainKey];if(!data)return null;
  return L.geoJSON(data,{
    style:()=>styleFor("centreline"),
    onEachFeature:(feature,layer)=>layer.bindPopup(dssPopup(feature.properties)),
  });
}

function buildGroundTruthLayer(drainKey){
  const pts=GROUND_TRUTH[drainKey];if(!pts)return null;
  const group=L.layerGroup();
  pts.forEach(p=>{
    const marker=L.circleMarker([p.lat,p.lon],{radius:6,color:"#fff",weight:1.5,fillColor:"#C9622A",fillOpacity:1});
    let photosHtml="";
    if(p.photos&&p.photos.length){
      photosHtml='<div class="gt-thumb-row">'+p.photos.map(ph=>`<img src="assets/photos/${ph}" data-full="assets/photos/${ph}" data-caption="${p.name}" class="gt-thumb"/>`).join("")+"</div>";
    }
    marker.bindPopup(`<div class="popup-title">Ground Truth: ${p.name}</div>${photosHtml||'<div class="popup-row"><span>No photo</span></div>'}`);
    marker.on("popupopen",()=>{
      document.querySelectorAll(".gt-thumb").forEach(img=>{
        img.addEventListener("click",()=>openPhotoModal(img.dataset.full,img.dataset.caption));
      });
    });
    group.addLayer(marker);
  });
  return group;
}

function buildRasterLayer(drainKey,rasterKey){
  const meta=RASTERS[`${drainKey}_${rasterKey}`];if(!meta)return null;
  return L.imageOverlay(`assets/rasters/${meta.png}`,meta.bounds,{opacity:0.82,interactive:false});
}

function instantiateLayer(drainKey,groupName,layerDef){
  switch(layerDef.type){
    case"vector-line":case"vector-fill":case"vector-point":return buildVectorLayer(layerDef);
    case"raster":return buildRasterLayer(drainKey,layerDef.raster_key);
    case"ground-truth":return buildGroundTruthLayer(drainKey);
    case"dss-base":return buildDssBaseLayer(drainKey);
    case"dss-theme":return buildDssThemeLayer(drainKey,layerDef.field);
    default:return null;
  }
}

function setLayerVisible(uid,drainKey,groupName,layerDef,visible){
  if(visible){
    if(!activeLeafletLayers[uid]){
      const l=instantiateLayer(drainKey,groupName,layerDef);
      if(l)activeLeafletLayers[uid]=l;
    }
    if(activeLeafletLayers[uid])activeLeafletLayers[uid].addTo(map);
  }else{
    if(activeLeafletLayers[uid])map.removeLayer(activeLeafletLayers[uid]);
  }
  updateActiveLayersDisplay();
}

/* ─── Active Layers box ─── */
const ALB_COLOR={boundary:"#0B3D5C",soil:"#C7B186",sar_flood:"#3FA7C9",building:"#8C6A3F",drain_footprint:"#5FB8C4",aoi:"#B9893D",transect:"#7C8A96",outlet:"#3FA7C9",stream_order:"#0B3D5C",longest_path:"#0B3D5C",watershed:"#D8E4C4",catchment:"#E2D8EE",chainage:"#0B3D5C",place_note:"#C3CDD3",centreline:"#46566B"};
function albSwatch(meta){
  if(meta.type==="raster")return`<span class="alb-dot" style="background:linear-gradient(90deg,#9fd0e6,#1C7293)"></span>`;
  if(meta.type==="ground-truth")return`<span class="alb-dot round" style="background:#C9622A"></span>`;
  if(meta.type==="dss-theme"||meta.type==="dss-base")return`<span class="alb-dot" style="background:#46566B"></span>`;
  const c=ALB_COLOR[meta.style]||"#1C7293";
  const isLine=["aoi","transect","longest_path","stream_order","centreline"].includes(meta.style);
  return`<span class="alb-dot${isLine?" line":""}" style="background:${c}"></span>`;
}
function updateActiveLayersDisplay(){
  const list=document.getElementById("activeLayersList");if(!list)return;
  const vis=Object.keys(activeLeafletLayers).filter(uid=>map.hasLayer(activeLeafletLayers[uid]));
  if(!vis.length){list.innerHTML='<div class="alb-empty">No layers turned on</div>';return;}
  list.innerHTML=vis.map(uid=>{
    const meta=layerMeta[uid]||{name:uid};
    return`<div class="alb-item">${albSwatch(meta)}<span>${meta.name}</span><span class="alb-remove" data-uid="${uid}" title="Turn off">&times;</span></div>`;
  }).join("");
  list.querySelectorAll(".alb-remove").forEach(el=>{
    el.addEventListener("click",()=>{
      const uid=el.dataset.uid;
      const cb=document.getElementById(uid);
      if(cb){cb.checked=false;cb.dispatchEvent(new Event("change"));}
      else{map.removeLayer(activeLeafletLayers[uid]);updateActiveLayersDisplay();}
    });
  });
}

/* ─── Legend panel ─── */
function swatchHtml(layerDef){
  const lineStyles=["aoi","transect","longest_path","stream_order","centreline"];
  const colorMap={boundary:"#0B3D5C",soil:"#C7B186",sar_flood:"#3FA7C9",building:"#D8C49B",drain_footprint:"#5FB8C4",aoi:"#B9893D",transect:"#7C8A96",outlet:"#3FA7C9",stream_order:"#0B3D5C",longest_path:"#0B3D5C",watershed:"#D8E4C4",catchment:"#E2D8EE",chainage:"#0B3D5C",place_note:"#C3CDD3",centreline:"#46566B"};
  if(layerDef.type==="raster")return`<span class="legend-swatch" style="background:linear-gradient(90deg,#9fd0e6,#1C7293)" title="Low to High"></span>`;
  if(layerDef.type==="ground-truth")return`<span class="legend-swatch" style="background:#C9622A;border-radius:50%"></span>`;
  if(layerDef.type==="dss-theme"||layerDef.type==="dss-base")return`<span class="legend-swatch line" style="background:#46566B"></span>`;
  const c=colorMap[layerDef.style]||"#1C7293";
  const isLine=lineStyles.includes(layerDef.style);
  return`<span class="legend-swatch${isLine?" line":""}" style="background:${c}"></span>`;
}

function renderLegend(){
  const body=document.getElementById("legendBody");body.innerHTML="";
  body.appendChild(renderHeadBlock(null,LEGEND.about_delhi));
  if(currentDrainKey){
    const drain=LEGEND.drains.find(d=>d.key===currentDrainKey);
    body.appendChild(renderHeadBlock(drain.key,drain,`${drain.name} (Ward ${drain.ward})`));
  }else{
    const note=document.createElement("div");note.className="legend-empty-note";
    note.textContent="Select a drain from the dropdown above to load its assessment layers.";
    body.appendChild(note);
  }
  updateActiveLayersDisplay();
}

function renderHeadBlock(drainKey,headObj,dataGroupLabel){
  const wrap=document.createElement("div");wrap.className="legend-head-block";
  const title=document.createElement("div");title.className="legend-head-title";title.textContent=headObj.head;wrap.appendChild(title);
  if(dataGroupLabel){const dg=document.createElement("div");dg.className="legend-datagroup-title";dg.textContent=dataGroupLabel;wrap.appendChild(dg);}
  headObj.groups.forEach(grp=>{
    const g=document.createElement("div");g.className="legend-group";
    const head=document.createElement("div");head.className="legend-group-head";
    head.innerHTML=`<span class="chev">&#9660;</span><span>${grp.group}</span>`;
    head.addEventListener("click",()=>g.classList.toggle("collapsed"));
    g.appendChild(head);
    const lw=document.createElement("div");lw.className="legend-group-layers";
    grp.layers.forEach(layerDef=>{
      const uid=uidFor(drainKey,grp.group,layerDef.name);
      layerMeta[uid]={name:layerDef.name,style:layerDef.style,type:layerDef.type};
      const row=document.createElement("div");row.className="legend-layer-row";
      const existing=activeLeafletLayers[uid];
      const isChecked=existing?map.hasLayer(existing):!!layerDef.default_on;
      const hint=layerDef.type==="raster"?' <span class="legend-lowhigh">(Low &rarr; High)</span>':"";
      row.innerHTML=`<input type="checkbox" id="${uid}" ${isChecked?"checked":""}>${swatchHtml(layerDef)}<label for="${uid}">${layerDef.name}${hint}</label>`;
      const cb=row.querySelector("input");
      cb.addEventListener("change",()=>{
        if(cb.checked&&layerDef.type==="dss-theme"){
          grp.layers.forEach(other=>{
            if(other!==layerDef&&other.type==="dss-theme"){
              const ouid=uidFor(drainKey,grp.group,other.name);
              const ocb=document.getElementById(ouid);
              if(ocb&&ocb.checked){ocb.checked=false;setLayerVisible(ouid,drainKey,grp.group,other,false);}
            }
          });
        }
        setLayerVisible(uid,drainKey,grp.group,layerDef,cb.checked);
      });
      lw.appendChild(row);
      if(isChecked&&!existing)setTimeout(()=>setLayerVisible(uid,drainKey,grp.group,layerDef,true),0);
    });
    g.appendChild(lw);wrap.appendChild(g);
  });
  return wrap;
}

function clearDrainLayers(){
  Object.keys(activeLeafletLayers).forEach(uid=>{
    if(!uid.startsWith("delhi::")){map.removeLayer(activeLeafletLayers[uid]);delete activeLeafletLayers[uid];}
  });
}

document.getElementById("drainSelect").addEventListener("change",e=>{
  clearDrainLayers();
  currentDrainKey=e.target.value;
  renderLegend();
  if(currentDrainKey){
    map.fitBounds(L.geoJSON(DSS[currentDrainKey]).getBounds(),{padding:[60,60]});
  }else{
    map.fitBounds(delhiBounds,{padding:[20,20]});
  }
  renderDssTab();renderRecommendTab();
});
renderLegend();

/* Legend collapse */
document.getElementById("legendCollapseBtn").addEventListener("click",()=>{
  document.getElementById("legendPanel").style.display="none";
  document.getElementById("legendExpandBtn").style.display="block";
  setTimeout(()=>map.invalidateSize(),50);
});
document.getElementById("legendExpandBtn").addEventListener("click",()=>{
  document.getElementById("legendPanel").style.display="flex";
  document.getElementById("legendExpandBtn").style.display="none";
  setTimeout(()=>map.invalidateSize(),50);
});

/* Search */
function buildSearchIndex(){
  const idx=[];
  ["drain1","drain2"].forEach(dk=>{
    (DSS[dk]?DSS[dk].features:[]).forEach(f=>{
      const c=f.geometry.type==="LineString"?f.geometry.coordinates[Math.floor(f.geometry.coordinates.length/2)]:f.geometry.coordinates[0][Math.floor(f.geometry.coordinates[0].length/2)];
      idx.push({type:"Reach",drain:dk,name:f.properties.reach,lat:c[1],lon:c[0]});
    });
    (GROUND_TRUTH[dk]||[]).forEach(p=>idx.push({type:"Ground Truth",drain:dk,name:p.name,lat:p.lat,lon:p.lon}));
  });
  return idx;
}
const searchIndex=buildSearchIndex();
const searchBox=document.getElementById("searchBox"),searchResults=document.getElementById("searchResults");
searchBox.addEventListener("input",()=>{
  const q=searchBox.value.trim().toLowerCase();
  if(!q){searchResults.classList.remove("show");return;}
  const matches=searchIndex.filter(i=>i.name.toLowerCase().includes(q)).slice(0,12);
  if(!matches.length){searchResults.innerHTML='<div class="search-result-item">No matches</div>';searchResults.classList.add("show");return;}
  searchResults.innerHTML=matches.map((m,i)=>`<div class="search-result-item" data-i="${i}"><div class="sr-type">${m.type} &middot; ${m.drain==="drain1"?"Srinivaspuri":"Z Block"}</div>${m.name}</div>`).join("");
  searchResults.classList.add("show");
  searchResults.querySelectorAll(".search-result-item").forEach((el,i)=>{
    el.addEventListener("click",()=>{
      const m=matches[i];
      if(currentDrainKey!==m.drain){document.getElementById("drainSelect").value=m.drain;document.getElementById("drainSelect").dispatchEvent(new Event("change"));}
      map.setView([m.lat,m.lon],18);searchResults.classList.remove("show");searchBox.value=m.name;
    });
  });
});
document.addEventListener("click",e=>{if(!e.target.closest(".legend-search"))searchResults.classList.remove("show");});

/* Photo modal */
function openPhotoModal(src,caption){document.getElementById("photoModalImg").src=src;document.getElementById("photoModalCaption").textContent=caption||"";document.getElementById("photoModal").classList.add("show");}
document.getElementById("photoModalClose").addEventListener("click",()=>document.getElementById("photoModal").classList.remove("show"));
document.getElementById("photoModal").addEventListener("click",e=>{if(e.target.id==="photoModal")e.currentTarget.classList.remove("show");});

/* ─── Tabs ─── */
let rainfallRendered=false;
document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
    if(btn.dataset.tab==="map")setTimeout(()=>map.invalidateSize(),50);
    if(btn.dataset.tab==="rainfall"&&!rainfallRendered){rainfallRendered=true;setTimeout(renderRainfallTab,0);}
  });
});

/* ─── Rainfall ─── */
function renderRainfallTab(){
  const totals=RAINFALL.annual_totals,maxes=RAINFALL.annual_max;
  new Chart(document.getElementById("chartAnnualTotal"),{type:"bar",data:{labels:totals.map(d=>d[0]),datasets:[{label:"Annual Rainfall (mm)",data:totals.map(d=>d[1]),backgroundColor:"#1C7293",yAxisID:"y"},{label:"Rainy Days",data:totals.map(d=>d[2]),type:"line",borderColor:"#B9893D",backgroundColor:"#B9893D",yAxisID:"y2",tension:.25}]},options:{responsive:true,scales:{y:{position:"left",title:{display:true,text:"mm"}},y2:{position:"right",title:{display:true,text:"days"},grid:{drawOnChartArea:false}}},plugins:{legend:{position:"bottom"}}}});
  new Chart(document.getElementById("chartAnnualMax"),{type:"line",data:{labels:maxes.map(d=>d[0]),datasets:[{label:"Max Single-Day Rainfall (mm)",data:maxes.map(d=>d[1]),borderColor:"#B3261E",backgroundColor:"#F8D7D5",fill:true,tension:.2}]},options:{responsive:true,plugins:{legend:{display:false}}}});
  const years=[...new Set(RAINFALL.daily.map(d=>d[2]))].sort((a,b)=>b-a);
  const yearSelect=document.getElementById("yearSelect");
  yearSelect.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join("");
  let dailyChart=null;
  function drawDaily(year){
    const rows=RAINFALL.daily.filter(d=>d[2]===year);
    if(dailyChart)dailyChart.destroy();
    dailyChart=new Chart(document.getElementById("chartDaily"),{type:"bar",data:{labels:rows.map(d=>d[0].slice(5)),datasets:[{label:`Daily Rainfall ${year} (mm)`,data:rows.map(d=>d[1]),backgroundColor:"#1C7293"}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{maxTicksLimit:24}}}}});
  }
  yearSelect.addEventListener("change",()=>drawDaily(parseInt(yearSelect.value)));
  drawDaily(years[0]);
}

/* ─── DSS tab ─── */
function renderDssTab(){
  const wrap=document.getElementById("dssTableWrap"),note=document.getElementById("dssDrainNote");
  if(!currentDrainKey){wrap.innerHTML="";note.textContent="Select a drain from the dropdown above to view its reach-wise decision support matrix.";return;}
  const dm=LEGEND.drains.find(d=>d.key===currentDrainKey);
  note.textContent=`${dm.name} (Ward ${dm.ward}) — ${DSS[currentDrainKey].features.length} reach segments.`;
  const rows=DSS[currentDrainKey].features.map(f=>f.properties);
  let html=`<div class="table-scroll"><table class="data-table"><thead><tr><th>FID</th><th>Reach</th><th>Type</th><th>W (m)</th><th>D (m)</th><th>Length (m)</th><th>Cap (m&sup3;/s)</th><th>Flow</th><th>Utilization</th><th>Silt Risk</th><th>Backflow</th><th>Access</th><th>Priority</th><th>Final Status</th></tr></thead><tbody>`;
  rows.forEach(r=>{html+=`<tr><td>${r.fid}</td><td>${r.reach}</td><td>${r.type}</td><td>${r.w}</td><td>${r.d}</td><td>${r.len.toFixed(1)}</td><td>${r.cap}</td><td>${r.flow}</td><td>${chipHtml(r.util,true)}</td><td>${chipHtml(r.siltRisk)}</td><td>${chipHtml(r.backflow)}</td><td>${chipHtml(r.access)}</td><td>${chipHtml(r.priority)}</td><td>${chipHtml(r.status)}</td></tr>`;});
  wrap.innerHTML=html+"</tbody></table></div>";
}

/* ─── Recommendations tab ─── */
function suggestTechnique(type){
  const pool=DESILTING.filter(o=>o.drain_type&&(o.drain_type.includes(type)||o.drain_type==="Entire Network"||o.drain_type==="Open & Covered"));
  const best=pool.find(o=>o.suitability==="Very High")||pool.find(o=>o.suitability==="High")||pool[0];
  return best?best.technique:"Manual Desilting";
}
function renderRecommendTab(){
  const actionsWrap=document.getElementById("priorityActionsWrap");
  if(!currentDrainKey){actionsWrap.innerHTML='<p class="panel-note">Select a drain to see reach-specific priority actions, in addition to the general options below.</p>';}
  else{
    const dm=LEGEND.drains.find(d=>d.key===currentDrainKey);
    const priority=DSS[currentDrainKey].features.filter(f=>f.properties.status!=="Adequate").map(f=>f.properties);
    let html=`<h3 style="color:#0B3D5C;font-size:17px;margin:0 0 12px">Priority Actions — ${dm.name}</h3>`;
    if(!priority.length){html+='<p class="panel-note">No capacity-deficient or critical reaches identified.</p>';}
    else{priority.forEach(p=>{html+=`<div style="border-left:4px solid #B3261E;background:#fff;border:1px solid #DCE6EB;border-radius:8px;padding:12px 14px;margin-bottom:10px"><div style="font-weight:700;font-size:13.5px">${p.reach} (${p.from} &rarr; ${p.to}) &nbsp;${chipHtml(p.priority)} ${chipHtml(p.status)}</div><div style="font-size:11.5px;color:#5B6B79;margin-top:2px">Type: ${p.type} &middot; W: ${p.w}m &middot; D: ${p.d}m &middot; Utilization ${p.util}% &middot; Silt Risk ${p.siltRisk}</div><div style="font-size:12.5px;margin-top:6px"><strong>Suggested:</strong> ${suggestTechnique(p.type)}</div></div>`;});}
    actionsWrap.innerHTML=html;
  }
  const tblWrap=document.getElementById("desiltingTableWrap");
  let html2=`<div class="table-scroll"><table class="data-table"><thead><tr><th>Technique</th><th>Drain Type</th><th>Cost</th><th>Timeline</th><th>Suitability</th><th>Remarks</th></tr></thead><tbody>`;
  DESILTING.forEach(o=>{html2+=`<tr><td>${o.technique}</td><td>${o.drain_type}</td><td>${o.cost}</td><td>${o.timeline}</td><td>${o.suitability}</td><td>${o.remarks}</td></tr>`;});
  tblWrap.innerHTML=html2+"</tbody></table></div>";
}

/* ─── Reports tab ─── */
function renderReportsTab(){
  document.getElementById("reportCards").innerHTML=`
  <div class="report-card"><div class="rc-icon">&#128196;</div><h3>Srinivaspuri &amp; Friends Colony Drain</h3><p class="panel-note" style="margin-bottom:0">Hydrology assessment report &mdash; Ward 174</p><a class="rc-btn" href="assets/reports/Hydrology_Srinivaspuri_Friends.pdf" target="_blank" rel="noopener">Open Report</a></div>
  <div class="report-card"><div class="rc-icon">&#128196;</div><h3>Z Block Drain</h3><p class="panel-note" style="margin-bottom:0">Hydrology assessment report &mdash; Ward 177</p><a class="rc-btn" href="assets/reports/Hydrology_ZBlock.pdf" target="_blank" rel="noopener">Open Report</a></div>`;
}

/* ─── Init ─── */
renderDssTab();renderRecommendTab();renderReportsTab();

})();
