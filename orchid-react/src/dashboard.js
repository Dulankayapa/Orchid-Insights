import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { jsPDF } from 'jspdf';
import { db as firebaseDb } from './firebase';
import { ref, onValue, onChildAdded, push, set, query, limitToLast } from 'firebase/database';

export function initDashboard(){
  const db = firebaseDb;


const $ = (id)=>document.getElementById(id);
/* ===================== UI refs ===================== */
const tempEl=$('temp'), humEl=$('hum'), luxEl=$('lux'), mqEl=$('mq');
const tempAlert=$('tempAlert'), humAlert=$('humAlert'), luxAlert=$('luxAlert'), aqAlert=$('aqAlert');
const tempPill=$('tempPill'), humPill=$('humPill'), luxPill=$('luxPill'), mqPill=$('mqPill');
const tempDot=$('tempDot'), humDot=$('humDot'), luxDot=$('luxDot'), mqDot=$('mqDot');
const connPill=$('connPill'), lastUpdated=$('lastUpdated'), alertsBox=$('alertsBox'), pointsCount=$('pointsCount');
const tempLive=$('tempLive'), humLive=$('humLive'), luxLive=$('luxLive'), mqLive=$('mqLive');
const overallIcon=$('overallIcon');
const overallTitle=$('overallTitle');
const overallMsg=$('overallMsg');
const healthFresh = $('healthFresh');
const healthFb = $('healthFb');
const healthRate = $('healthRate');
const healthMissing = $('healthMissing');
const aiQuoteText = $('aiQuoteText');
const aiKicker = $('aiKicker');
const aiTag = $('aiTag');
const aiReason = $('aiReason');
const newTipBtn = $('newTipBtn');
const copyTipBtn = $('copyTipBtn');
const tempStatsEl = $('tempStats');
const humStatsEl  = $('humStats');
const luxStatsEl  = $('luxStats');
const mqStatsEl   = $('mqStats');

// ✅ GROWTH UI REFS (ADDED)
const latestGrowthEl = $('latestGrowth');
const growthPill = $('growthPill');
const growthDot = $('growthDot');
const growthAlert = $('growthAlert');

/* ===================== Accordion (mobile + usability) ===================== */
function setupAccordion(toggleId, bodyId, storageKey){
  const btn = $(toggleId);
  const body = $(bodyId);
  const key = storageKey;
  const saved = localStorage.getItem(key);
  let open = saved ? saved === '1' : true;
  function render(){
    body.hidden = !open;
    btn.textContent = open ? 'Collapse' : 'Expand';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  btn.addEventListener('click', ()=>{
    open = !open;
    localStorage.setItem(key, open ? '1' : '0');
    render();
  });
  if(window.matchMedia('(max-width: 640px)').matches && saved == null){
    open = (toggleId === 'alertsToggle');
  }
  render();
}
setupAccordion('rangesToggle','rangesBody','acc_ranges');
setupAccordion('alertsToggle','alertsBody','acc_alerts');
setupAccordion('aiToggle','aiBody','acc_ai');
setupAccordion('growthToggle','growthBody','acc_growth');

/* ===================== Toast + Sound ===================== */
const SOUND_KEY = 'orchid_sound_enabled_v3';
const SOUND_MUTE_UNTIL = 'orchid_sound_mute_until';
let soundEnabled = localStorage.getItem(SOUND_KEY) !== '0';
const toastStack = $('toastStack');
let audioCtx = null;
function getAudioCtx(){
  if(!audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
}
async function unlockAudio(){
  const ctx = getAudioCtx();
  if(!ctx) return false;
  if(ctx.state === 'suspended') await ctx.resume();
  return ctx.state === 'running';
}
function isMutedByTimer(){
  const until = Number(localStorage.getItem(SOUND_MUTE_UNTIL) || '0');
  return until && Date.now() < until;
}
function beep({freq=740, dur=0.10, type='sine', vol=0.03}={}){
  if(!soundEnabled) return;
  if(isMutedByTimer()) return;
  const ctx = getAudioCtx();
  if(!ctx || ctx.state !== 'running') return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g);
  g.connect(ctx.destination);
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.start(now);
  o.stop(now + dur + 0.02);
}
function playAlertSound(kind){
  if(kind === 'danger') beep({freq: 880, dur: 0.10});
  else if(kind === 'warn') beep({freq: 740, dur: 0.09});
}
window.addEventListener('pointerdown', ()=>{ unlockAudio(); }, { once:true });
function renderSoundBtn(){
  const soundBtn = $('soundBtn');
  const muted = isMutedByTimer();
  soundBtn.textContent = muted ? '🔕 Sound: Muted' : (soundEnabled ? '🔊 Sound: On' : '🔇 Sound: Off');
}
renderSoundBtn();
$('soundBtn')?.addEventListener('click', async ()=>{
  if(!soundEnabled){
    await unlockAudio();
    soundEnabled = true;
    localStorage.setItem(SOUND_KEY, '1');
    localStorage.removeItem(SOUND_MUTE_UNTIL);
    renderSoundBtn();
    beep({freq: 920, dur: 0.07, vol: 0.028});
  } else {
    soundEnabled = false;
    localStorage.setItem(SOUND_KEY, '0');
    renderSoundBtn();
  }
});
function toast(kind, title, message, opts={}){
  if(!toastStack) return;
  const dur = opts.duration ?? 5200;
  const badgeColor =
    kind === 'danger' ? 'var(--red)' :
    kind === 'warn' ? 'var(--orange)' :
    kind === 'safe' ? 'var(--green)' : 'var(--c-hum)';
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role','status');
  el.innerHTML = `
    <span class="badge" style="background:${badgeColor}"></span>
    <div class="txt">
      <p class="ttl">${title}</p>
      <p class="msg">${message ?? ''}</p>
    </div>
    <div class="actions">
      <button class="btnMini muteBtn" title="Mute for 1 hour">🔕 1h</button>
      <button class="btnMini toggleSoundBtn" title="Toggle sound">${soundEnabled ? '🔊' : '🔇'}</button>
      <button class="btnMini closeBtn" title="Dismiss">✕</button>
    </div>
  `;
  const muteBtn = el.querySelector('.muteBtn');
  const toggleSoundBtn = el.querySelector('.toggleSoundBtn');
  const closeBtn = el.querySelector('.closeBtn');
  muteBtn.addEventListener('click', ()=>{
    localStorage.setItem(SOUND_MUTE_UNTIL, String(Date.now() + 60*60*1000));
    renderSoundBtn();
  });
  toggleSoundBtn.addEventListener('click', async ()=>{
    if(soundEnabled){
      soundEnabled = false;
      localStorage.setItem(SOUND_KEY,'0');
    } else {
      await unlockAudio();
      soundEnabled = true;
      localStorage.setItem(SOUND_KEY,'1');
      localStorage.removeItem(SOUND_MUTE_UNTIL);
      beep({freq: 920, dur: 0.07, vol: 0.028});
    }
    renderSoundBtn();
    toggleSoundBtn.textContent = soundEnabled ? '🔊' : '🔇';
  });
  closeBtn.addEventListener('click', ()=> el.remove());
  toastStack.appendChild(el);
  let remaining = dur;
  let started = Date.now();
  let timer = setTimeout(()=> el.remove(), remaining);
  el.addEventListener('mouseenter', ()=>{
    clearTimeout(timer);
    remaining -= (Date.now() - started);
  });
  el.addEventListener('mouseleave', ()=>{
    started = Date.now();
    clearTimeout(timer);
    timer = setTimeout(()=> el.remove(), Math.max(250, remaining));
  });
  function onKey(e){
    if(e.key === 'Escape'){
      el.remove();
      window.removeEventListener('keydown', onKey);
    }
  }
  window.addEventListener('keydown', onKey);
}
/* --- Dedup + snooze --- */
const notifyState = { stale:false, tempDanger:false, humDanger:false, mqDanger:false, luxLow:false, luxHigh:false };
const snoozeUntil = {};
function isSnoozed(key){
  const u = snoozeUntil[key] || 0;
  return Date.now() < u;
}
function snooze(key, minutes=10){
  snoozeUntil[key] = Date.now() + minutes*60*1000;
  toast('neutral','Snoozed', `Muted "${key}" alerts for ${minutes} minutes.`);
}
function notifyProblemOnce(key, kind, title, detail){
  if(isSnoozed(key)) return;
  if(notifyState[key]) return;
  notifyState[key] = true;
  toast(kind, title, detail);
  playAlertSound(kind);
}
function clearProblem(key){ notifyState[key] = false; }
/* ---------- Settings ---------- */
const DEFAULTS = { tMin: 8, tMax: 35, hMin: 30, hMax: 80, lMin: 50, lMax: 800, mqWarn: 2500, staleSec: 25 };
const SETTINGS_KEY = 'orchid_settings_v3';
let settings = (()=>{ try{ const raw=localStorage.getItem(SETTINGS_KEY); return raw?{...DEFAULTS,...JSON.parse(raw)}:{...DEFAULTS}; }catch{ return {...DEFAULTS}; } })();
const tMin=$('tMin'), tMax=$('tMax'), hMin=$('hMin'), hMax=$('hMax'), lMin=$('lMin'), lMax=$('lMax'), mqWarn=$('mqWarn'), staleSec=$('staleSec');
function renderSettings(){
  tMin.value=settings.tMin; tMax.value=settings.tMax; hMin.value=settings.hMin; hMax.value=settings.hMax;
  lMin.value=settings.lMin; lMax.value=settings.lMax; mqWarn.value=settings.mqWarn; staleSec.value=settings.staleSec;
}
renderSettings();
$('saveSettings').addEventListener('click', ()=>{
  settings = {
    tMin:Number(tMin.value), tMax:Number(tMax.value),
    hMin:Number(hMin.value), hMax:Number(hMax.value),
    lMin:Number(lMin.value), lMax:Number(lMax.value),
    mqWarn:Number(mqWarn.value),
    staleSec:Math.max(5, Number(staleSec.value)||DEFAULTS.staleSec),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  $('settingsHint').textContent='Saved ✓';
  toast('safe','Ranges saved','Chart bands and alerts updated.');
  setTimeout(()=> $('settingsHint').textContent='Saved locally (per browser)', 1200);
  requestOverlayUpdateAll();
});
$('resetSettings').addEventListener('click', ()=>{
  settings = {...DEFAULTS};
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  renderSettings();
  $('settingsHint').textContent='Reset ✓';
  toast('neutral','Ranges reset','Back to default thresholds.');
  setTimeout(()=> $('settingsHint').textContent='Saved locally (per browser)', 1200);
  requestOverlayUpdateAll();
});
/* ---------- Theme ---------- */
const THEME_KEY='orchid_theme';
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  $('themeBtn').textContent = theme==='night' ? '☀️ Theme' : '🌙 Theme';
}
applyTheme(localStorage.getItem(THEME_KEY) || 'day');
/* ---------- Range + Pause ---------- */
let paused=false;
$('pauseBtn').addEventListener('click', ()=>{
  paused=!paused;
  $('pauseBtn').textContent = paused ? '▶ Resume' : '⏸ Pause';
  $('modeLabel').textContent = paused ? 'Paused' : 'Live';
  toast('neutral', paused ? 'Paused' : 'Resumed', paused ? 'Live updates are paused.' : 'Live updates resumed.');
});
let range='1h';
document.querySelectorAll('.segbtn').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.segbtn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    range=b.dataset.range;
    trimToRange();
    rebuildChartsFromPoints();
    updateAllStats();
    toast('neutral','Range changed', `Showing: ${range.toUpperCase()}`);
  });
});
/* ---------- Layout controls ---------- */
function setCardState(id, state){ localStorage.setItem('card_state_'+id, state); applyCardState(id); }
$('showAllBtn').addEventListener('click', ()=>{
  // ✅ NOW INCLUDES growthTile
  ['tempTile','humTile','luxTile','mqTile','growthTile','healthCard','tempChartCard','humChartCard','luxChartCard','mqChartCard'].forEach(id=>setCardState(id,'open'));
  localStorage.setItem('card_state_logContainer','open');
  applyLogState();
  toast('safe','Layout','All cards shown.');
});
let chartsHidden = false;
$('hideChartsBtn').addEventListener('click', ()=>{
  chartsHidden = !chartsHidden;
  $('chartsCard').style.display = chartsHidden ? 'none' : '';
  $('hideChartsBtn').textContent = chartsHidden ? '📈 Show charts' : '📉 Hide charts';
});
$('resetLayoutBtn').addEventListener('click', ()=>{
  // ✅ NOW INCLUDES growthTile
  ['tempTile','humTile','luxTile','mqTile','growthTile','healthCard','tempChartCard','humChartCard','luxChartCard','mqChartCard'].forEach(id=>localStorage.removeItem('card_state_'+id));
  localStorage.removeItem('card_state_logContainer');
  ['tempTile','humTile','luxTile','mqTile','growthTile','healthCard','tempChartCard','humChartCard','luxChartCard','mqChartCard'].forEach(applyCardState);
  applyLogState();
  toast('neutral','Layout reset','Back to default open state.');
});
/* ---------- Export CSV ---------- */
const points=[];
$('exportBtn').addEventListener('click', ()=>{
  const rows=[['time','temperature','humidity','lux','mq135']];
  for(const p of points){
    rows.push([p.tsISO, p.t, p.h, p.lx, p.mq].map(v => String(v ?? '')));
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='orchid_readings.csv';
  document.body.appendChild(a); a.click(); a.remove();
  toast('safe','Exported CSV','orchid_readings.csv downloaded.');
});
/* ---------- Helpers ---------- */
function safeNum(v){
  const n=Number(v);
  return Number.isFinite(n) ? n : null;
}
function setDot(dot, kind){ dot.className='dot '+(kind||''); }
function setPill(pill, kind, text){ pill.className='pill '+kind; pill.textContent=text; }
function mean(nums){
  const a=nums.filter(x=>Number.isFinite(x));
  return a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
}
function stats(nums){
  const a=nums.filter(x=>Number.isFinite(x));
  if(!a.length) return null;
  let min=a[0], max=a[0];
  for(const v of a){ if(v<min) min=v; if(v>max) max=v; }
  return { min, max, avg: mean(a), latest: a[a.length-1] };
}
function chip(label, value){
  const span=document.createElement('span');
  span.className='statChip';
  span.textContent = `${label}: ${value}`;
  return span;
}
function renderStats(el, unit, arr, formatFn){
  el.innerHTML='';
  const st = stats(arr);
  if(!st){
    el.appendChild(chip('Latest','—'));
    el.appendChild(chip('Min','—'));
    el.appendChild(chip('Avg','—'));
    el.appendChild(chip('Max','—'));
    return;
  }
  const f = (v)=>formatFn ? formatFn(v) : (unit ? `${v.toFixed(1)} ${unit}` : String(v));
  el.appendChild(chip('Latest', f(st.latest)));
  el.appendChild(chip('Min', f(st.min)));
  el.appendChild(chip('Avg', f(st.avg)));
  el.appendChild(chip('Max', f(st.max)));
}
function computeOverallStatus({stale, T, H, LX, MQ}){
  if(stale){
    return { icon:'🔴', title:'Offline / stale data', msg:`No updates for > ${settings.staleSec}s. Check device power + Wi-Fi + Firebase.` };
  }
  const problems=[];
  if(T!=null && (T<settings.tMin || T>settings.tMax)) problems.push(`Temp out (${T.toFixed(1)}°C)`);
  if(H!=null && (H<settings.hMin || H>settings.hMax)) problems.push(`Humidity out (${H.toFixed(1)}%)`);
  if(LX!=null && (LX<settings.lMin)) problems.push(`Light low (${Math.round(LX)} lx)`);
  if(LX!=null && (LX>settings.lMax)) problems.push(`Light high (${Math.round(LX)} lx)`);
  if(MQ!=null && (MQ>settings.mqWarn)) problems.push(`Air poor (MQ ${MQ})`);
  if(!problems.length){
    return { icon:'✅', title:'All conditions stable', msg:'Environment is within your configured safe bands.' };
  }
  const isDanger = problems.some(p=>p.includes('out') || p.includes('Air'));
  return {
    icon: isDanger ? '⚠️' : '🟠',
    title: isDanger ? 'Action recommended' : 'Minor warnings',
    msg: problems.slice(0,3).join(' • ') + (problems.length>3 ? ` • +${problems.length-3} more` : '')
  };
}
/* ---------- Charts overlays + hover sync ---------- */
function hexToRGBA(hex, a){
  const h=hex.replace('#','');
  const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function gradientFill(ctx, hex){
  const g=ctx.createLinearGradient(0,0,0,260);
  g.addColorStop(0, hexToRGBA(hex, 0.22));
  g.addColorStop(1, hexToRGBA(hex, 0.00));
  return g;
}
const overlayPlugin = {
  id:'safeOverlays',
  afterDraw(chart, args, pluginOpts){
    const {ctx, chartArea, scales} = chart;
    if(!chartArea) return;
    const { left, right, top, bottom } = chartArea;
    const y = scales.y;
    const kind = pluginOpts?.kind;
    ctx.save();
    if(kind === 'temp'){
      drawBand(ctx, y, left, right, top, bottom, settings.tMin, settings.tMax, 'rgba(34,197,94,.10)');
    }
    if(kind === 'hum'){
      drawBand(ctx, y, left, right, top, bottom, settings.hMin, settings.hMax, 'rgba(34,197,94,.10)');
    }
    if(kind === 'lux'){
      drawBand(ctx, y, left, right, top, bottom, settings.lMin, settings.lMax, 'rgba(34,197,94,.08)');
    }
    if(kind === 'mq'){
      drawLine(ctx, y, left, right, settings.mqWarn, 'rgba(239,68,68,.50)');
    }
    const active = chart.getActiveElements();
    if(active && active.length){
      const xPos = active[0].element.x;
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(99,102,241,.35)';
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.stroke();
    }
    ctx.restore();
  }
};
function drawBand(ctx, yScale, left, right, top, bottom, minVal, maxVal, fill){
  const y1 = yScale.getPixelForValue(maxVal);
  const y2 = yScale.getPixelForValue(minVal);
  const yTop = Math.max(top, Math.min(y1,y2));
  const yBot = Math.min(bottom, Math.max(y1,y2));
  ctx.fillStyle = fill;
  ctx.fillRect(left, yTop, right-left, yBot-yTop);
}
function drawLine(ctx, yScale, left, right, val, stroke){
  const yy = yScale.getPixelForValue(val);
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = stroke;
  ctx.setLineDash([6,4]);
  ctx.moveTo(left, yy);
  ctx.lineTo(right, yy);
  ctx.stroke();
  ctx.setLineDash([]);
}
function makeChart(canvasId, color, yLabel, kind){
  const ctx=document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx,{
    type:'line',
    data:{ datasets:[{
      label:yLabel,
      data:[],
      borderColor: color,
      backgroundColor: gradientFill(ctx, color),
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 4,
      pointBorderColor: color,
      pointBackgroundColor: color,
      tension: 0.35,
      fill: true,
    }]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      animation:false,
      parsing:false,
      normalized:true,
      plugins:{ legend:{display:false}, tooltip:{intersect:false, mode:'index'} },
      interaction:{ intersect:false, mode:'index' },
      scales:{
        x:{ type:'time', time:{ unit:'minute', displayFormats:{ minute:'HH:mm' } }, grid:{ display:false }, ticks:{ maxTicksLimit:6 } },
        y:{ beginAtZero:false, grid:{ color:'rgba(15,23,42,.08)' }, ticks:{ maxTicksLimit:6 } }
      }
    },
    plugins: [overlayPlugin],
    pluginsConfig: { kind }
  });
}
const css = getComputedStyle(document.documentElement);
const tempChart = makeChart('tempChart', css.getPropertyValue('--c-temp').trim(), 'Temperature (°C)', 'temp');
const humChart  = makeChart('humChart',  css.getPropertyValue('--c-hum').trim(),  'Humidity (%)', 'hum');
const luxChart  = makeChart('luxChart',  css.getPropertyValue('--c-lux').trim(),  'Light (lux)', 'lux');
const mqChart   = makeChart('mqChart',   css.getPropertyValue('--c-mq').trim(),   'MQ135', 'mq');
function refreshChartFills(){
  const root=getComputedStyle(document.documentElement);
  const colors={
    temp:root.getPropertyValue('--c-temp').trim(),
    hum: root.getPropertyValue('--c-hum').trim(),
    lux: root.getPropertyValue('--c-lux').trim(),
    mq:  root.getPropertyValue('--c-mq').trim(),
  };
  const pairs=[[tempChart,colors.temp],[humChart,colors.hum],[luxChart,colors.lux],[mqChart,colors.mq]];
  for(const [ch,col] of pairs){
    ch.data.datasets[0].borderColor=col;
    ch.data.datasets[0].pointBorderColor=col;
    ch.data.datasets[0].pointBackgroundColor=col;
    ch.data.datasets[0].backgroundColor=gradientFill(ch.ctx,col);
    ch.update('none');
  }
}
$('themeBtn').addEventListener('click', ()=>{
  const cur=document.documentElement.getAttribute('data-theme')||'day';
  applyTheme(cur==='night'?'day':'night');
  setTimeout(refreshChartFills, 0);
});
/* Hover sync across charts */
const charts = [tempChart, humChart, luxChart, mqChart];
function getNearestIndexByX(ch, x){
  const meta = ch.getDatasetMeta(0);
  const elems = meta?.data || [];
  let best = -1, bestDist = Infinity;
  for(let i=0;i<elems.length;i++){
    const e = elems[i];
    if(!e || typeof e.x !== 'number') continue;
    const d = Math.abs(e.x - x);
    if(d < bestDist){ bestDist = d; best = i; }
  }
  return best;
}
function syncHover(sourceChart, evt){
  const rect = sourceChart.canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const idx = getNearestIndexByX(sourceChart, x);
  if(idx < 0) return;
  for(const ch of charts){
    const meta = ch.getDatasetMeta(0);
    const el = meta?.data?.[idx];
    if(!el) continue;
    ch.setActiveElements([{datasetIndex:0, index: idx}]);
    ch.tooltip?.setActiveElements([{datasetIndex:0, index: idx}], {x: el.x, y: el.y});
    ch.update('none');
  }
}
function clearHover(){
  for(const ch of charts){
    ch.setActiveElements([]);
    ch.tooltip?.setActiveElements([], {x:0,y:0});
    ch.update('none');
  }
}
charts.forEach(ch=>{
  ch.canvas.addEventListener('mousemove', (e)=>syncHover(ch,e));
  ch.canvas.addEventListener('mouseleave', clearHover);
});
/* Force plugin options kind */
function applyOverlayKind(){
  tempChart.config.options.plugins.safeOverlays = { kind: 'temp' };
  humChart.config.options.plugins.safeOverlays  = { kind: 'hum'  };
  luxChart.config.options.plugins.safeOverlays  = { kind: 'lux'  };
  mqChart.config.options.plugins.safeOverlays   = { kind: 'mq'   };
}
applyOverlayKind();
function requestOverlayUpdateAll(){
  applyOverlayKind();
  requestChartUpdate();
}
/* ---------- Batching chart updates ---------- */
let pendingChartUpdate = false;
function requestChartUpdate(){
  if(pendingChartUpdate) return;
  pendingChartUpdate = true;
  requestAnimationFrame(()=>{
    pendingChartUpdate = false;
    tempChart.update('none');
    humChart.update('none');
    luxChart.update('none');
    mqChart.update('none');
  });
}
/* ---------- Live points + time trimming ---------- */
function rangeMs(){
  if(range==='1h') return 60*60*1000;
  if(range==='6h') return 6*60*60*1000;
  if(range==='24h') return 24*60*60*1000;
  return Infinity;
}
function trimToRange(){
  const ms = rangeMs();
  if(ms===Infinity) return;
  const cutoff = Date.now() - ms;
  while(points.length && points[0].ts < cutoff) points.shift();
}
function rebuildChartsFromPoints(){
  pointsCount.textContent=String(points.length);
  tempChart.data.datasets[0].data = points.filter(p=>p.t!=null).map(p=>({x:p.ts, y:p.t}));
  humChart.data.datasets[0].data  = points.filter(p=>p.h!=null).map(p=>({x:p.ts, y:p.h}));
  luxChart.data.datasets[0].data  = points.filter(p=>p.lx!=null).map(p=>({x:p.ts, y:p.lx}));
  mqChart.data.datasets[0].data   = points.filter(p=>p.mq!=null).map(p=>({x:p.ts, y:p.mq}));
  requestChartUpdate();
}
/* ---------- Stats updates ---------- */
function updateAllStats(){
  const tArr = points.map(p=>p.t).filter(v=>v!=null);
  const hArr = points.map(p=>p.h).filter(v=>v!=null);
  const lArr = points.map(p=>p.lx).filter(v=>v!=null);
  const mArr = points.map(p=>p.mq).filter(v=>v!=null);
  renderStats(tempStatsEl, '°C', tArr, (v)=>`${v.toFixed(1)} °C`);
  renderStats(humStatsEl, '%',  hArr, (v)=>`${v.toFixed(1)} %`);
  renderStats(luxStatsEl, 'lx', lArr, (v)=>`${Math.round(v)} lx`);
  renderStats(mqStatsEl,  '',   mArr, (v)=>`${Math.round(v)}`);
}
/* ---------- Connection ---------- */
function setConnectionState(state){
  if(state==='ok'){ connPill.className='pill safe'; connPill.textContent='Connected'; }
  else if(state==='bad'){ connPill.className='pill danger'; connPill.textContent='Offline / Stale'; }
  else if(state==='warn'){ connPill.className='pill warn'; connPill.textContent='Unstable'; }
  else { connPill.className='pill neutral'; connPill.textContent='Connecting…'; }
}
/* ---------- Alert Center rendering ---------- */
function renderAlertCenter(items){
  alertsBox.innerHTML='';
  const groups = {
    danger: items.filter(x=>x.severity==='danger'),
    warn: items.filter(x=>x.severity==='warn'),
    info: items.filter(x=>x.severity==='info'),
  };
  const order = [
    {k:'danger', label:'Critical', pill:'var(--red)'},
    {k:'warn', label:'Warning', pill:'var(--orange)'},
    {k:'info', label:'Info', pill:'var(--c-hum)'},
  ];
  for(const g of order){
    const arr = groups[g.k];
    const wrap = document.createElement('div');
    wrap.className='alertGroup';
    wrap.innerHTML = `
      <div class="alertGroupHeader">
        <span>${g.label}</span>
        <span class="countChip">${arr.length}</span>
      </div>
    `;
    if(!arr.length){
      const empty = document.createElement('div');
      empty.className='muted';
      empty.style.marginTop='8px';
      empty.textContent = g.k==='info' ? 'No notes.' : 'No active alerts.';
      wrap.appendChild(empty);
    } else {
      arr.forEach(it=>{
        const div=document.createElement('div');
        div.className='alertItem';
        div.innerHTML = `<strong>${it.title}</strong><span>${it.detail}</span>`;
        const actions=document.createElement('div');
        actions.className='alertActions';
        const snoozeBtn=document.createElement('button');
        snoozeBtn.className='btnMini';
        snoozeBtn.textContent='⏸ Snooze 10m';
        snoozeBtn.addEventListener('click', ()=>{ snooze(it.key, 10); });
        actions.appendChild(snoozeBtn);
        if(it.actionTip){
          const tipBtn=document.createElement('button');
          tipBtn.className='btnMini';
          tipBtn.textContent='✨ Show tip';
          tipBtn.addEventListener('click', ()=>{
            showNewTip(false);
            $('aiToggle').click?.();
            if(window.matchMedia('(max-width: 1100px)').matches){
              $('aiCard').scrollIntoView({behavior:'smooth', block:'start'});
            }
          });
          actions.appendChild(tipBtn);
        }
        wrap.appendChild(div);
        div.appendChild(actions);
      });
    }
    alertsBox.appendChild(wrap);
  }
}
/* ===================== HEALTH METRICS ===================== */
let firebaseConnected = null;
let lastSampleAt=0;
let latestSnapshot=null;
function isStale(){
  if(!lastSampleAt) return true;
  return (Date.now()-lastSampleAt) > (settings.staleSec*1000);
}
function updateHealthUI(){
  const freshSec = lastSampleAt ? Math.max(0, Math.round((Date.now() - lastSampleAt)/1000)) : null;
  healthFresh.textContent = freshSec==null ? '—' : `${freshSec}s`;
  healthFb.textContent = firebaseConnected === null ? '—' : (firebaseConnected ? 'Yes' : 'No');
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const inWindow = points.filter(p => (now - p.ts) <= windowMs);
  const spm = inWindow.length / 10;
  healthRate.textContent = Number.isFinite(spm) ? spm.toFixed(1) : '—';
  if(!latestSnapshot){
    healthMissing.textContent = '—';
  } else {
    const keys = ['temperature','humidity','lux','mq135'];
    let missing = 0;
    keys.forEach(k=>{
      const v = safeNum(latestSnapshot?.[k]);
      if(v == null) missing++;
    });
    healthMissing.textContent = `${missing}/4`;
  }
}
setInterval(updateHealthUI, 1000);
/* ===================== AI TIPS ===================== */
const TIP_LIBRARY = {
  general: [
    { tag: "Growth", text: "Keep changes gentle: orchids love stability more than perfection. Aim for <strong>steady temperature</strong> and <strong>consistent light</strong> rather than big daily swings." },
    { tag: "Protection", text: "To protect roots and prevent rot, keep the medium airy and avoid constant wetness. Think: <strong>moist, not soaked</strong>." },
    { tag: "Environment", text: "Microclimates matter. Gentle airflow reduces fungal risk—avoid direct harsh wind on leaves." },
    { tag: "Sustainability", text: "Use LED grow lights with timers for stable cycles—consistent conditions with less heat and energy use." }
  ],
  lowLux: [
    { tag: "Light", text: "Light is low. Move the orchid to brighter indirect light or add a grow light. Increase gradually over 2–3 days to avoid shock." },
    { tag: "Light", text: "With LEDs, keep a steady schedule. Try <strong>10–12 hours</strong> and adjust by leaf color (healthy green, not dark)." }
  ],
  highLux: [
    { tag: "Light", text: "Light is very strong. Use a sheer curtain or increase distance from the lamp to prevent leaf burn." }
  ],
  tempOut: [
    { tag: "Temperature", text: "Temperature is outside your safe band. Reduce swings: keep the plant away from AC vents, heaters, and drafty doors." }
  ],
  humOut: [
    { tag: "Humidity", text: "Humidity is outside your range. Use a humidity tray or humidifier, but pair it with airflow to avoid fungus." }
  ],
  mqHigh: [
    { tag: "Air quality", text: "MQ135 is high. Ventilate and avoid aerosols/chemicals near the orchid. Clean air helps stomata and reduces stress." }
  ],
  stale: [
    { tag: "System", text: "No recent sensor updates. Check ESP32 power, Wi-Fi, and Firebase rules. Adding a sensor timestamp improves freshness accuracy." }
  ]
};
let lastTipKey = null, lastTipIndex = null;
function pickRandom(arr){
  if(!arr || !arr.length) return null;
  const idx = Math.floor(Math.random()*arr.length);
  return { item: arr[idx], idx };
}
function setTip({kicker, tag, html, reason}){
  aiKicker.textContent = kicker;
  aiTag.textContent = tag;
  aiQuoteText.innerHTML = html;
  aiReason.textContent = reason || 'Reason: —';
}
function computeTipPool(){
  const stale=isStale();
  const T=safeNum(latestSnapshot?.temperature);
  const H=safeNum(latestSnapshot?.humidity);
  const LX=safeNum(latestSnapshot?.lux);
  const MQ=safeNum(latestSnapshot?.mq135);
  if(stale) return { key: 'stale', pool: TIP_LIBRARY.stale, kicker: 'Sensors offline — quick checks', reason:`Reason: no data for > ${settings.staleSec}s` };
  if(MQ!=null && MQ > settings.mqWarn) return { key: 'mqHigh', pool: TIP_LIBRARY.mqHigh, kicker: 'Air quality protection tip', reason:`Reason: MQ ${MQ} > ${settings.mqWarn}` };
  if(T!=null && (T < settings.tMin || T > settings.tMax)) return { key: 'tempOut', pool: TIP_LIBRARY.tempOut, kicker: 'Temperature stability tip', reason:`Reason: ${T.toFixed(1)}°C outside ${settings.tMin}–${settings.tMax}` };
  if(H!=null && (H < settings.hMin || H > settings.hMax)) return { key: 'humOut', pool: TIP_LIBRARY.humOut, kicker: 'Humidity management tip', reason:`Reason: ${H.toFixed(1)}% outside ${settings.hMin}–${settings.hMax}` };
  if(LX!=null && LX < settings.lMin) return { key: 'lowLux', pool: TIP_LIBRARY.lowLux, kicker: 'Light improvement tip', reason:`Reason: ${Math.round(LX)} lx < ${settings.lMin}` };
  if(LX!=null && LX > settings.lMax) return { key: 'highLux', pool: TIP_LIBRARY.highLux, kicker: 'Light protection tip', reason:`Reason: ${Math.round(LX)} lx > ${settings.lMax}` };
  return { key: 'general', pool: TIP_LIBRARY.general, kicker: 'Smart guidance for better growth', reason:'Reason: all readings within your safe bands' };
}
function showNewTip(forceDifferent=true){
  const { key, pool, kicker, reason } = computeTipPool();
  let chosen = pickRandom(pool);
  let tries = 0;
  while(forceDifferent && chosen && key === lastTipKey && pool.length > 1 && chosen.idx === lastTipIndex && tries < 5){
    chosen = pickRandom(pool);
    tries++;
  }
  if(!chosen){
    setTip({kicker:'AI Tips', tag:'—', html:'No tips available.', reason:'Reason: no tip pool'});
    return;
  }
  lastTipKey = key;
  lastTipIndex = chosen.idx;
  setTip({kicker, tag: chosen.item.tag, html: chosen.item.text, reason});
}
newTipBtn?.addEventListener('click', ()=> showNewTip(true));
copyTipBtn?.addEventListener('click', async ()=>{
  const text = aiQuoteText?.innerText || '';
  try{
    await navigator.clipboard.writeText(text);
    copyTipBtn.textContent='✅ Copied';
    toast('safe','Copied tip','Tip copied to clipboard.');
  }catch{
    copyTipBtn.textContent='❌ Copy failed';
    toast('warn','Copy failed','Your browser blocked clipboard access.');
  }
  setTimeout(()=> copyTipBtn.textContent='📋 Copy tip', 1200);
});
/* ---------- Evaluate + render ---------- */
function pushLatestToCharts(d){
  const now=Date.now();
  const t=safeNum(d?.temperature);
  const h=safeNum(d?.humidity);
  const lx=safeNum(d?.lux);
  const mq=safeNum(d?.mq135);
  if([t,h,lx,mq].every(v=>v==null)) return;
  points.push({ts:now, tsISO:new Date(now).toISOString(), t, h, lx, mq});
  trimToRange();
  rebuildChartsFromPoints();
  pointsCount.textContent=String(points.length);
  tempLive.textContent = t==null ? 'Live: —' : `Live: ${t.toFixed(1)} °C`;
  humLive.textContent  = h==null ? 'Live: —' : `Live: ${h.toFixed(1)} %`;
  luxLive.textContent  = lx==null ? 'Live: —' : `Live: ${Math.round(lx)} lx`;
  mqLive.textContent   = mq==null ? 'Live: —' : `Live: ${mq}`;
  updateAllStats();
}
function evaluateAndRender(latest){
  const stale=isStale();
  setConnectionState(stale?'bad':'ok');
  lastUpdated.textContent = lastSampleAt ? new Date(lastSampleAt).toLocaleString() : '—';
  const T=safeNum(latest?.temperature);
  const H=safeNum(latest?.humidity);
  const LX=safeNum(latest?.lux);
  const MQ=safeNum(latest?.mq135);
  const overall = computeOverallStatus({stale, T, H, LX, MQ});
  overallIcon.textContent = overall.icon;
  overallTitle.textContent = overall.title;
  overallMsg.textContent = overall.msg;
  tempEl.textContent = (T==null?'—':T.toFixed(1)+' °C');
  humEl.textContent  = (H==null?'—':H.toFixed(1)+' %');
  luxEl.textContent  = (LX==null?'—':Math.round(LX)+' lx');
  mqEl.textContent   = (MQ==null?'—':String(MQ));
  const alertItems = [];
  if(stale){
    setPill(tempPill,'danger','Offline'); setDot(tempDot,'bad'); tempAlert.textContent='No recent readings';
    setPill(humPill,'danger','Offline');  setDot(humDot,'bad');  humAlert.textContent='No recent readings';
    setPill(luxPill,'danger','Offline');  setDot(luxDot,'bad');  luxAlert.textContent='No recent readings';
    setPill(mqPill,'danger','Offline');   setDot(mqDot,'bad');   aqAlert.textContent='No recent readings';
    alertItems.push({
      severity:'danger', key:'stale',
      title:'Offline / stale data',
      detail:`No updates for > ${settings.staleSec}s. Check ESP32 power, Wi-Fi, and Firebase.`,
      actionTip:true
    });
    notifyProblemOnce('stale','danger','Offline / stale data', `No updates for > ${settings.staleSec}s`);
    updateHealthUI();
    showNewTip(false);
    renderAlertCenter(alertItems);
    return;
  } else {
    clearProblem('stale');
  }
  if(T==null){
    setPill(tempPill,'neutral','—'); setDot(tempDot,'warn'); tempAlert.textContent='Missing value';
    clearProblem('tempDanger');
    alertItems.push({ severity:'info', key:'tempDanger', title:'Temperature missing', detail:'Latest update did not include temperature.', actionTip:false });
  } else if(T<settings.tMin || T>settings.tMax){
    setPill(tempPill,'danger','Out'); setDot(tempDot,'bad'); tempAlert.textContent=`Ideal ${settings.tMin}–${settings.tMax} °C`;
    alertItems.push({ severity:'danger', key:'tempDanger', title:'Temperature out of range', detail:`${T.toFixed(1)} °C (ideal ${settings.tMin}–${settings.tMax}). Move away from AC/heater, reduce swings.`, actionTip:true });
    notifyProblemOnce('tempDanger','danger','Temperature out of range', `${T.toFixed(1)} °C (ideal ${settings.tMin}–${settings.tMax})`);
  } else {
    setPill(tempPill,'safe','Safe'); setDot(tempDot,'ok'); tempAlert.textContent='Within range';
    clearProblem('tempDanger');
  }
  if(H==null){
    setPill(humPill,'neutral','—'); setDot(humDot,'warn'); humAlert.textContent='Missing value';
    clearProblem('humDanger');
    alertItems.push({ severity:'info', key:'humDanger', title:'Humidity missing', detail:'Latest update did not include humidity.', actionTip:false });
  } else if(H<settings.hMin || H>settings.hMax){
    setPill(humPill,'danger','Out'); setDot(humDot,'bad'); humAlert.textContent=`Ideal ${settings.hMin}–${settings.hMax} %`;
    alertItems.push({ severity:'danger', key:'humDanger', title:'Humidity out of range', detail:`${H.toFixed(1)}% (ideal ${settings.hMin}–${settings.hMax}). Use tray/humidifier + airflow.`, actionTip:true });
    notifyProblemOnce('humDanger','danger','Humidity out of range', `${H.toFixed(1)} % (ideal ${settings.hMin}–${settings.hMax})`);
  } else {
    setPill(humPill,'safe','Safe'); setDot(humDot,'ok'); humAlert.textContent='Within range';
    clearProblem('humDanger');
  }
  if(LX==null){
    setPill(luxPill,'neutral','—'); setDot(luxDot,'warn'); luxAlert.textContent='Missing value';
    clearProblem('luxLow'); clearProblem('luxHigh');
    alertItems.push({ severity:'info', key:'luxLow', title:'Light missing', detail:'Latest update did not include light (lux).', actionTip:false });
  } else if(LX<settings.lMin){
    setPill(luxPill,'warn','Low'); setDot(luxDot,'warn'); luxAlert.textContent=`Below ${settings.lMin} lx`;
    alertItems.push({ severity:'warn', key:'luxLow', title:'Light is low', detail:`${Math.round(LX)} lx (min ${settings.lMin}). Increase indirect light gradually.`, actionTip:true });
    notifyProblemOnce('luxLow','warn','Light low', `${Math.round(LX)} lx (min ${settings.lMin})`);
    clearProblem('luxHigh');
  } else if(LX>settings.lMax){
    setPill(luxPill,'warn','Bright'); setDot(luxDot,'warn'); luxAlert.textContent=`Above ${settings.lMax} lx`;
    alertItems.push({ severity:'warn', key:'luxHigh', title:'Light is high', detail:`${Math.round(LX)} lx (max ${settings.lMax}). Use a sheer curtain / increase distance.`, actionTip:true });
    notifyProblemOnce('luxHigh','warn','Light high', `${Math.round(LX)} lx (max ${settings.lMax})`);
    clearProblem('luxLow');
  } else {
    setPill(luxPill,'safe','OK'); setDot(luxDot,'ok'); luxAlert.textContent='Within band';
    clearProblem('luxLow'); clearProblem('luxHigh');
  }
  if(MQ==null){
    setPill(mqPill,'neutral','—'); setDot(mqDot,'warn'); aqAlert.textContent='Missing value';
    clearProblem('mqDanger');
    alertItems.push({ severity:'info', key:'mqDanger', title:'Air quality missing', detail:'Latest update did not include MQ135.', actionTip:false });
  } else if(MQ>settings.mqWarn){
    setPill(mqPill,'danger','Poor'); setDot(mqDot,'bad'); aqAlert.textContent=`Above ${settings.mqWarn}`;
    alertItems.push({ severity:'danger', key:'mqDanger', title:'Air quality poor', detail:`MQ135 ${MQ} (> ${settings.mqWarn}). Ventilate; avoid aerosols/chemicals nearby.`, actionTip:true });
    notifyProblemOnce('mqDanger','danger','Air quality poor', `MQ135 ${MQ} (warn > ${settings.mqWarn})`);
  } else {
    setPill(mqPill,'safe','OK'); setDot(mqDot,'ok'); aqAlert.textContent='Within threshold';
    clearProblem('mqDanger');
  }
  renderAlertCenter(alertItems);
  updateHealthUI();
  showNewTip(false);
}
/* ---------- Collapse + Log ---------- */
const chartMap={tempChartCard:tempChart,humChartCard:humChart,luxChartCard:luxChart,mqChartCard:mqChart};
function applyCardState(id){
  const card=document.getElementById(id);
  if(!card) return;
  const state=localStorage.getItem('card_state_'+id)||'open';
  const body=card.querySelector('.card-body')||card;
  body.style.display=(state==='collapsed')?'none':'';
  const btn=document.querySelector('.card-toggle[data-card="'+id+'"]');
  if(btn) btn.textContent = state==='collapsed'?'Show':'Hide';
  if(state==='open' && chartMap[id]) setTimeout(()=>chartMap[id].resize(),0);
  if(id.endsWith('ChartCard') && state==='open') requestOverlayUpdateAll();
}
document.querySelectorAll('.card-toggle').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const id=btn.getAttribute('data-card');
    const key='card_state_'+id;
    const cur=localStorage.getItem(key)||'open';
    localStorage.setItem(key, cur==='open'?'collapsed':'open');
    applyCardState(id);
  });
});
// ✅ INCLUDE growthTile
['tempTile','humTile','luxTile','mqTile','growthTile','healthCard','tempChartCard','humChartCard','luxChartCard','mqChartCard'].forEach(applyCardState);
const logContainer=$('logContainer'), toggleLogBtn=$('toggleLog'), clearLogBtn=$('clearLog'), copyLatestBtn=$('copyLatest');
const logKey='card_state_logContainer';
function applyLogState(){
  const st=localStorage.getItem(logKey)||'open';
  logContainer.style.display = st==='collapsed'?'none':'block';
  toggleLogBtn.textContent = st==='collapsed'?'Show':'Hide';
}
toggleLogBtn.addEventListener('click', ()=>{
  const cur=localStorage.getItem(logKey)||'open';
  localStorage.setItem(logKey, cur==='open'?'collapsed':'open');
  applyLogState();
});
applyLogState();
function saveLogEntriesToStorage(){
  const entries = Array.from(logContainer.children).map(n => n.dataset.payload || n.innerHTML);
  localStorage.setItem('orchid_log_entries', JSON.stringify(entries.slice(0,500)));
}
(function loadLogEntriesFromStorage(){
  const raw=localStorage.getItem('orchid_log_entries');
  if(!raw) return;
  try{
    const arr=JSON.parse(raw);
    arr.forEach(html=>{
      const div=document.createElement('div');
      div.className='entry';
      div.innerHTML=html;
      div.dataset.payload=html;
      logContainer.appendChild(div);
    });
  }catch{}
})();
clearLogBtn.addEventListener('click', ()=>{
  logContainer.innerHTML='';
  localStorage.removeItem('orchid_log_entries');
  toast('neutral','Log cleared','Activity log cleared.');
});
copyLatestBtn.addEventListener('click', async ()=>{
  const first=logContainer.firstElementChild;
  const text=first?first.innerText:'';
  try{ await navigator.clipboard.writeText(text); copyLatestBtn.textContent='✅ Copied'; toast('safe','Copied','Latest log copied.'); }
  catch{ copyLatestBtn.textContent='❌ Copy failed'; toast('warn','Copy failed','Clipboard blocked by browser.'); }
  setTimeout(()=> copyLatestBtn.textContent='📋 Copy latest', 1200);
});
window.addEventListener('beforeunload', saveLogEntriesToStorage);

/* ===================== GROWTH TRACKER LOGIC — NOW WITH LIVE KPI UPDATE ===================== */
const heightInput = $('heightInput');
const growthNote = $('growthNote');
const logGrowthBtn = $('logGrowthBtn');
const growthLogList = $('growthLogList');

// ✅ INITIAL STATE FOR GROWTH KPI
latestGrowthEl.textContent = '—';
growthPill.className = 'pill neutral';
growthPill.textContent = '—';
setDot(growthDot, '');
growthAlert.textContent = 'No growth entry yet.';

// Load existing growth logs
const growthRef = ref(db, 'growthLogs');
const growthQuery = query(growthRef, limitToLast(50));
onChildAdded(growthQuery, (snap) => {
  const data = snap.val();
  if (!data) return;
  addGrowthEntryToUI(data);
});

// ✅ UPDATED: NOW UPDATES LIVE KPI
function addGrowthEntryToUI(data) {
  const date = new Date(data.timestamp).toLocaleString();
  const div = document.createElement('div');
  div.className = 'growth-entry';
  div.innerHTML = `
    <strong>${data.heightCm} cm</strong>
    <div class="meta">${date}</div>
    ${data.note ? `<div class="muted">${data.note}</div>` : ''}
  `;
  growthLogList.insertBefore(div, growthLogList.firstChild);

  // ✅ LIVE KPI UPDATE
  latestGrowthEl.textContent = `${data.heightCm} cm`;
  growthPill.className = 'pill safe';
  growthPill.textContent = 'Logged';
  setDot(growthDot, 'ok');
  growthAlert.textContent = `Updated ${date}`;
}

logGrowthBtn.addEventListener('click', () => {
  const h = parseFloat(heightInput.value);
  if (isNaN(h) || h <= 0) {
    toast('warn', 'Invalid height', 'Please enter a valid height in cm.');
    return;
  }
  const note = growthNote.value.trim();
  const entry = {
    timestamp: Date.now(),
    heightCm: h,
    note: note || null
  };
  push(growthRef, entry).then(() => {
    addGrowthEntryToUI(entry);
    heightInput.value = '';
    growthNote.value = '';
    toast('safe', 'Growth logged', `Height: ${h} cm${note ? ` — ${note}` : ''}`);
  }).catch(err => {
    toast('danger', 'Save failed', 'Could not save to Firebase. Check connection.');
    console.error(err);
  });
});

/* ===================== PDF REPORT (kept from your original) ===================== */
function lastN(arr, n){ return arr.slice(Math.max(0, arr.length-n)); }
function variance(nums){
  const a=nums.filter(x=>Number.isFinite(x));
  if(a.length<2) return 0;
  const m=mean(a);
  return a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1);
}
function std(nums){ return Math.sqrt(variance(nums)); }
function trendSlope(values){
  const a=values.filter(v=>Number.isFinite(v));
  const n=a.length; if(n<2) return 0;
  const xMean=(n-1)/2;
  const yMean=mean(a);
  let num=0, den=0;
  for(let i=0;i<n;i++){ num+=(i-xMean)*(a[i]-yMean); den+=(i-xMean)*(i-xMean); }
  return den===0?0:num/den;
}
function statusLabelFor(value, min, max, warnGT=null){
  if(value==null) return 'Missing';
  if(warnGT!=null) return value>warnGT ? 'Poor' : 'OK';
  return (value<min || value>max) ? 'Out of range' : 'OK';
}
function sectionTitle(doc, x, y, title){
  doc.setFont('helvetica','bold');
  doc.setFontSize(13);
  doc.text(title, x, y);
  doc.setDrawColor(230);
  doc.setLineWidth(0.3);
  doc.line(x, y+2, 200, y+2);
  return y+10;
}
function wrap(doc, text, width){ return doc.splitTextToSize(text, width); }
async function chartToJPEG(chart){
  const src = chart.canvas;
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,c.width,c.height);
  ctx.drawImage(src,0,0);
  return c.toDataURL('image/jpeg', 0.92);
}
$('pdfBtn').addEventListener('click', async ()=>{
  const btn = $('pdfBtn');
  btn.disabled = true;
  btn.textContent = '📄 Generating…';
  toast('neutral','PDF','Generating report…');
  try{
    
    const doc = new jsPDF({ unit:'mm', format:'a4' });
    const margin=12;
    let y=14;
    doc.setFillColor(245,247,255);
    doc.roundedRect(margin, y-6, 210-2*margin, 24, 4, 4, 'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.text('Orchid Environmental Monitoring — Report', margin+6, y+7);
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin+6, y+13);
    doc.text(`Connection: ${isStale() ? 'Offline / stale' : 'Live / connected'} • Range: ${range.toUpperCase()}`, margin+6, y+18);
    y += 28;
    y = sectionTitle(doc, margin, y, '1) Summary (Latest Readings)');
    const T=safeNum(latestSnapshot?.temperature);
    const H=safeNum(latestSnapshot?.humidity);
    const LX=safeNum(latestSnapshot?.lux);
    const MQ=safeNum(latestSnapshot?.mq135);
    const rows = [
      ['Temperature', T==null?'—':`${T.toFixed(1)} °C`, `Ideal ${settings.tMin}–${settings.tMax} °C`, statusLabelFor(T, settings.tMin, settings.tMax)],
      ['Humidity',    H==null?'—':`${H.toFixed(1)} %`,   `Ideal ${settings.hMin}–${settings.hMax} %`, statusLabelFor(H, settings.hMin, settings.hMax)],
      ['Light',       LX==null?'—':`${Math.round(LX)} lx`, `Band ${settings.lMin}–${settings.lMax} lx`, statusLabelFor(LX, settings.lMin, settings.lMax)],
      ['MQ135',       MQ==null?'—':`${MQ}`,              `Warn > ${settings.mqWarn}`, statusLabelFor(MQ, 0, 0, settings.mqWarn)],
    ];
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Sensor', margin, y);
    doc.text('Value', margin+55, y);
    doc.text('Target / Rule', margin+95, y);
    doc.text('Status', margin+165, y);
    doc.setFont('helvetica','normal');
    y += 6;
    doc.setDrawColor(230);
    doc.line(margin, y-3, 200, y-3);
    for(const r of rows){
      doc.text(String(r[0]), margin, y);
      doc.text(String(r[1]), margin+55, y);
      doc.text(String(r[2]), margin+95, y);
      doc.text(String(r[3]), margin+165, y);
      y += 6;
    }
    doc.setFontSize(10);
    doc.text(`Last dashboard update: ${lastSampleAt ? new Date(lastSampleAt).toLocaleString() : '—'}`, margin, y+3);
    y += 14;
    y = sectionTitle(doc, margin, y, '2) AI Analysis (Trend + Variability)');
    const recent = lastN(points, Math.min(points.length, 120));
    const tArr = recent.map(p=>p.t).filter(v=>v!=null);
    const hArr = recent.map(p=>p.h).filter(v=>v!=null);
    const lxArr= recent.map(p=>p.lx).filter(v=>v!=null);
    const mqArr= recent.map(p=>p.mq).filter(v=>v!=null);
    const tSlope=trendSlope(tArr), hSlope=trendSlope(hArr), lxSlope=trendSlope(lxArr), mqSlope=trendSlope(mqArr);
    const tStd=std(tArr), hStd=std(hArr), lxStd=std(lxArr), mqStd=std(mqArr);
    const trendLine = (name, s)=>{
      if(!Number.isFinite(s) || Math.abs(s) < 1e-6) return `${name}: stable trend in the recent window.`;
      return `${name}: ${s>0?'increasing':'decreasing'} trend detected recently.`;
    };
    const noiseLine = (name, sd, soft)=>{
      if(!Number.isFinite(sd)) return `${name}: insufficient data for variability check.`;
      const level = sd > soft ? 'elevated' : 'normal';
      return `${name}: variability ${level} (σ ≈ ${sd.toFixed(2)}).`;
    };
    const aiBlock = [
      'This section provides a lightweight interpretation using recent points.',
      '',
      trendLine('Temperature', tSlope),
      trendLine('Humidity', hSlope),
      trendLine('Light', lxSlope),
      trendLine('MQ135', mqSlope),
      '',
      noiseLine('Temperature', tStd, 2.0),
      noiseLine('Humidity', hStd, 5.0),
      noiseLine('Light', lxStd, 180.0),
      noiseLine('MQ135', mqStd, 220.0),
      '',
      'Notes:',
      '- If variability stays elevated, check sensor placement, airflow, and power stability.',
      '- Persistent MQ highs can indicate contaminants or ventilation issues.',
    ].join('\n');
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    const aiWrapped = wrap(doc, aiBlock, 186);
    doc.text(aiWrapped, margin, y);
    y += aiWrapped.length*5 + 6;
    y = sectionTitle(doc, margin, y, '3) Charts (Snapshots)');
    const [imgT,imgH,imgL,imgM] = await Promise.all([
      chartToJPEG(tempChart),
      chartToJPEG(humChart),
      chartToJPEG(luxChart),
      chartToJPEG(mqChart),
    ]);
    const W=92, Hh=56, gap=6;
    if(y + Hh*2 + 20 > 290){ doc.addPage(); y=16; y = sectionTitle(doc, margin, y, '3) Charts (Snapshots)'); }
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Temperature', margin, y);
    doc.text('Humidity', margin+W+gap, y);
    y += 4;
    doc.addImage(imgT,'JPEG', margin, y, W, Hh);
    doc.addImage(imgH,'JPEG', margin+W+gap, y, W, Hh);
    y += Hh + 10;
    doc.text('Light (lux)', margin, y-6);
    doc.text('MQ135', margin+W+gap, y-6);
    doc.addImage(imgL,'JPEG', margin, y-2, W, Hh);
    doc.addImage(imgM,'JPEG', margin+W+gap, y-2, W, Hh);
    y += Hh + 10;
    if(y > 275){ doc.addPage(); y=16; }
    y = sectionTitle(doc, margin, y, '4) Alerts / Notes');
    const notesText = 'See the Alert Center on the dashboard for the latest actionable items.';
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    const notesWrapped = wrap(doc, notesText, 186);
    doc.text(notesWrapped, margin, y);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('Generated from Orchid Environmental Monitoring Dashboard (client-side PDF export).', margin, 292);
    doc.save(`orchid_report_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`);
    toast('safe','PDF ready','Report downloaded.');
  } finally {
    btn.disabled = false;
    btn.textContent = '📄 Download PDF';
  }
});
/* ---------- Firebase listeners ---------- */
const latestRef = ref(db,'orchidData/latest');
setConnectionState('neutral');
const connectedRef = ref(db, '.info/connected');
let lastConnectedVal = null;
onValue(connectedRef, (snap)=>{
  firebaseConnected = !!snap.val();
  if(lastConnectedVal !== null && firebaseConnected !== lastConnectedVal){
    toast(firebaseConnected ? 'safe' : 'warn',
      firebaseConnected ? 'Firebase connected' : 'Firebase disconnected',
      firebaseConnected ? 'Live updates should work now.' : 'Check internet/Wi-Fi. Data may become stale.'
    );
  }
  lastConnectedVal = firebaseConnected;
  updateHealthUI();
});
// latest
onValue(latestRef,(snap)=>{
  if(paused) return;
  const d=snap.val() || {};
  latestSnapshot = d;
  lastSampleAt = Date.now();
  evaluateAndRender(d);
  pushLatestToCharts(d);
});
// logs (limited)
const logsQ = query(ref(db,'orchidData/logs'), limitToLast(200));
const logContainerEl = $('logContainer');
onChildAdded(logsQ,(snap)=>{
  if(paused) return;
  const e = snap.val() || {};
  const ts = new Date().toLocaleString();
  const t=safeNum(e.temperature);
  const h=safeNum(e.humidity);
  const lx=safeNum(e.lux);
  const m=safeNum(e.mq135);
  const html = `
    <strong>${ts}</strong>
    <div class="muted">Temp: ${t==null?'—':t.toFixed(1)} °C • Hum: ${h==null?'—':h.toFixed(1)} % • Lux: ${lx==null?'—':Math.round(lx)} • MQ: ${m==null?'—':m}</div>
  `;
  const div=document.createElement('div');
  div.className='entry';
  div.innerHTML=html;
  div.dataset.payload=html;
  logContainerEl.insertBefore(div, logContainerEl.firstChild);
  while(logContainerEl.children.length>500) logContainerEl.removeChild(logContainerEl.lastChild);
  saveLogEntriesToStorage();
});
/* Initial UI */
evaluateAndRender(null);
rebuildChartsFromPoints();
refreshChartFills();
updateHealthUI();
showNewTip(false);
updateAllStats();
}
