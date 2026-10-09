/* Путь Дракона — движок курса. Без сборки, без зависимостей (кроме Hanzi Writer для прописей).
   Разделы: утилиты → состояние/сохранение → пиньинь/тоны → TTS/STT → детектор высоты → SRS →
   геймификация → роутер и страницы → урок → тренажёры. */
'use strict';

// ============================================================ УТИЛИТЫ
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico = (n, cls='') => `<svg class="${cls}" aria-hidden="true"><use href="#${n}"/></svg>`;
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const pick = (a, n) => shuffle(a).slice(0, n);
const rnd = a => a[Math.floor(Math.random()*a.length)];
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const todayKey = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const dayNum = (k) => Math.floor(new Date((k||todayKey())+'T12:00:00').getTime()/864e5);
const plural = (n, a, b, c) => { const m=n%10, h=n%100; return n+' '+((h>=11&&h<=19)?c:(m===1?a:(m>=2&&m<=4?b:c))); };
const zhOnly = s => (s||'').replace(/[^㐀-鿿　-〿＀-￯]/g,'');
const hanOnly = s => (s||'').replace(/[^㐀-鿿]/g,'');
const stripPunct = s => (s||'').replace(/[\s|，。！？、：；“”‘’（）…—,.!?:;"'()\-]/g,'');
const showZh = s => (s||'').replace(/\|/g,'');
const showPy = s => (s||'').replace(/\|/g,' ').replace(/\s+/g,' ').trim();
const words = s => (s||'').split('|').map(x=>x.trim()).filter(Boolean);

let toastT;
function toast(msg, ms=2200){ let t=$('.toast'); if(t) t.remove(); t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); clearTimeout(toastT); toastT=setTimeout(()=>t.remove(), ms); }
function modal(html, onMount){ const m=document.createElement('div'); m.className='modal'; m.innerHTML=`<div class="card">${html}</div>`; m.addEventListener('click', e=>{ if(e.target===m) m.remove(); }); document.body.appendChild(m); if(onMount) onMount(m); return m; }
function confetti(){ const c=document.createElement('canvas'); c.className='confetti'; document.body.appendChild(c); const ctx=c.getContext('2d'); c.width=innerWidth; c.height=innerHeight; const cols=['#F2B33D','#2FB58A','#E5533C','#4F7DF2','#9D6BE0','#FFD27A']; const ps=Array.from({length:120},()=>({x:Math.random()*c.width,y:-20-Math.random()*200,vx:(Math.random()-.5)*3,vy:2+Math.random()*4,r:4+Math.random()*6,c:rnd(cols),a:Math.random()*6})); let t0=performance.now(); (function f(t){ ctx.clearRect(0,0,c.width,c.height); ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.a+=.1;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.fillStyle=p.c;ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*.6);ctx.restore();}); if(t-t0<2600) requestAnimationFrame(f); else c.remove(); })(t0); }

// ============================================================ СОСТОЯНИЕ
const LS_KEY = 'dp_state_v1';
const DEF = () => ({ v:1, name:'', xp:0, streak:0, lastDay:null, freezes:1, done:{}, gatesDone:[], srs:{}, extra:[],
  day:{date:todayKey(), reviews:0, lessons:0, tones:0, speakSec:0, hanzi:0, perfect:0, bestCombo:0, min:0, xp:0, quests:[], questsDone:[]},
  tot:{reviews:0, lessons:0, tones:0, speakSec:0, hanzi:0, perfect:0, bestCombo:0, min:0},
  ach:[], flags:{}, hz:{}, set:{theme:'dark', pinyin:'always', hanzi:'auto', voice:'', rate:0.9, autoplay:true, free:false, goal:20, write:true} });
let S = DEF();
function load(){ try{ const raw=localStorage.getItem(LS_KEY); if(raw){ const o=JSON.parse(raw); S=Object.assign(DEF(), o); S.set=Object.assign(DEF().set, o.set||{}); S.day=Object.assign(DEF().day, o.day||{}); S.tot=Object.assign(DEF().tot, o.tot||{}); } }catch(e){} }
let saveT;
function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){} clearTimeout(saveT); saveT=setTimeout(()=>API.push(), 500); }

// Профили на локальном сервере (server.py). Без сервера — тихий откат на localStorage.
const API = {
  ok:false, token:localStorage.getItem('dp_token')||'', user:localStorage.getItem('dp_user')||'',
  async probe(){ try{ const r=await fetch('api/users',{cache:'no-store'}); const j=await r.json(); this.ok=!!j.ok; this.lan=j.lan; this.https=j.https; this.http=j.http; this.tts=!!j.tts; this.voices=j.voices||[]; return j.users||[]; }catch(e){ this.ok=false; return []; } },
  hdr(){ return {'Content-Type':'application/json','X-Token':this.token,'X-User':encodeURIComponent(this.user)}; },
  async login(name, pin, register){ const r=await fetch('api/'+(register?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,pin})}); const j=await r.json(); if(!j.ok) throw new Error(j.error||'Ошибка'); this.token=j.token; this.user=name; localStorage.setItem('dp_token',j.token); localStorage.setItem('dp_user',name); if(j.state && j.state.xp!=null){ S=Object.assign(DEF(), j.state); S.set=Object.assign(DEF().set, j.state.set||{}); } else { S.name=name; } save(); return j; },
  async pull(){ if(!this.ok||!this.token) return; try{ const r=await fetch('api/state',{headers:this.hdr()}); const j=await r.json(); if(j.ok && j.state && j.state.xp!=null && (j.state.updated||0) >= (S.updated||0)){ S=Object.assign(DEF(), j.state); S.set=Object.assign(DEF().set, j.state.set||{}); localStorage.setItem(LS_KEY, JSON.stringify(S)); } }catch(e){} },
  async push(){ if(!this.ok||!this.token) return; try{ S.updated=Date.now(); await fetch('api/state',{method:'PUT',headers:this.hdr(),body:JSON.stringify(S)}); syncBadge(true); }catch(e){ syncBadge(false); } },
  logout(){ this.token=''; this.user=''; localStorage.removeItem('dp_token'); localStorage.removeItem('dp_user'); }
};
function syncBadge(ok){ const b=$('#sync'); if(b){ b.style.color = ok?'var(--jade)':'var(--red)'; b.title = ok?'Сохранено на сервере':'Нет связи с сервером'; } }

// ============================================================ ПИНЬИНЬ И ТОНЫ
const TONE_MARKS = {1:'āēīōūǖĀĒĪŌŪǕ',2:'áéíóúǘÁÉÍÓÚǗ',3:'ǎěǐǒǔǚǍĚǏǑǓǙ',4:'àèìòùǜÀÈÌÒÙǛ'};
function toneOf(syl){ for(const t of [1,2,3,4]) for(const ch of syl) if(TONE_MARKS[t].includes(ch)) return t; return 5; }
function syllables(py){ return (py||'').replace(/['’]/g,' ').match(/[bpmfdtnlgkhjqxzcsryw]?h?[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜAEIOUĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ]+(?:ng|n|r)?/g) || []; }
function noTone(py){ return (py||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ü/g,'v').replace(/[^a-zA-Z]/g,'').toLowerCase(); }
// Раскраска иероглифов по тонам: возвращает HTML, если удалось сопоставить слоги и знаки.
function colorZh(zh, py){
  const chars=[...showZh(zh)]; const han=chars.filter(c=>/[㐀-鿿]/.test(c)); let syl=syllables(showPy(py));
  if(syl.length===han.length-1 && /r$/.test(syl[syl.length-1]) && han[han.length-1]==='儿'){ const last=syl.pop(); syl.push(last.slice(0,-1),'er'); }
  if(syl.length!==han.length || !han.length) return `<span class="zh">${esc(showZh(zh))}</span>`;
  let i=0; return `<span class="zh">${chars.map(c=>/[㐀-鿿]/.test(c)?`<span class="syl T${toneOf(syl[i++])}">${c}</span>`:esc(c)).join('')}</span>`;
}
// Карта знак → пиньинь без тона (для мягкого сравнения распознанной речи)
const CHAR_PY = {};
function buildCharMap(){
  const add=(zh,py)=>{ const han=[...hanOnly(zh)]; const syl=syllables(py); if(han.length===syl.length) han.forEach((c,i)=>{ CHAR_PY[c]=CHAR_PY[c]||noTone(syl[i]); }); };
  WORDS.forEach(w=>add(w.zh,w.py));
  LESSONS.forEach(l=>{ (l.items||[]).forEach(it=>{ const zw=words(it.zh), pw=words(it.py); if(zw.length===pw.length) zw.forEach((z,i)=>add(z,pw[i])); }); (l.dialog||[]).forEach(d=>add(d.zh,d.py)); if(l.pattern) l.pattern.slots.forEach(s=>add(s[0],s[1])); });
}
function toPyString(zh){ return [...hanOnly(zh)].map(c=>CHAR_PY[c]||c).join(''); }
// Схожесть двух строк (LCS)
function lcs(a,b){ const m=a.length,n=b.length; if(!m||!n) return 0; let prev=new Array(n+1).fill(0); for(let i=1;i<=m;i++){ const cur=[0]; for(let j=1;j<=n;j++) cur[j]= a[i-1]===b[j-1] ? prev[j-1]+1 : Math.max(prev[j],cur[j-1]); prev=cur; } return prev[n]; }
function similarity(heard, target){
  const h=hanOnly(heard), t=hanOnly(target); if(!t.length) return 0;
  const s1 = lcs([...h],[...t]) / Math.max(t.length, h.length||1);
  const hp=toPyString(h), tp=toPyString(t); const s2 = tp.length ? lcs([...hp],[...tp]) / Math.max(tp.length, hp.length||1) : 0;
  return Math.max(s1, s2*0.97);
}

// ============================================================ TTS / STT
const TTS = {
  voices:[], ready:false,
  init(){ if(!('speechSynthesis' in window)) return; const upd=()=>{ this.voices=speechSynthesis.getVoices().filter(v=>/^zh|cmn/i.test(v.lang)); this.ready=true; }; upd(); speechSynthesis.onvoiceschanged=upd; },
  pick(){ const vs=this.voices; if(!vs.length) return null; if(S.set.voice){ const v=vs.find(v=>v.name===S.set.voice); if(v) return v; }
    const pref=[/Xiaoxiao/i,/Yunxi/i,/Xiaoyi/i,/Yunyang/i,/Natural/i,/Google.*(普通话|Mandarin|中文)/i,/Tingting/i,/Huihui/i,/Yaoyao/i,/Kangkang/i];
    for(const p of pref){ const v=vs.find(v=>p.test(v.name)&&/zh-CN|cmn-Hans|zh_CN/i.test(v.lang)); if(v) return v; }
    return vs.find(v=>/zh-CN/i.test(v.lang)) || vs[0]; },
  // Устойчивая озвучка. Ловушки браузеров, из-за которых речь обрывалась на середине:
  //  1) cancel() и сразу speak() — Chrome/Edge глотают или режут новую фразу → ждём 150 мс после отмены;
  //  2) объект фразы собирается сборщиком мусора во время речи → держим ссылку в this.cur;
  //  3) длинные тексты (>~15 с) Chrome обрывает → режем по знакам препинания и говорим по очереди;
  //  4) Chrome иногда «засыпает» на полуслове → страховка resume() каждые 5 с, пока говорит.
  _seq:0, cur:null, queue:[], audio:null,
  // Основной путь — нейроголоса Microsoft через сервер курса (edge-tts, mp3 кэшируется на диске):
  // одинаково звучит в любом браузере и на телефоне, не режется. Запасной — speechSynthesis браузера.
  useServer(){ return API.ok && API.tts && S.set.engine!=='browser'; },
  url(text, rate){ return 'api/tts?text='+encodeURIComponent(text)+'&v='+encodeURIComponent(S.set.svoice||'xiaoxiao')+'&rate='+Math.round((rate-1)*100); },
  prefetch(texts){ if(!this.useServer()) return; [...new Set(texts.map(t=>showZh(t).replace(/[（(].*?[)）]/g,'').trim()).filter(Boolean))].slice(0,40).forEach((t,i)=>setTimeout(()=>fetch(this.url(t,S.set.rate)).catch(()=>{}), i*120)); },
  sayServer(t, rate){ return new Promise((res,rej)=>{ const my=++this._seq; const a=this.audio||(this.audio=new Audio()); a.pause(); a.onended=()=>{ if(my===this._seq) res(); }; a.onerror=()=>rej(new Error('audio'));
      a.src=this.url(t,rate); a.play().catch(rej); }); },
  say(text, opt={}){ const t=showZh(text).replace(/[（(].*?[)）]/g,'').trim(); if(!t) return Promise.resolve(); const rate=opt.rate ?? S.set.rate;
    if(this.useServer()) return this.sayServer(t, rate).catch(()=>this.sayBrowser(t, rate));
    return this.sayBrowser(t, rate); },
  sayBrowser(text, rate){ return new Promise(res=>{ if(!('speechSynthesis' in window)){ res(); return; }
      let t=text; if(!/[。！？!?…]$/.test(t)) t+='。'; // Edge/Chrome глотают хвост фразы без знака препинания
      const my=++this._seq; const parts = t.length>60 ? t.split(/(?<=[。！？；!?;])/).map(x=>x.trim()).filter(Boolean) : [t];
      const v=this.pick();
      const speakPart=(k)=>{ if(my!==this._seq){ res(); return; } if(k>=parts.length){ this.cur=null; res(); return; }
        const u=new SpeechSynthesisUtterance(parts[k]); this.cur=u; if(v){ u.voice=v; u.lang=v.lang; } else u.lang='zh-CN'; u.rate=rate; u.pitch=1; u.volume=1;
        let done=false; const fin=()=>{ if(done) return; done=true; clearTimeout(guard); speakPart(k+1); };
        u.onend=fin; u.onerror=e=>{ if(e.error==='interrupted'||e.error==='canceled'){ done=true; res(); return; } fin(); };
        // страховка: если onend так и не пришёл (бывает в Chrome), идём дальше по расчётной длительности
        const guard=setTimeout(()=>{ if(!speechSynthesis.speaking) fin(); else setTimeout(fin, 4000); }, 1500 + parts[k].length*450/rate);
        speechSynthesis.speak(u); this._watch(); };
      const start=()=>{ if(my!==this._seq){ res(); return; } speakPart(0); };
      if(speechSynthesis.speaking || speechSynthesis.pending){ speechSynthesis.cancel(); setTimeout(start, 150); } else start();
      if(!v && !this._warned){ this._warned=true; setTimeout(()=>{ if(!this.voices.length) toast('Не найден китайский голос. Установите его в системе (Windows: Параметры → Время и язык → Речь → Добавить голоса → 中文).', 6000); },800); } }); },
  _watch(){ clearInterval(this._wt); const edge=/Edg\//.test(navigator.userAgent), mobile=/Android|iPhone|iPad/.test(navigator.userAgent);
    this._wt=setInterval(()=>{ if(!speechSynthesis.speaking){ clearInterval(this._wt); return; } if(!edge && !mobile){ speechSynthesis.pause(); speechSynthesis.resume(); } else if(speechSynthesis.paused) speechSynthesis.resume(); }, 5000); },
  stop(){ this._seq++; this.cur=null; clearInterval(this._wt); if(this.audio){ this.audio.pause(); } if('speechSynthesis' in window) speechSynthesis.cancel(); }
};
const STT = {
  ok: !!(window.SpeechRecognition||window.webkitSpeechRecognition), rec:null, active:false,
  start({continuous=false, onResult, onEnd, onError}={}){
    if(!this.ok){ toast('Распознавание речи недоступно в этом браузере. Используйте Chrome или Edge.'); onEnd&&onEnd(); return; }
    this.stop(); const R=window.SpeechRecognition||window.webkitSpeechRecognition; const r=new R(); r.lang='zh-CN'; r.continuous=continuous; r.interimResults=true; r.maxAlternatives=3;
    let final='', t0=Date.now();
    r.onresult=e=>{ let interim=''; for(let i=e.resultIndex;i<e.results.length;i++){ const res=e.results[i]; if(res.isFinal) final+=res[0].transcript; else interim+=res[0].transcript; } onResult&&onResult(final+interim, final, e.results); };
    r.onerror=e=>{ if(e.error==='not-allowed') toast('Нет доступа к микрофону. Разрешите его в адресной строке.'); else if(e.error!=='no-speech' && e.error!=='aborted') toast('Ошибка распознавания: '+e.error); onError&&onError(e); };
    r.onend=()=>{ this.active=false; const sec=Math.round((Date.now()-t0)/1000); if(sec>0){ bump('speakSec', sec); } if(continuous && this._keep){ try{ r.start(); this.active=true; return; }catch(e){} } onEnd&&onEnd(final); };
    try{ r.start(); this.active=true; this.rec=r; this._keep=continuous; }catch(e){ onEnd&&onEnd(''); }
  },
  stop(){ if(this.rec){ this._keep=false; try{ this.rec.stop(); }catch(e){} this.rec=null; } this.active=false; }
};

// ============================================================ ДЕТЕКТОР ВЫСОТЫ ГОЛОСА (тоны)
const Pitch = {
  ctx:null, an:null, src:null, stream:null, buf:null, raf:0, on:false, samples:[], t0:0, lastVoiced:0, onDone:null, onFrame:null,
  async start({onFrame, onDone, maxMs=2500}){
    try{ this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:true}}); }
    catch(e){ toast('Нет доступа к микрофону.'); onDone&&onDone(null); return false; }
    this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)(); if(this.ctx.state==='suspended') await this.ctx.resume();
    this.src=this.ctx.createMediaStreamSource(this.stream); this.an=this.ctx.createAnalyser(); this.an.fftSize=2048; this.src.connect(this.an);
    this.buf=new Float32Array(this.an.fftSize); this.samples=[]; this.on=true; this.t0=performance.now(); this.lastVoiced=0; this.onFrame=onFrame; this.onDone=onDone; this.maxMs=maxMs;
    const loop=()=>{ if(!this.on) return; this.an.getFloatTimeDomainData(this.buf); const f=this.detect(this.buf, this.ctx.sampleRate); const t=performance.now()-this.t0;
      if(f>0){ this.samples.push({t,f}); this.lastVoiced=t; } this.onFrame&&this.onFrame(f, t, this.samples);
      if((this.lastVoiced>0 && t-this.lastVoiced>450) || t>this.maxMs || (this.lastVoiced===0 && t>3500)) { this.stop(); return; }
      this.raf=requestAnimationFrame(loop); };
    this.raf=requestAnimationFrame(loop); return true;
  },
  stop(){ if(!this.on) return; this.on=false; cancelAnimationFrame(this.raf); try{ this.src&&this.src.disconnect(); this.stream&&this.stream.getTracks().forEach(t=>t.stop()); }catch(e){} const s=this.samples; this.onDone&&this.onDone(s.length>=6?s:null); },
  // Автокорреляция (по Chris Wilson, ACF2+). Возвращает частоту или -1.
  detect(buf, sr){ let n=buf.length, rms=0; for(let i=0;i<n;i++) rms+=buf[i]*buf[i]; rms=Math.sqrt(rms/n); if(rms<0.012) return -1;
    let r1=0,r2=n-1,th=0.2; for(let i=0;i<n/2;i++) if(Math.abs(buf[i])<th){r1=i;break;} for(let i=1;i<n/2;i++) if(Math.abs(buf[n-i])<th){r2=n-i;break;}
    buf=buf.slice(r1,r2); n=buf.length; const c=new Float32Array(n).fill(0); for(let i=0;i<n;i++) for(let j=0;j<n-i;j++) c[i]+=buf[j]*buf[j+i];
    let d=0; while(d<n-1 && c[d]>c[d+1]) d++; let mx=-1,mp=-1; for(let i=d;i<n;i++) if(c[i]>mx){mx=c[i];mp=i;} if(mp<=0) return -1; let T0=mp;
    const x1=c[T0-1]||0,x2=c[T0],x3=c[T0+1]||0; const a=(x1+x3-2*x2)/2,b=(x3-x1)/2; if(a) T0=T0-b/(2*a); const f=sr/T0; return (f>70&&f<500)?f:-1; },
  // Нормализованный контур: 24 точки в полутонах относительно среднего
  contour(samples){ if(!samples||samples.length<6) return null; const st=samples.map(s=>12*Math.log2(s.f/200)); const med=a=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
    // медианный фильтр 3 + отсев выбросов на октаву
    const m=med(st); const cl=st.filter(v=>Math.abs(v-m)<9); if(cl.length<6) return null; const sm=cl.map((v,i)=>med(cl.slice(Math.max(0,i-1),i+2)));
    const N=24, out=[]; for(let i=0;i<N;i++){ const p=i/(N-1)*(sm.length-1); const a=Math.floor(p), b=Math.min(sm.length-1,a+1); out.push(sm[a]+(sm[b]-sm[a])*(p-a)); }
    const mean=out.reduce((a,b)=>a+b,0)/N; return out.map(v=>v-mean); },
  template(t){ const N=24; const f=i=>i/(N-1); const tpl={1:i=>0, 2:i=>-3.5+7*f(i), 3:i=>{const x=f(i);return x<0.6? -1-5*(x/0.6) : -6+4*((x-0.6)/0.4);}, 4:i=>4-9*f(i), 5:i=>0}[t]; const arr=Array.from({length:N},(_,i)=>tpl(i)); const mean=arr.reduce((a,b)=>a+b,0)/N; return arr.map(v=>v-mean); },
  score(user, t){ if(!user) return 0; const N=user.length; const std=Math.sqrt(user.reduce((a,v)=>a+v*v,0)/N); const rng=Math.max(...user)-Math.min(...user);
    if(t===1||t===5) return clamp(1-(std-0.8)/3, 0, 1);
    const tp=this.template(t); const mu=0, mt=0; let num=0,du=0,dt=0; for(let i=0;i<N;i++){ num+=user[i]*tp[i]; du+=user[i]*user[i]; dt+=tp[i]*tp[i]; } const corr=num/Math.sqrt(du*dt||1);
    return clamp(Math.max(0,corr) * clamp(rng/2.5, 0, 1), 0, 1); },
  classify(user){ if(!user) return 0; let best=1,bs=-1; for(const t of [1,2,3,4]){ const s=this.score(user,t); if(s>bs){bs=s;best=t;} } return best; },
  draw(canvas, target, user){ const ctx=canvas.getContext('2d'); const W=canvas.width=canvas.clientWidth*devicePixelRatio, H=canvas.height=canvas.clientHeight*devicePixelRatio; ctx.clearRect(0,0,W,H);
    const css=getComputedStyle(document.documentElement); const grid=css.getPropertyValue('--line').trim(); ctx.strokeStyle=grid; ctx.lineWidth=1; for(let i=1;i<5;i++){ ctx.beginPath(); ctx.moveTo(0,H*i/5); ctx.lineTo(W,H*i/5); ctx.stroke(); }
    const plot=(arr,color,w,dash)=>{ if(!arr) return; ctx.strokeStyle=color; ctx.lineWidth=w*devicePixelRatio; ctx.setLineDash(dash||[]); ctx.lineCap='round'; ctx.lineJoin='round'; ctx.beginPath(); arr.forEach((v,i)=>{ const x=W*0.08+ (W*0.84)*i/(arr.length-1); const y=H/2 - v*(H/16); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }); ctx.stroke(); ctx.setLineDash([]); };
    if(target) plot(this.template(target), css.getPropertyValue('--t'+target).trim()||'#888', 5, [10,8]);
    if(user) plot(user, css.getPropertyValue('--gold').trim(), 4);
  }
};

// ============================================================ SRS (SM-2 lite)
function cardOf(id){ if(id.startsWith('w:')){ const w=WORDS[+id.slice(2)]; return w? {id, zh:w.zh, py:w.py, ru:w.ru, ex:w.ex, expy:w.expy, exru:w.exru, kind:'w'} : null; }
  if(id.startsWith('p:')){ const [,lid,i]=id.split(':'); const l=LESSONS.find(x=>x.id===lid); const it=l&&l.items[+i]; return it? {id, zh:it.zh, py:it.py, ru:it.ru, lit:it.lit, kind:'p', lesson:l} : null; } return null; }
function wordByZh(zh){ const c=WORDS.filter(w=>w.zh===zh); return c.length? c.sort((a,b)=>a.hsk-b.hsk)[0] : null; }
function addCard(id){ if(!S.srs[id]) S.srs[id]={iv:0, ease:2.5, reps:0, due:dayNum(), lapses:0, added:dayNum()}; }
function srsUpdate(id, q){ const c=S.srs[id]; if(!c) return; const today=dayNum();
  if(q===0){ c.reps=0; c.iv=0; c.lapses++; c.ease=Math.max(1.3, c.ease-0.2); c.due=today; }
  else { if(c.reps===0) c.iv = q===1?1:(q===2?1:3); else if(c.reps===1) c.iv = q===1?2:(q===2?4:7); else c.iv = Math.round(c.iv * (q===1? 1.2 : q===2? c.ease : c.ease*1.4));
    c.iv=clamp(c.iv,1,365); c.ease=clamp(c.ease + (q===3?0.15: q===1?-0.15:0), 1.3, 3.0); c.reps++; c.due=today+c.iv; }
  c.last=today; bump('reviews',1); addXP(q===0?1:2); save(); }
function dueCards(){ const t=dayNum(); return Object.keys(S.srs).filter(id=>S.srs[id].due<=t).map(cardOf).filter(Boolean); }
function learnedCount(){ return Object.values(S.srs).filter(c=>c.reps>=3&&c.iv>=7).length; }
function srsLevel(id){ const c=S.srs[id]; if(!c) return 0; if(c.reps>=3&&c.iv>=7) return 3; if(c.reps>=1) return 2; return 1; }

// ============================================================ ГЕЙМИФИКАЦИЯ
function rollDay(){ const k=todayKey(); if(S.day.date!==k){ S.day={...DEF().day, date:k}; } if(!S.day.quests.length){ const pool=shuffle(QUESTS); const q=[]; const keys=new Set(); for(const x of pool){ if(keys.has(x.key)) continue; keys.add(x.key); q.push(x.id); if(q.length===3) break; } S.day.quests=q; } }
function touch(){ const k=todayKey(); if(S.lastDay===k) return; const y=S.lastDay? dayNum(k)-dayNum(S.lastDay) : 0;
  if(!S.lastDay || y===1) S.streak=(S.streak||0)+1; else if(y>1){ if(S.freezes>0 && y===2){ S.freezes--; S.streak++; toast('Заморозка серии сработала — серия сохранена'); } else { S.streak=1; } }
  S.lastDay=k; if(S.streak>0 && S.streak%7===0){ S.freezes=Math.min(3,(S.freezes||0)+1); toast('7 дней подряд! +1 заморозка серии'); }
  const h=new Date().getHours(); if(h<5) S.flags.owl=true; if(h<7) S.flags.lark=true; save(); }
function addXP(n){ S.xp+=n; S.day.xp+=n; checkDragon(); }
function bump(key, n=1){ rollDay(); S.day[key]=(S.day[key]||0)+n; S.tot[key]=(S.tot[key]||0)+n; checkQuests(); }
function setMax(key, v){ rollDay(); if(v>(S.day[key]||0)) S.day[key]=v; if(v>(S.tot[key]||0)) S.tot[key]=v; checkQuests(); }
function checkQuests(){ S.day.quests.forEach(id=>{ if(S.day.questsDone.includes(id)) return; const q=QUESTS.find(x=>x.id===id); if(q && (S.day[q.key]||0)>=q.target){ S.day.questsDone.push(id); addXP(q.xp); toast(`Квест выполнен: ${q.text} +${q.xp} XP`); } }); }
function dragonStage(xp=S.xp){ let st=0; DRAGON.forEach((d,i)=>{ if(xp>=d.xp) st=i; }); return st; }
let lastStage=null;
function checkDragon(){ const st=dragonStage(); if(lastStage!==null && st>lastStage){ setTimeout(()=>{ modal(`<div class="center"><div class="dragon" style="justify-content:center">${dragonSVG(st)}</div><h2 class="mt">Дракон вырос!</h2><p class="muted">${esc(DRAGON[st].name)} <span class="zh">${DRAGON[st].zh}</span></p><p>${esc(DRAGON[st].tip)}</p><button class="btn primary block mt" data-act="close-modal">Отлично</button></div>`); confetti(); },400); } lastStage=st; }
function checkAch(){ const d={learned:learnedCount()}; let got=[]; ACHIEVEMENTS.forEach(a=>{ if(!S.ach.includes(a.id)){ let ok=false; try{ ok=a.check(S,d); }catch(e){} if(ok){ S.ach.push(a.id); got.push(a); } } }); if(got.length){ save(); got.forEach((a,i)=>setTimeout(()=>toast(`Достижение: ${a.name} — ${a.desc}`,3000), i*1200)); } }
function dragonSVG(st){ const c=['#9AA0B4','#6FE0B8','#2FB58A','#4F7DF2','#3E8BFF','#9D6BE0','#E5533C','#F2B33D'][st]||'#F2B33D'; const c2=['#7E8397','#2FB58A','#1B7A5C','#2E5BC7','#2E6FE0','#7A4BC0','#A8321F','#B8801A'][st]||'#B8801A';
  if(st===0) return `<svg viewBox="0 0 120 120" class="bounce"><defs><radialGradient id="eg" cx="40%" cy="35%"><stop offset="0" stop-color="#FFF6DC"/><stop offset="1" stop-color="#E8C98A"/></radialGradient></defs><ellipse cx="60" cy="66" rx="34" ry="42" fill="url(#eg)" stroke="#B8801A" stroke-width="3"/><path d="M45 50l8 10 7-12 8 11 7-9" fill="none" stroke="#B8801A" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="80" r="4" fill="#E5533C" opacity=".6"/><circle cx="72" cy="92" r="3" fill="#2FB58A" opacity=".6"/></svg>`;
  const wings = st>=3 ? `<path d="M30 58 Q8 30 22 22 Q34 40 44 50Z" fill="${c2}" opacity=".9"/><path d="M90 58 Q112 30 98 22 Q86 40 76 50Z" fill="${c2}" opacity=".9"/>` : '';
  const horns = st>=2 ? `<path d="M46 34 L40 18 L52 30Z M74 34 L80 18 L68 30Z" fill="${c2}"/>` : '';
  const aura = st>=5 ? `<circle cx="60" cy="62" r="54" fill="none" stroke="${c}" stroke-width="2" opacity=".35" stroke-dasharray="6 8"/>` : '';
  const crown = st>=7 ? `<path d="M44 20 L50 8 L56 18 L60 4 L64 18 L70 8 L76 20Z" fill="#FFD27A" stroke="#B8801A" stroke-width="2"/>` : '';
  const whisk = st>=4 ? `<path d="M40 70 Q26 74 22 86 M80 70 Q94 74 98 86" fill="none" stroke="${c2}" stroke-width="2.5" stroke-linecap="round"/>` : '';
  return `<svg viewBox="0 0 120 120" class="bounce">${aura}${wings}<path d="M60 108 Q30 104 26 84 Q22 66 40 62 Q30 52 40 44 Q60 30 82 46 Q96 58 84 66 Q100 74 94 90 Q88 106 60 108Z" fill="${c}" stroke="${c2}" stroke-width="3"/>${horns}${crown}
    <ellipse cx="60" cy="90" rx="18" ry="10" fill="#FFF6DC" opacity=".8"/>
    <circle cx="49" cy="56" r="6" fill="#fff"/><circle cx="71" cy="56" r="6" fill="#fff"/><circle cx="50" cy="57" r="3" fill="#1A1400"/><circle cx="72" cy="57" r="3" fill="#1A1400"/>
    <path d="M52 72 Q60 78 68 72" fill="none" stroke="#1A1400" stroke-width="2.5" stroke-linecap="round"/><circle cx="60" cy="66" r="2" fill="${c2}"/>${whisk}
    <path d="M94 90 Q112 96 108 112 Q104 100 92 100" fill="${c}" stroke="${c2}" stroke-width="3"/></svg>`;
}

// ============================================================ ДАННЫЕ: ИНДЕКСЫ
let LESSON_BY_ID={}, HANZI_LIST=[];
function indexData(){ LESSON_BY_ID={}; LESSONS.forEach(l=>LESSON_BY_ID[l.id]=l);
  // дедупликация словаря по zh+py
  const seen=new Set(); WORDS.forEach(w=>{ const k=w.zh+'|'+w.py; w.dup=seen.has(k); seen.add(k); });
  const set=new Map(); LESSONS.forEach(l=>(l.hanzi||[]).forEach(c=>{ if(!set.has(c)) set.set(c,l.gate); })); RADICALS.forEach(r=>{ if(/^[㐀-鿿]$/.test(r[0]) && !set.has(r[0])) set.set(r[0],0); }); HANZI_LIST=[...set.entries()].map(([c,g])=>({c,g}));
  buildCharMap(); }
function gateLessons(g){ return LESSONS.filter(l=>l.gate===g); }
function gateUnlocked(g){ return S.set.free || g===1 || S.gatesDone.includes(g-1); }
function lessonUnlocked(l){ if(S.set.free) return true; if(!gateUnlocked(l.gate)) return false; const ls=gateLessons(l.gate); const i=ls.indexOf(l); if(l.boss) return ls.filter(x=>!x.boss).every(x=>S.done[x.id]); return i===0 || !!S.done[ls[i-1].id]; }
function nextLesson(){ for(const l of LESSONS){ if(!S.done[l.id] && lessonUnlocked(l)) return l; } return null; }
function charInfo(c){ const w=WORDS.find(x=>x.zh===c); const r=RADICALS.find(x=>x.split? false : x[0]===c); const comps=RADICALS.filter(x=>x[4]&&x[4].split(' ').includes(c)); return {w, r, comps}; }

// ============================================================ РОУТЕР
const NAV = [
  {h:'#/', n:'Домой', i:'i-home'}, {h:'#/path', n:'Путь', i:'i-path'}, {h:'#/review', n:'Повтор', i:'i-cards', badge:()=>dueCards().length},
  {h:'#/tones', n:'Тоны', i:'i-wave'}, {h:'#/hanzi', n:'Знаки', i:'i-brush', d:true}, {h:'#/speak', n:'Речь', i:'i-mic', d:true}, {h:'#/words', n:'Словарь', i:'i-book', d:true},
  {h:'#/progress', n:'Прогресс', i:'i-chart', d:true}, {h:'#/settings', n:'Настройки', i:'i-gear', d:true}, {h:'#/more', n:'Ещё', i:'i-gear', m:true}
];
function renderNav(){ const cur=location.hash||'#/'; const root=cur.split('/').slice(0,2).join('/'); const isM=matchMedia('(max-width:899px)').matches;
  $('#nav').innerHTML=NAV.filter(x=> isM ? !x.d : !x.m).map(x=>{ const on = x.h==='#/' ? (cur==='#/'||cur==='') : root===x.h || (x.h==='#/more'&&/^#\/(more|hanzi|speak|words|progress|settings|grammar|pinyin)/.test(cur)) || (x.h==='#/path'&&/^#\/lesson/.test(cur)); const b=x.badge?x.badge():0; return `<a href="${x.h}" class="${on?'on':''}">${ico(x.i)}<span>${x.n}</span>${b?`<span class="badge">${b}</span>`:''}</a>`; }).join(''); }
const PAGES = {};
let Lesson=null;
function route(){ TTS.stop(); STT.stop(); Pitch.stop(); rollDay(); const h=(location.hash||'#/').slice(2); const [p,arg]=h.split('/'); const fn=PAGES[p||'home']||PAGES.home; if(p!=='lesson') Lesson=null;
  document.documentElement.dataset.theme=S.set.theme==='light'?'light':''; const app=$('#app'); app.innerHTML=''; app.scrollTop=0; window.scrollTo(0,0); fn(app, decodeURIComponent(arg||'')); renderNav(); }
window.addEventListener('hashchange', route);
window.addEventListener('resize', renderNav);

function topbar(title, back){ return `<div class="topbar">${back?`<a class="btn icon ghost sm" href="${back}" aria-label="Назад">${ico('i-back')}</a>`:''}<a class="brand" href="#/"><span class="zh">龙</span> ${title||'Путь Дракона'}</a><span class="grow"></span>
  <span class="pill red" title="Серия дней">${ico('i-flame')}${S.streak}</span><span class="pill gold" title="Опыт">${ico('i-bolt')}${S.xp}</span>${API.ok?`<span id="sync" class="pill" title="Синхронизация">${ico('i-sync')}</span>`:''}</div>`; }

// ============================================================ СТРАНИЦЫ
PAGES.home = (app) => {
  touch(); checkAch(); const st=dragonStage(); const nxt=DRAGON[st+1]; const due=dueCards().length; const nl=nextLesson(); const prog=nxt? clamp((S.xp-DRAGON[st].xp)/(nxt.xp-DRAGON[st].xp),0,1):1;
  const quests=S.day.quests.map(id=>QUESTS.find(q=>q.id===id)).filter(Boolean);
  const dayXP=S.day.xp, goalXP=Math.round(S.set.goal*4);
  app.innerHTML = topbar() + `
  <div class="card gold"><div class="dragon">${dragonSVG(st)}<div class="grow"><div class="lvl">Ступень ${st+1} из ${DRAGON.length}</div><div class="name">${esc(DRAGON[st].name)} <span class="zh dim">${DRAGON[st].zh}</span></div>
    <p class="small muted" style="margin:6px 0">${esc(DRAGON[st].tip)}</p>
    <div class="bar thin"><i style="width:${prog*100}%"></i></div><div class="xs dim mt-s">${nxt? `${S.xp} / ${nxt.xp} XP до «${esc(nxt.name)}»` : 'Максимальная ступень'}</div></div></div></div>
  <div class="card"><div class="row sb"><h2 style="margin:0">Сегодня${S.name?', '+esc(S.name):''}</h2><span class="chip ${dayXP>=goalXP?'jade':'gold'}">${ico('i-target')} ${dayXP} / ${goalXP} XP</span></div>
    <div class="bar jade mt-s"><i style="width:${clamp(dayXP/goalXP,0,1)*100}%"></i></div>
    <div class="actions">
      ${due? `<a class="btn primary big" href="#/review">${ico('i-cards')} Повторить ${plural(due,'карточку','карточки','карточек')}</a>` : `<a class="btn big" href="#/review">${ico('i-cards')} Повторений нет — отлично</a>`}
      ${nl? `<a class="btn ${due?'':'primary'} big" href="#/lesson/${nl.id}">${ico('i-play')} ${S.done[nl.id]?'Повторить':'Урок'} ${nl.gate}.${nl.n}: ${esc(nl.title)}</a>` : `<a class="btn big" href="#/path">${ico('i-trophy')} Все уроки пройдены</a>`}
      <a class="btn big" href="#/tones">${ico('i-wave')} Тоны: 1 минута</a>
    </div></div>
  <div class="card"><h3>Квесты дня</h3>${quests.map(q=>{ const v=Math.min(S.day[q.key]||0,q.target); const done=S.day.questsDone.includes(q.id); return `<div class="quest ${done?'done':''}"><div class="ic">${ico(done?'i-check':q.icon)}</div><div class="grow"><div class="row sb"><span>${esc(q.text)}</span><span class="xs dim">+${q.xp} XP</span></div><div class="bar thin"><i style="width:${v/q.target*100}%"></i></div></div></div>`; }).join('')}</div>
  <div class="grid3"><div class="stat"><b>${S.streak}</b><span>дней подряд</span></div><div class="stat"><b>${learnedCount()}</b><span>слов выучено</span></div><div class="stat"><b>${Object.keys(S.done).length}/${LESSONS.length}</b><span>уроков</span></div></div>
  <div class="hint mt">${esc(rnd(NUDGES))}</div>
  ${!TTS.voices.length && TTS.ready && !(API.ok&&API.tts) ? `<div class="hint mt" style="border-color:var(--red)">Китайский голос не найден. Windows: Параметры → Время и язык → Речь → Управление голосами → добавить «中文 (中国)». Android/iOS: голоса уже встроены — откройте курс в Chrome/Safari.</div>`:''}
  `;
};

PAGES.more = (app) => { app.innerHTML = topbar('Ещё') + `<div class="card"><div class="list">${NAV.filter(x=>x.d).map(x=>`<a class="btn block" style="justify-content:flex-start;margin:6px 0" href="${x.h}">${ico(x.i)} ${x.n}</a>`).join('')}<a class="btn block" style="justify-content:flex-start;margin:6px 0" href="#/grammar">${ico('i-book')} Грамматика</a><a class="btn block" style="justify-content:flex-start;margin:6px 0" href="#/pinyin">${ico('i-ear')} Таблица пиньиня</a></div></div>`; };

PAGES.path = (app) => {
  app.innerHTML = topbar('Путь') + GATES.map(g=>{ const ls=gateLessons(g.n); const done=ls.filter(l=>S.done[l.id]).length; const unl=gateUnlocked(g.n);
    return `<section class="gate ${unl?'':'locked'}"><div class="gate-head"><div class="num">${g.zh}</div><div class="grow"><div style="font-weight:800">${g.n}. ${esc(g.name)} <span class="chip">${esc(g.hsk)}</span></div><div class="small muted">${esc(g.sub)}</div></div><div class="small"><b>${done}</b>/${ls.length}</div></div>
    <p class="small muted" style="padding:10px 6px 0">${esc(g.desc)}</p>
    <div class="path">${ls.map(l=>{ const d=S.done[l.id]; const un=lessonUnlocked(l); const cur=!d&&un; return `<a class="node ${d?'done':''} ${cur?'cur':''} ${un?'':'lock'}" href="${un?'#/lesson/'+l.id:'#/path'}" ${un?'':'aria-disabled="true"'}><div class="dot">${d?ico('i-check'):(un? (l.boss?ico('i-trophy'):l.n) : ico('i-lock'))}</div><div><div class="t">${l.boss?'Испытание: ':''}${esc(l.title)}</div><div class="s">${esc(l.sub)}</div></div>${d?`<div class="stars">${'★'.repeat(d.stars)}${'☆'.repeat(3-d.stars)}</div>`:''}</a>`; }).join('')}</div></section>`; }).join('') +
  (S.set.free?'':`<p class="center xs dim mt">Ворота открываются по очереди. Хотите свободный доступ — включите в <a href="#/settings">настройках</a>.</p>`);
};

// ---------- ПОВТОРЕНИЕ (SRS)
PAGES.review = (app) => {
  let queue=dueCards(); const total=queue.length; let i=0, dir=0;
  const wrap=()=>app.innerHTML=topbar('Повторение','#/')+`<div id="rv"></div>`;
  wrap();
  const empty=()=>{ const all=Object.keys(S.srs).length; $('#rv').innerHTML=`<div class="card center"><h2>${total?'Готово!':'На сегодня всё'}</h2><p class="muted">${total? `Повторено ${plural(total,'карточка','карточки','карточек')}.` : all? 'Ближайшие карточки придут завтра. Хотите — повторите 10 досрочно.' : 'Карточки появятся после первого урока.'}</p>
    <div class="actions">${all?`<button class="btn" data-act="early">${ico('i-shuffle')} 10 досрочно</button>`:''}${nextLesson()?`<a class="btn primary" href="#/lesson/${nextLesson().id}">${ico('i-play')} К уроку</a>`:''}<a class="btn ghost" href="#/">Домой</a></div></div>`;
    $('#rv').onclick=e=>{ if(e.target.closest('[data-act=early]')){ queue=Object.keys(S.srs).sort((a,b)=>S.srs[a].due-S.srs[b].due).slice(0,10).map(cardOf).filter(Boolean); i=0; show(); } }; };
  const show=()=>{ if(i>=queue.length){ save(); checkAch(); return empty(); } const c=queue[i]; dir = c.kind==='p' && Math.random()<0.5 ? 1 : 0; // 0: ru→zh (продукция), 1: zh→ru
    $('#rv').innerHTML=`<div class="lesson-top"><div class="bar"><i style="width:${i/queue.length*100}%"></i></div><span class="small dim">${i+1}/${queue.length}</span></div>
    <div class="card"><div class="phrase" id="front">${dir===0? `<span class="ru" style="font-size:1.4rem">${esc(c.ru)}</span><span class="lit">${c.kind==='w'?'слово':'фраза'} · скажите по-китайски вслух, потом откройте</span>` : `${colorZh(c.zh,c.py)}<span class="lit">что это значит?</span>`}</div>
      <div id="back" hidden><div class="phrase">${dir===0? colorZh(c.zh,c.py) : ''}${S.set.pinyin!=='never'||dir===1?`<span class="py">${esc(showPy(c.py))}</span>`:''}${dir===1?`<span class="ru">${esc(c.ru)}</span>`:''}${c.lit?`<span class="lit">${esc(c.lit)}</span>`:''}${c.ex?`<div class="hint mt small"><span class="zh">${esc(c.ex)}</span> — ${esc(c.expy)}<br>${esc(c.exru)}</div>`:''}</div>
        <div class="row" style="justify-content:center"><button class="btn sm" data-act="play">${ico('i-sound')} Ещё раз</button><button class="btn sm" data-act="slow">${ico('i-turtle')} Медленно</button></div>
        <div class="opts" style="grid-template-columns:repeat(4,1fr);margin-top:14px"><button class="opt" style="justify-content:center;border-color:var(--red)" data-g="0">Забыл</button><button class="opt" style="justify-content:center" data-g="1">Трудно</button><button class="opt" style="justify-content:center;border-color:var(--jade)" data-g="2">Помню</button><button class="opt" style="justify-content:center;border-color:var(--gold)" data-g="3">Легко</button></div></div>
      <div id="frontBtns" class="actions"><button class="btn primary big grow" data-act="reveal">Показать</button>${STT.ok&&dir===0?`<button class="btn icon big" data-act="mic" aria-label="Сказать">${ico('i-mic')}</button>`:''}</div>
      <div id="heard" class="heard mt" hidden></div></div>`;
    if(dir===1 && S.set.autoplay) TTS.say(c.zh);
    const reveal=()=>{ $('#back').hidden=false; $('#frontBtns').hidden=true; if(S.set.autoplay) TTS.say(c.zh); };
    $('#rv').onclick=e=>{ const a=e.target.closest('[data-act]'); const g=e.target.closest('[data-g]'); if(g){ srsUpdate(c.id, +g.dataset.g); i++; show(); return; } if(!a) return;
      if(a.dataset.act==='reveal') reveal(); if(a.dataset.act==='play') TTS.say(c.zh); if(a.dataset.act==='slow') TTS.say(c.zh,{rate:0.6});
      if(a.dataset.act==='mic'){ a.classList.add('on'); const h=$('#heard'); h.hidden=false; h.innerHTML='<span class="dim">Слушаю…</span>'; STT.start({onResult:(t)=>{ h.innerHTML=`<span class="zh">${esc(t)}</span>`; }, onEnd:(fin)=>{ a.classList.remove('on'); const sc=similarity(fin, c.zh); h.innerHTML=`<span class="zh">${esc(fin||'…')}</span> <span class="chip ${sc>=0.7?'jade':'red'}">${Math.round(sc*100)} %</span>`; reveal(); }}); } };
  };
  show();
};

// ---------- ТОНЫ
PAGES.tones = (app) => {
  const syls = []; WORDS.filter(w=>w.hsk<=2 && hanOnly(w.zh).length===1 && toneOf(w.py)<5).forEach(w=>syls.push(w));
  app.innerHTML = topbar('Тоны','#/') + `
  <div class="card"><h2>Четыре тона</h2><p class="muted small">Нажмите — послушайте. Кладите руку на макушку: высота голоса — это физика, а не память.</p>
   ${TONES.map(t=>`<div class="item"><span class="zh T${t.n}" style="font-size:1.8rem;min-width:2em">${['妈','麻','马','骂','吗'][t.n-1]}</span><div class="grow"><div><b class="T${t.n}">${esc(t.name)}</b> <span class="dim">${t.mark}</span></div><div class="small muted">${esc(t.ru)}</div><div class="xs dim">${t.ex.join(' · ')}</div></div><button class="btn icon sm" data-say="${['妈','麻','马','骂','吗'][t.n-1]}">${ico('i-sound')}</button></div>`).join('')}</div>
  <div class="card"><h2>Тренажёр тона с микрофоном</h2><p class="small muted">Выберите тон, послушайте образец, нажмите микрофон и протяните слог. Золотая линия — ваш голос, пунктир — цель. Засчитывается совпадение от 60 %.</p>
   <div class="tone-pick" id="tpick">${[1,2,3,4].map(t=>`<button class="btn sm ${t===1?'primary':''}" data-t="${t}"><span class="T${t}" style="font-size:1.2rem">${['ˉ','ˊ','ˇ','ˋ'][t-1]}</span> ${t}</button>`).join('')}<button class="btn sm" data-t="0">${ico('i-shuffle')} Случайный</button></div>
   <div class="phrase" id="tword"></div><canvas class="tone" id="tcanvas"></canvas>
   <div class="mic-wrap"><button class="mic" id="tmic" aria-label="Записать">${ico('i-mic')}</button><div id="tres" class="center"><span class="dim small">Нажмите и произнесите слог</span></div></div></div>
  <div class="card"><h2>Пары тонов на слух</h2><p class="small muted">Слышите слово — выбираете, какие два тона в нём. 16 комбинаций — основа понимания речи.</p><div id="tpairs"></div></div>
  <div class="card"><h2>Пары звуков</h2><p class="small muted">Согласные, которые русское ухо путает. Слышите одно из двух слов — выбираете.</p><div id="tmin"></div></div>`;
  // тренажёр
  let tone=1, word=null;
  const pickWord=()=>{ const t = tone||rnd([1,2,3,4]); const c=syls.filter(w=>toneOf(w.py)===t); word=c.length?rnd(c):{zh:['妈','麻','马','骂'][t-1],py:['mā','má','mǎ','mà'][t-1],ru:''}; word.t=t; $('#tword').innerHTML=`<span class="zh T${t}">${word.zh}</span><span class="py">${esc(word.py)}</span><span class="ru small muted">${esc(word.ru)}</span>`; Pitch.draw($('#tcanvas'), t, null); if(S.set.autoplay) TTS.say(word.zh,{rate:0.7}); };
  $('#tpick').onclick=e=>{ const b=e.target.closest('[data-t]'); if(!b) return; $$('#tpick .btn').forEach(x=>x.classList.remove('primary')); b.classList.add('primary'); tone=+b.dataset.t; pickWord(); };
  $('#tword').onclick=()=>TTS.say(word.zh,{rate:0.7});
  $('#tmic').onclick=async()=>{ const m=$('#tmic'); if(Pitch.on){ Pitch.stop(); return; } m.classList.add('on'); $('#tres').innerHTML='<span class="dim small">Говорите…</span>'; const cv=$('#tcanvas');
    await Pitch.start({onFrame:(f,t,s)=>{ if(s.length>3) Pitch.draw(cv, word.t, Pitch.contour(s)); }, onDone:(s)=>{ m.classList.remove('on'); const u=Pitch.contour(s); Pitch.draw(cv, word.t, u); if(!u){ $('#tres').innerHTML='<span class="small">Голос не пойман — говорите громче и протяжнее (1 сек).</span>'; return; }
      const sc=Pitch.score(u, word.t), heard=Pitch.classify(u); const ok=sc>=0.6; if(ok){ bump('tones',1); addXP(3); save(); }
      $('#tres').innerHTML=`<div class="score ${ok?'T2':'T1'}">${Math.round(sc*100)} %</div><div class="small">${ok?'Попадание!':'Мимо.'} Ваш контур похож на <b class="T${heard}">${heard}-й тон</b>${heard!==word.t?`, нужен <b class="T${word.t}">${word.t}-й</b>`:''}. ${hintTone(word.t, u)}</div>`; }}); };
  pickWord();
  // пары тонов
  const tp=$('#tpairs'); let cur=null; const tonesOf=py=>syllables(py).map(toneOf).join('-');
  const nextPair=()=>{ cur=rnd(TONE_PAIRS); const ans=tonesOf(cur[1]); const opts=new Set([ans]); const all=[...new Set(TONE_PAIRS.map(p=>tonesOf(p[1])))]; while(opts.size<4) opts.add(rnd(all)); tp.innerHTML=`<div class="row" style="justify-content:center;margin:10px 0"><button class="btn primary" data-act="play">${ico('i-sound')} Слушать</button><button class="btn sm" data-act="slow">${ico('i-turtle')}</button></div><div class="opts two">${shuffle([...opts]).map(o=>`<button class="opt" style="justify-content:center" data-a="${o}">${o.split('-').map(t=>`<span class="T${t}">${['ˉ','ˊ','ˇ','ˋ','·'][t-1]}</span>`).join(' ')} <span class="dim small">${o}</span></button>`).join('')}</div><div id="tpf"></div>`; TTS.say(cur[0],{rate:0.8}); };
  tp.onclick=e=>{ const a=e.target.closest('[data-act]'); const o=e.target.closest('[data-a]'); if(a){ TTS.say(cur[0],{rate:a.dataset.act==='slow'?0.55:0.8}); return; } if(!o) return; const ok=o.dataset.a===tonesOf(cur[1]); o.classList.add(ok?'ok':'bad'); if(ok){ bump('tones',1); addXP(2); save(); } $('#tpf').innerHTML=`<div class="feedback ${ok?'ok':'bad'}">${ico(ok?'i-check':'i-x')}<div><b class="zh">${cur[0]}</b> ${esc(cur[1])} — ${esc(cur[2])}${ok?'':`. Правильно: ${tonesOf(cur[1])}`}</div><button class="btn sm primary" style="margin-left:auto" data-next="1">Дальше</button></div>`; tp.onclick=ev=>{ if(ev.target.closest('[data-next]')){ nextPair(); bindPairs(); } else if(ev.target.closest('[data-act]')) TTS.say(cur[0],{rate:0.8}); }; };
  const bindPairs=()=>{ tp.onclick=tp.onclick; };
  nextPair();
  // минимальные пары
  const tm=$('#tmin'); let mp=null, which=0;
  const nextMin=()=>{ mp=rnd(MIN_PAIRS); which=Math.random()<0.5?0:1; const w=which?mp.b:mp.a; tm.innerHTML=`<div class="row sb"><span class="chip blue">${esc(mp.t)}</span><button class="btn sm primary" data-act="play">${ico('i-sound')} Слушать</button></div><div class="pairs mt-s">${[mp.a,mp.b].map((x,i)=>`<button class="opt" data-i="${i}"><span class="zh">${x[0]}</span><div><div>${esc(x[1])}</div><div class="xs dim">${esc(x[2])}</div></div></button>`).join('')}</div><div id="tmf"></div>`; TTS.say(w[0],{rate:0.8});
    tm.onclick=e=>{ if(e.target.closest('[data-act]')){ TTS.say(w[0],{rate:0.8}); return; } const o=e.target.closest('[data-i]'); if(!o) return; const ok=+o.dataset.i===which; o.classList.add(ok?'ok':'bad'); if(ok){ addXP(2); save(); } $('#tmf').innerHTML=`<div class="feedback ${ok?'ok':'bad'}">${ico(ok?'i-check':'i-x')}<div>${esc(mp.tip)}</div><button class="btn sm primary" style="margin-left:auto" data-next="1">Дальше</button></div>`; tm.onclick=ev=>{ if(ev.target.closest('[data-next]')) nextMin(); else if(ev.target.closest('[data-act]')) TTS.say(w[0],{rate:0.8}); }; }; };
  nextMin();
  app.addEventListener('click', e=>{ const s=e.target.closest('[data-say]'); if(s) TTS.say(s.dataset.say,{rate:0.7}); });
};
function hintTone(t,u){ if(!u) return ''; const rng=Math.max(...u)-Math.min(...u); const slope=u[u.length-1]-u[0];
  if(t===1) return rng>2.5?'Держите голос ровно, как ноту — без движения вверх или вниз.':'Ровно — хорошо. Можно чуть выше.';
  if(t===2) return slope<2?'Начните ниже и тяните вверх сильнее — как удивлённое «да-а?».':'';
  if(t===3) return 'Уйдите голосом в самый низ, задержитесь и лишь чуть поднимитесь в конце.';
  if(t===4) return slope>-2?'Начните высоко и резко упадите — коротко, как «Нет!».':''; return ''; }

// ---------- ИЕРОГЛИФЫ
PAGES.hanzi = (app, ch) => {
  if(ch){ return hanziDetail(app, ch); }
  const groups={}; HANZI_LIST.forEach(x=>{ (groups[x.g]=groups[x.g]||[]).push(x.c); });
  app.innerHTML = topbar('Иероглифы','#/') + `<div class="card"><h2>Ключи и знаки</h2><p class="small muted">Каждый иероглиф — картинка с историей. Сначала 60 ключей (из них собраны все знаки), затем знаки из уроков. Нажмите — увидите порядок черт и напишете сами. Прописано: <b>${S.tot.hanzi}</b>.</p>
   <div class="row"><span class="chip jade">■ написан ≥3 раз</span><span class="chip gold">■ начат</span></div></div>
   ${Object.keys(groups).sort((a,b)=>a-b).map(g=>`<div class="card"><h3>${g==='0'?'Ключи (радикалы)':'Ворота '+g+' — '+esc(GATES[g-1].name)}</h3><div class="hz-grid">${groups[g].map(c=>{ const n=S.hz[c]||0; const info=charInfo(c); const py=info.w?info.w.py:(info.r?info.r[1]:''); return `<a class="hz ${n>=3?'known':n?'learn':''}" href="#/hanzi/${encodeURIComponent(c)}"><span class="zh">${c}</span><small>${esc(py)}</small></a>`; }).join('')}</div></div>`).join('')}`;
};
function hanziDetail(app, c){
  const info=charInfo(c); const rad=RADICALS.find(r=>r[0]===c); const w=info.w; const py=w?w.py:(rad?rad[1]:''); const ru=w?w.ru:(rad?rad[2]:''); const inWords=WORDS.filter(x=>x.zh.includes(c)&&x.zh!==c&&!x.dup).slice(0,8);
  app.innerHTML = topbar('Иероглиф','#/hanzi') + `<div class="card center"><div class="row" style="justify-content:center;gap:16px"><span class="zh" style="font-size:3.5rem">${c}</span><div style="text-align:left"><div style="font-size:1.3rem">${esc(py)}</div><div class="muted">${esc(ru)}</div><button class="btn sm mt-s" data-act="say">${ico('i-sound')} Слушать</button></div></div>
   ${rad?`<div class="hint mt" style="text-align:left"><b>История:</b> ${esc(rad[3])}<br><span class="xs dim">Встречается в: <span class="zh">${esc(rad[4])}</span></span></div>`:''}
   ${info.comps.length?`<div class="row mt" style="justify-content:center">${info.comps.map(r=>`<a class="chip" href="#/hanzi/${encodeURIComponent(r[0])}"><span class="zh">${r[0]}</span> ${esc(r[2])}</a>`).join('')}</div>`:''}
   <div class="writer mt" id="writer"><svg class="grid" viewBox="0 0 100 100"><path d="M0 50H100M50 0V100M0 0L100 100M100 0L0 100" stroke="currentColor" stroke-width=".5" stroke-dasharray="3 3"/></svg></div>
   <div class="actions"><button class="btn" data-act="anim">${ico('i-play')} Показать черты</button><button class="btn primary" data-act="quiz">${ico('i-brush')} Написать самому</button></div><div id="wres" class="mt small muted">Написано раз: <b>${S.hz[c]||0}</b></div></div>
   ${inWords.length?`<div class="card"><h3>Слова с этим знаком</h3>${inWords.map(x=>`<div class="wordrow"><span class="zh">${esc(x.zh)}</span><span class="py">${esc(x.py)}</span><span class="ru">${esc(x.ru)}</span><button class="btn icon sm" data-say="${esc(x.zh)}">${ico('i-sound')}</button></div>`).join('')}</div>`:''}`;
  let writer=null; const mount=()=>{ if(!window.HanziWriter){ $('#wres').innerHTML='Библиотека прописей не загрузилась.'; return; } const el=$('#writer'); const size=el.clientWidth; writer=HanziWriter.create(el, c, {width:size, height:size, padding:12, showOutline:true, strokeAnimationSpeed:1, delayBetweenStrokes:180, strokeColor:getComputedStyle(document.documentElement).getPropertyValue('--fg').trim(), outlineColor:getComputedStyle(document.documentElement).getPropertyValue('--line2').trim(), drawingColor:getComputedStyle(document.documentElement).getPropertyValue('--gold').trim(), highlightColor:getComputedStyle(document.documentElement).getPropertyValue('--jade').trim(), radicalColor:getComputedStyle(document.documentElement).getPropertyValue('--red').trim(),
      charDataLoader:(ch,onLoad,onErr)=>fetch('data/hanzi/'+encodeURIComponent(ch)+'.json').then(r=>{ if(!r.ok) throw 0; return r.json(); }).then(onLoad).catch(()=>fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/'+encodeURIComponent(ch)+'.json').then(r=>r.json()).then(onLoad).catch(()=>{ $('#wres').innerHTML='Нет данных о чертах для этого знака (нужен интернет при первом открытии).'; onErr&&onErr(); })) });
    writer.animateCharacter(); };
  setTimeout(mount, 50);
  app.onclick=e=>{ const a=e.target.closest('[data-act]'); const s=e.target.closest('[data-say]'); if(s){ TTS.say(s.dataset.say); return; } if(!a||!writer) return;
    if(a.dataset.act==='say') TTS.say(c); if(a.dataset.act==='anim') writer.animateCharacter();
    if(a.dataset.act==='quiz'){ $('#wres').innerHTML='Пишите по порядку черт. Подсказка появится после 3 ошибок.'; writer.quiz({showHintAfterMisses:3, onComplete:(sum)=>{ S.hz[c]=(S.hz[c]||0)+1; bump('hanzi',1); addXP(5); save(); $('#wres').innerHTML=`<span class="T2">Написано! Ошибок: ${sum.totalMistakes}.</span> Всего раз: <b>${S.hz[c]}</b>`; }}); } };
}

// ---------- РЕЧЬ
const BOT_Q = [
  {g:1, q:'你好！你叫什么名字？', ru:'Привет! Как тебя зовут?'}, {g:1, q:'你是哪国人？', ru:'Из какой ты страны?'}, {g:1, q:'你好吗？', ru:'Как ты?'},
  {g:2, q:'你多大？', ru:'Сколько тебе лет?'}, {g:2, q:'你家有几口人？', ru:'Сколько человек в семье?'}, {g:2, q:'你做什么工作？', ru:'Кем работаешь?'}, {g:2, q:'你喜欢做什么？', ru:'Что любишь делать?'}, {g:2, q:'今天天气怎么样？', ru:'Какая сегодня погода?'}, {g:2, q:'你会说汉语吗？', ru:'Говоришь по-китайски?'},
  {g:3, q:'你昨天做什么了？', ru:'Что делал вчера?'}, {g:3, q:'你去过中国吗？', ru:'Бывал в Китае?'}, {g:3, q:'周末你打算做什么？', ru:'Планы на выходные?'}, {g:3, q:'你为什么学汉语？', ru:'Почему учишь китайский?'}, {g:3, q:'你每天学习多长时间？', ru:'Сколько учишься каждый день?'},
  {g:4, q:'你觉得汉语难吗？为什么？', ru:'Китайский трудный? Почему?'}, {g:4, q:'如果有一百万，你想做什么？', ru:'Если бы был миллион — что бы сделал?'}, {g:4, q:'介绍一下你最好的朋友。', ru:'Расскажи о лучшем друге.'},
  {g:5, q:'你的工作压力大吗？怎么放松？', ru:'Стресс на работе большой? Как расслабляешься?'}, {g:5, q:'你认为健康的生活方式是什么？', ru:'Что такое здоровый образ жизни?'},
  {g:6, q:'你觉得科技对生活的影响是好还是坏？', ru:'Влияние технологий — благо или зло?'}, {g:7, q:'给我讲一个笑话吧。', ru:'Расскажи шутку.'}
];
const BOT_ACK = ['好的！','是吗？有意思。','明白了。','太好了！','嗯，我知道了。','真的吗？','哈哈，不错。'];
PAGES.speak = (app) => {
  const maxG = S.set.free?7:(Math.max(1,...S.gatesDone)+1);
  const topics=SPEAK_TOPICS.filter(t=>t.gate<=maxG);
  app.innerHTML = topbar('Речь','#/') + `<div class="card"><h2>Разговор с Сяолуном</h2><p class="small muted">Дракон задаёт вопросы голосом — вы отвечаете в микрофон. Он не проверяет грамматику, он проверяет, что вы говорите. Так растёт смелость.</p><div class="dialog" id="bot"></div><div class="actions"><button class="btn primary" id="botStart">${ico('i-chat')} Начать разговор</button><button class="btn icon" id="botMic" hidden aria-label="Ответить">${ico('i-mic')}</button></div></div>
  <div class="card"><h2>Монолог на тему</h2><p class="small muted">Выберите тему, говорите 1–2 минуты. Курс отмечает опорные слова, которые услышал. Считается каждая секунда речи.</p><div class="opts">${topics.map((t,i)=>`<button class="opt" data-topic="${SPEAK_TOPICS.indexOf(t)}"><span class="k">${t.gate}</span><div><div>${esc(t.t)}</div><div class="xs dim">${esc(t.ru)}</div></div></button>`).join('')}</div><div id="mono"></div></div>`;
  // бот
  let qs=[], qi=0; const bot=$('#bot');
  const line=(a,zh,ru)=>{ bot.insertAdjacentHTML('beforeend', `<div class="line ${a==='B'?'b':''}"><div class="who">${a==='A'?'龙':'Я'}</div><div class="bub"><span class="zh">${esc(zh)}</span>${ru?`<span class="ru">${esc(ru)}</span>`:''}</div></div>`); bot.scrollTop=bot.scrollHeight; };
  const ask=()=>{ if(qi>=qs.length){ line('A','今天聊得很开心！再见！','Приятно было поболтать! Пока!'); TTS.say('今天聊得很开心！再见！'); $('#botMic').hidden=true; $('#botStart').hidden=false; $('#botStart').textContent='Ещё раз'; addXP(15); save(); return; } const q=qs[qi]; line('A',q.q,q.ru); TTS.say(q.q); $('#botMic').hidden=false; };
  $('#botStart').onclick=()=>{ qs=pick(BOT_Q.filter(q=>q.g<=maxG), 6); qi=0; bot.innerHTML=''; $('#botStart').hidden=true; ask(); };
  $('#botMic').onclick=()=>{ const m=$('#botMic'); m.classList.add('on'); let tmp=bot.insertAdjacentHTML('beforeend','<div class="line b" id="tmpl"><div class="who">Я</div><div class="bub"><span class="zh dim">…</span></div></div>'); STT.start({onResult:t=>{ $('#tmpl .zh').textContent=t||'…'; }, onEnd:fin=>{ m.classList.remove('on'); $('#tmpl')?.remove(); line('B', fin||'（не расслышал）'); if(fin){ const ack=rnd(BOT_ACK); setTimeout(()=>{ line('A',ack); TTS.say(ack).then(()=>{ qi++; setTimeout(ask,300); }); },300); addXP(4); save(); } else { toast('Ничего не услышал — попробуйте ещё раз'); } }}); };
  // монолог
  const mono=$('#mono'); let topic=null, t0=0, timer=0, heardAll='';
  app.onclick=e=>{ const b=e.target.closest('[data-topic]'); if(!b) return; topic=SPEAK_TOPICS[+b.dataset.topic]; heardAll='';
    mono.innerHTML=`<div class="card flat mt"><h3>${esc(topic.t)}</h3><p class="small">${esc(topic.ru)}</p><div class="row" id="keys">${topic.keys.map(k=>`<span class="chip" data-k="${esc(k)}"><span class="zh">${esc(k)}</span></span>`).join('')}</div><div class="mic-wrap"><button class="mic" id="mmic">${ico('i-mic')}</button><div id="mtime" class="score">0:00</div></div><div class="heard" id="mheard"><span class="dim small">Здесь появится распознанный текст</span></div></div>`;
    $('#mmic').onclick=()=>{ const m=$('#mmic'); if(STT.active){ STT.stop(); return; } m.classList.add('on'); t0=Date.now(); timer=setInterval(()=>{ const s=Math.round((Date.now()-t0)/1000); $('#mtime').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); },500);
      STT.start({continuous:true, onResult:(t,fin)=>{ $('#mheard').innerHTML=`<span class="zh">${esc(t)}</span>`; const all=heardAll+t; topic.keys.forEach(k=>{ if(all.includes(k)||noTone(toPyString(all)).includes(noTone(toPyString(k)))) $(`#keys [data-k="${k}"]`)?.classList.add('jade'); }); }, onEnd:(fin)=>{ heardAll+=fin; m.classList.remove('on'); clearInterval(timer); const found=$$('#keys .jade').length; const sec=Math.round((Date.now()-t0)/1000); addXP(Math.min(30, Math.round(sec/6)+found*3)); save(); toast(`Речь: ${sec} с, опорных слов: ${found}/${topic.keys.length}`); }}); }; };
};

// ---------- СЛОВАРЬ
PAGES.words = (app) => {
  app.innerHTML = topbar('Словарь','#/') + `<div class="card"><input class="txt" id="q" placeholder="Поиск: иероглиф, пиньинь, перевод…" autocomplete="off"><div class="row mt-s" id="hsk">${[1,2,3,4,5,6,7].map(h=>`<button class="chip ${h===1?'gold':''}" data-h="${h}">${h===7?'Чэнъюй/сленг':'HSK '+h}</button>`).join('')}<button class="chip" data-h="srs">Мои карточки</button></div><p class="xs dim mt-s">Всего слов: ${WORDS.filter(w=>!w.dup).length}. Слова из уроков попадают в повторение автоматически; любое другое можно добавить кнопкой «+».</p></div><div class="card" id="list"></div>`;
  let h=1, q=''; const list=$('#list');
  const draw=()=>{ let arr=WORDS.filter(w=>!w.dup); if(h==='srs') arr=arr.filter(w=>S.srs['w:'+w.id]); else if(!q) arr=arr.filter(w=>w.hsk===h); if(q){ const qq=q.toLowerCase(), qn=noTone(q); arr=arr.filter(w=>w.zh.includes(q)||w.ru.toLowerCase().includes(qq)||(qn&&noTone(w.py).includes(qn))); }
    list.innerHTML = arr.length? `<div class="small dim mb">${arr.length} слов</div>`+arr.slice(0,300).map(w=>{ const id='w:'+w.id; const lv=srsLevel(id); return `<div class="wordrow" data-id="${w.id}"><span class="srs l${lv}" title="${['не в повторении','новое','учится','выучено'][lv]}"></span><span class="zh">${esc(w.zh)}</span><span class="py">${esc(w.py)}</span><span class="ru">${esc(w.ru)}</span><button class="btn icon sm" data-say="${esc(w.zh)}" aria-label="Слушать">${ico('i-sound')}</button>${lv?'' :`<button class="btn icon sm" data-add="${w.id}" aria-label="Учить">+</button>`}</div>`; }).join('') : '<p class="muted">Ничего не найдено.</p>'; };
  $('#q').oninput=e=>{ q=e.target.value.trim(); draw(); }; $('#hsk').onclick=e=>{ const b=e.target.closest('[data-h]'); if(!b) return; $$('#hsk .chip').forEach(x=>x.classList.remove('gold')); b.classList.add('gold'); h=b.dataset.h==='srs'?'srs':+b.dataset.h; draw(); };
  list.onclick=e=>{ const s=e.target.closest('[data-say]'); const a=e.target.closest('[data-add]'); const r=e.target.closest('.wordrow'); if(s){ TTS.say(s.dataset.say); return; } if(a){ addCard('w:'+a.dataset.add); save(); toast('Добавлено в повторение'); draw(); return; } if(r){ const w=WORDS[+r.dataset.id]; if(w.ex) modal(`<div class="phrase">${colorZh(w.zh,w.py)}<span class="py">${esc(w.py)}</span><span class="ru">${esc(w.ru)}</span></div><div class="hint"><span class="zh">${esc(w.ex)}</span><br>${esc(w.expy)}<br><span class="muted">${esc(w.exru)}</span></div><div class="actions"><button class="btn" data-say="${esc(w.ex)}">${ico('i-sound')} Пример</button><button class="btn primary" data-act="close-modal">Закрыть</button></div>`, m=>{ m.onclick=ev=>{ const s=ev.target.closest('[data-say]'); if(s) TTS.say(s.dataset.say); }; }); TTS.say(w.zh); } };
  draw();
};

// ---------- ГРАММАТИКА / ПИНЬИНЬ
PAGES.grammar = (app) => { app.innerHTML = topbar('Грамматика','#/more') + GATES.map(g=>{ const cards=GRAMMAR.filter(x=>x.gate===g.n); if(!cards.length) return ''; return `<div class="card"><h3><span class="zh">${g.zh}</span> Ворота ${g.n} — ${esc(g.name)}</h3>${cards.map(c=>`<div class="item" style="align-items:flex-start;flex-direction:column;gap:4px"><b>${esc(c.t)}</b><div class="small">${c.h}</div></div>`).join('')}</div>`; }).join(''); };
PAGES.pinyin = (app) => {
  const exFor=(pre,isFinal)=>{ const w=WORDS.find(w=>!w.dup&&w.hsk<=2&&hanOnly(w.zh).length===1&&(isFinal? noTone(syllables(w.py)[0]||'').replace(/^[bpmfdtnlgkhjqxzcsryw]h?/,'').replace(/^(?<=[jqxy])u/,'v')===pre.replace('ü','v') : noTone(w.py).startsWith(pre) && !(pre.length===1 && /^(zh|ch|sh)/.test(noTone(w.py))) )); return w; };
  app.innerHTML = topbar('Пиньинь','#/more') + `<div class="card"><h2>Инициали (начала слогов)</h2><p class="small muted">Нажмите — услышите слово с этим звуком.</p><div class="pinyin-grid">${PINYIN_INIT.map(([p,r])=>{ const w=exFor(p); return `<button class="btn" data-say="${w?esc(w.zh):''}" title="${esc(r)}${w?' · '+esc(w.zh)+' '+esc(w.py):''}"><b>${p}</b></button>`; }).join('')}</div><div class="table mt small">${PINYIN_INIT.map(([p,r])=>`<span class="chip"><b>${p}</b> ${esc(r)}</span> `).join('')}</div></div>
  <div class="card"><h2>Финали (окончания)</h2><div class="pinyin-grid">${PINYIN_FIN.map(([p,r])=>{ const w=exFor(p,true); return `<button class="btn" data-say="${w?esc(w.zh):''}" title="${esc(r)}${w?' · '+esc(w.zh)+' '+esc(w.py):''}"><b>${p}</b></button>`; }).join('')}</div><div class="mt small">${PINYIN_FIN.map(([p,r])=>`<span class="chip"><b>${p}</b> ${esc(r)}</span> `).join('')}</div></div>
  <div class="card"><h3>Правила чтения</h3><ul class="small"><li><b>i</b> после zh/ch/sh/r/z/c/s — глухое «ы»: 是 shì, 四 sì, 吃 chī.</li><li><b>u</b> после j/q/x/y — всегда ü: 去 qù = «цю», 学 xué = «сюэ».</li><li><b>e</b> одиночное — глубокое «э/ы»: 饿 è, 喝 hē; в <b>ie/üe</b> — обычное «е»: 写 xiě.</li><li><b>-ian</b> читается «-ен», а не «-ян»: 天 tiān = «тхен».</li><li><b>iu</b> = «ёу» (liù), <b>ui</b> = «уэй» (duì), <b>un</b> = «уэн» (lún).</li><li><b>Нейтральный тон</b> — коротко и тихо: 妈妈 māma, 谢谢 xièxie.</li><li>Два 3-х тона подряд: первый → 2-й (你好 ní hǎo). 不 перед 4-м тоном → bú. 一 перед 4-м → yí, перед остальными → yì.</li></ul></div>`;
  app.onclick=e=>{ const s=e.target.closest('[data-say]'); if(s&&s.dataset.say){ TTS.say(s.dataset.say,{rate:0.7}); toast(s.title); } };
};

// ---------- ПРОГРЕСС
PAGES.progress = (app) => {
  checkAch(); const hours=(S.tot.min||0)/60; const learned=learnedCount(); const gateDone=Math.max(0,...S.gatesDone);
  const daily=S.set.goal; const remaining=MILESTONES.filter(m=>m.gate>gateDone);
  app.innerHTML = topbar('Прогресс','#/') + `<div class="grid3"><div class="stat"><b>${S.xp}</b><span>XP</span></div><div class="stat"><b>${S.streak}</b><span>серия</span></div><div class="stat"><b>${learned}</b><span>выучено</span></div><div class="stat"><b>${Object.keys(S.done).length}</b><span>уроков</span></div><div class="stat"><b>${S.tot.tones}</b><span>тонов</span></div><div class="stat"><b>${Math.round(S.tot.speakSec/60)}</b><span>мин речи</span></div><div class="stat"><b>${S.tot.hanzi}</b><span>знаков</span></div><div class="stat"><b>${Object.keys(S.srs).length}</b><span>карточек</span></div><div class="stat"><b>${hours.toFixed(1)}</b><span>часов</span></div></div>
  <div class="card mt"><h2>Честная карта пути</h2><p class="small muted">Часы — реальные часы активной практики (курс считает только время в уроках, повторениях и тренажёрах). «Носитель» — не уровень экзамена, а годы среды. Мы не обещаем язык за 30 дней; мы обещаем, что каждые 20 минут пойдут в дело.</p>
   <div class="timeline">${MILESTONES.map(m=>{ const d=S.gatesDone.includes(m.gate); const cur=!d && gateUnlocked(m.gate); const daysLeft = d?0:Math.max(0,Math.round((m.hours-hours)*60/daily)); return `<div class="tl ${d?'done':cur?'cur':''}"><b>Ворота ${m.gate}</b> · ${esc(m.label)}<div class="xs dim">~${m.hours} ч практики${d?' — пройдено':cur?` — при ${daily} мин/день ≈ ещё ${plural(daysLeft,'день','дня','дней')}`:''}</div></div>`; }).join('')}</div></div>
  <div class="card"><h2>Достижения <span class="chip">${S.ach.length}/${ACHIEVEMENTS.length}</span></h2><div class="ach">${ACHIEVEMENTS.map(a=>`<div class="a ${S.ach.includes(a.id)?'got':''}">${ico(a.icon)}<b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div>`).join('')}</div></div>
  <div class="card"><h2>Что дальше — среда</h2><p class="small muted">Курс даёт систему; язык дают люди и контент. С ворот 3 добавляйте по одному источнику:</p><ul class="list">${RESOURCES.map(r=>`<li><b>${esc(r.t)}</b><div class="small muted">${esc(r.d)}</div></li>`).join('')}</ul></div>`;
};

// ---------- НАСТРОЙКИ / ВХОД
PAGES.settings = (app) => {
  const vs=TTS.voices;
  app.innerHTML = topbar('Настройки','#/') + `<div class="card">
   <label class="lbl">Как вас называть</label><input class="txt" id="sname" value="${esc(S.name)}" placeholder="Имя">
   <div class="toggle"><div><b>Светлая тема</b><div class="xs dim">По умолчанию — тёмная «тушь»</div></div><button class="sw ${S.set.theme==='light'?'on':''}" data-set="theme" aria-label="Тема"></button></div>
   <div class="toggle"><div><b>Автоозвучка</b><div class="xs dim">Фразы звучат сами при показе</div></div><button class="sw ${S.set.autoplay?'on':''}" data-set="autoplay"></button></div>
   <div class="toggle"><div><b>Прописи в уроках</b><div class="xs dim">Шаг с написанием иероглифов</div></div><button class="sw ${S.set.write?'on':''}" data-set="write"></button></div>
   <div class="toggle"><div><b>Свободный доступ</b><div class="xs dim">Открыть все ворота и уроки сразу</div></div><button class="sw ${S.set.free?'on':''}" data-set="free"></button></div>
   <label class="lbl">Пиньинь в карточках повторения</label><select class="txt" id="spy"><option value="always" ${S.set.pinyin==='always'?'selected':''}>Показывать всегда</option><option value="never" ${S.set.pinyin==='never'?'selected':''}>Скрывать (учу читать)</option></select>
   <label class="lbl">Цель дня: ${S.set.goal} минут (≈ ${S.set.goal*4} XP)</label><input type="range" id="sgoal" min="5" max="60" step="5" value="${S.set.goal}" style="width:100%">
   <label class="lbl">Скорость речи: ${S.set.rate}</label><input type="range" id="srate" min="0.5" max="1.2" step="0.1" value="${S.set.rate}" style="width:100%">
   ${API.ok&&API.tts?`<label class="lbl">Голос (нейроголоса Microsoft через сервер курса)</label><select class="txt" id="ssvoice">${[['xiaoxiao','Сяосяо — женский, стандарт'],['yunxi','Юньси — мужской, живой'],['yunyang','Юньян — мужской, диктор'],['xiaoyi','Сяои — женский, мягкий'],['yunjian','Юньцзянь — мужской, спокойный'],['xiaobei','Сяобэй — северо-восточный акцент']].filter(v=>API.voices.includes(v[0])).map(v=>`<option value="${v[0]}" ${(S.set.svoice||'xiaoxiao')===v[0]?'selected':''}>${v[1]}</option>`).join('')}</select>
   <div class="toggle"><div><b>Голос браузера вместо серверного</b><div class="xs dim">Если сервер недоступен, браузерный включается сам</div></div><button class="sw ${S.set.engine==='browser'?'on':''}" data-set="engine"></button></div>`:''}
   <label class="lbl">Голос браузера (запасной)</label><select class="txt" id="svoice"><option value="">Автовыбор${TTS.pick()?' — '+esc(TTS.pick().name):''}</option>${vs.map(v=>`<option value="${esc(v.name)}" ${S.set.voice===v.name?'selected':''}>${esc(v.name)} (${v.lang})</option>`).join('')}</select>
   <div class="actions"><button class="btn" data-act="test">${ico('i-sound')} Проба голоса</button></div>
   ${!vs.length&&!(API.ok&&API.tts)?`<div class="hint mt small">Китайских голосов в системе нет. <b>Windows 11:</b> Параметры → Время и язык → Речь → «Управление голосами» → Добавить → 中文（中国）. В Edge доступны онлайн-голоса Xiaoxiao/Yunxi — они лучше всех. <b>Android:</b> Настройки → Система → Языки → Преобразование текста в речь → установить китайский. <b>iPhone:</b> Настройки → Универсальный доступ → Речь → Голоса → Китайский.</div>`:''}
  </div>
  <div class="card"><h3>Прогресс на других устройствах</h3><p class="small muted">${API.ok?'Сервер курса работает: профили с PIN хранятся в папке users и доступны с любого устройства в вашей сети по адресу этого компьютера.':'Курс открыт без сервера — прогресс живёт в этом браузере.'} В любом случае можно перенести прогресс файлом.</p>
   <div class="actions">${API.ok?`<a class="btn" href="#/login">${ico('i-user')} ${API.user?'Профиль: '+esc(API.user):'Войти в профиль'}</a>`:''}<button class="btn" data-act="export">${ico('i-book')} Экспорт в файл</button><label class="btn" style="cursor:pointer">${ico('i-sync')} Импорт из файла<input type="file" id="imp" accept="application/json" hidden></label></div>
   ${API.ok&&API.lan?`<div class="hint mt small"><b>Телефон / планшет в той же Wi-Fi:</b> откройте ${API.https?`<span class="kbd">https://${API.lan}:${API.https}</span> (микрофон работает; один раз подтвердите «Всё равно перейти» — сертификат домашний)`:`<span class="kbd">http://${API.lan}:${API.http}</span>`}. Затем «Добавить на главный экран» — курс станет приложением.</div>`:''}</div>
  <div class="card red"><h3>Сброс</h3><p class="small muted">Удалить весь прогресс в этом браузере. Дракон вернётся в яйцо.</p><button class="btn red sm" data-act="reset">Сбросить прогресс</button></div>
  <p class="center xs dim">Путь Дракона · курс работает офлайн после первого открытия · распознавание речи требует Chrome/Edge/Safari и интернет</p>`;
  $('#sname').onchange=e=>{ S.name=e.target.value.trim(); save(); }; $('#spy').onchange=e=>{ S.set.pinyin=e.target.value; save(); };
  $('#sgoal').oninput=e=>{ S.set.goal=+e.target.value; save(); e.target.previousElementSibling.textContent=`Цель дня: ${S.set.goal} минут (≈ ${S.set.goal*4} XP)`; };
  $('#srate').oninput=e=>{ S.set.rate=+e.target.value; save(); e.target.previousElementSibling.textContent=`Скорость речи: ${S.set.rate}`; };
  $('#svoice').onchange=e=>{ S.set.voice=e.target.value; save(); TTS.say('你好！我是小龙。'); }; const sv=$('#ssvoice'); if(sv) sv.onchange=e=>{ S.set.svoice=e.target.value; save(); TTS.say('你好！我是小龙，我们一起学汉语吧。'); };
  $('#imp').onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const o=JSON.parse(r.result); if(o.v!==1||o.xp==null) throw 0; S=Object.assign(DEF(),o); S.set=Object.assign(DEF().set,o.set||{}); save(); toast('Прогресс импортирован'); route(); }catch(err){ toast('Файл не похож на прогресс курса'); } }; r.readAsText(f); };
  app.onclick=e=>{ const sw=e.target.closest('[data-set]'); const a=e.target.closest('[data-act]'); if(sw){ const k=sw.dataset.set; if(k==='theme'){ S.set.theme=S.set.theme==='light'?'dark':'light'; document.documentElement.dataset.theme=S.set.theme==='light'?'light':''; } else if(k==='engine'){ S.set.engine=S.set.engine==='browser'?'server':'browser'; } else S.set[k]=!S.set[k]; sw.classList.toggle('on'); save(); renderNav(); return; } if(!a) return;
    if(a.dataset.act==='test') TTS.say('你好！我是小龙。我们一起学汉语吧！');
    if(a.dataset.act==='export'){ const b=new Blob([JSON.stringify(S)],{type:'application/json'}); const u=URL.createObjectURL(b); const l=document.createElement('a'); l.href=u; l.download='put-drakona-progress.json'; l.click(); setTimeout(()=>URL.revokeObjectURL(u),2000); }
    if(a.dataset.act==='reset'){ modal(`<h3>Точно сбросить?</h3><p class="muted">Это нельзя отменить. Сначала можно сделать экспорт.</p><div class="actions"><button class="btn red" data-act="do-reset">Да, сбросить</button><button class="btn" data-act="close-modal">Отмена</button></div>`, m=>{ m.onclick=ev=>{ if(ev.target.closest('[data-act=do-reset]')){ S=DEF(); save(); m.remove(); lastStage=0; route(); toast('Прогресс сброшен'); } }; }); } };
};
PAGES.login = async (app) => {
  const users=await API.probe(); if(!API.ok){ location.hash='#/settings'; return; }
  app.innerHTML = topbar('Профиль','#/settings') + `<div class="card"><h2>Профили</h2><p class="small muted">Профиль с PIN хранится на этом компьютере (папка users) — открывайте курс с телефона или другого браузера и продолжайте с того же места.</p>
   ${users.length?`<div class="list">${users.map(u=>`<li class="row sb"><span><b>${esc(u.name)}</b> <span class="xs dim">${u.xp} XP · серия ${u.streak} · ${u.lessons} уроков</span></span><button class="btn sm" data-u="${esc(u.name)}">Войти</button></li>`).join('')}</div>`:'<p class="muted">Профилей пока нет.</p>'}
   <label class="lbl">Имя</label><input class="txt" id="ln" value="${esc(API.user)}"><label class="lbl">PIN (4+ цифры)</label><input class="txt" id="lp" type="password" inputmode="numeric">
   <div class="actions"><button class="btn primary" data-act="login">Войти</button><button class="btn" data-act="reg">Создать профиль</button>${API.token?`<button class="btn ghost" data-act="out">Выйти</button>`:''}</div><p id="lerr" class="small T1"></p></div>`;
  app.onclick=async e=>{ const u=e.target.closest('[data-u]'); const a=e.target.closest('[data-act]'); if(u){ $('#ln').value=u.dataset.u; $('#lp').focus(); return; } if(!a) return;
    if(a.dataset.act==='out'){ API.logout(); toast('Вы вышли; прогресс остаётся в браузере'); location.hash='#/settings'; return; }
    const name=$('#ln').value.trim(), pin=$('#lp').value.trim(); if(!name||pin.length<4){ $('#lerr').textContent='Введите имя и PIN не короче 4 знаков.'; return; }
    try{ await API.login(name, pin, a.dataset.act==='reg'); toast('Добро пожаловать, '+name); lastStage=dragonStage(); location.hash='#/'; }catch(err){ $('#lerr').textContent=err.message; } };
};

// ============================================================ УРОК
PAGES.lesson = (app, id) => {
  const l=LESSON_BY_ID[id]; if(!l){ location.hash='#/path'; return; }
  if(!lessonUnlocked(l)){ toast('Урок пока закрыт — пройдите предыдущие'); location.hash='#/path'; return; }
  Lesson = new LessonRun(l, app); Lesson.start();
};
class LessonRun {
  constructor(l, app){ this.l=l; this.app=app; this.errors=0; this.combo=0; this.xp=0; this.vocab=(l.vocab||[]).map(wordByZh).filter(Boolean);
    this.steps=['intro']; if(this.vocab.length) this.steps.push('vocab'); this.steps.push('items'); if(l.pattern) this.steps.push('pattern'); this.steps.push('build','match'); if(l.hanzi&&l.hanzi.length&&S.set.write&&window.HanziWriter) this.steps.push('hanzi'); if(l.dialog) this.steps.push('dialog'); if(l.tones) this.steps.push('tones'); if(l.boss) this.steps.push('speak'); this.steps.push('quiz','done'); this.si=0; this.startT=Date.now(); }
  start(){ this.render(); const l=this.l; TTS.prefetch([...this.vocab.map(w=>w.zh), ...l.items.map(i=>i.zh), ...(l.dialog||[]).map(d=>d.zh)]); }
  get step(){ return this.steps[this.si]; }
  next(){ if(this.si<this.steps.length-1){ this.si++; addXP(3); this.render(); } }
  header(){ const l=this.l; return `<div class="lesson-top"><a class="btn icon ghost sm" href="#/path" aria-label="Выйти">${ico('i-back')}</a><div class="bar"><i style="width:${this.si/(this.steps.length-1)*100}%"></i></div><span class="small dim">${l.gate}.${l.n}</span></div>
    <div class="steps">${this.steps.slice(0,-1).map((s,i)=>`<i class="${i<this.si?'done':i===this.si?'on':''}" title="${STEP_NAMES[s]}"></i>`).join('')}</div>`; }
  render(){ TTS.stop(); STT.stop(); Pitch.stop(); const fn=this['s_'+this.step]; this.app.innerHTML=this.header()+`<div id="body" class="fade-in"></div>`; fn.call(this, $('#body')); window.scrollTo(0,0); }
  ok(){ this.combo++; setMax('bestCombo', this.combo); addXP(2); if(this.combo>=3){ let c=$('.combo'); if(!c){ c=document.createElement('div'); c.className='combo'; document.body.appendChild(c); } c.textContent=`×${this.combo} серия`; clearTimeout(this._ct); this._ct=setTimeout(()=>c.remove(),1400); } }
  bad(){ this.errors++; this.combo=0; }
  feedback(el, ok, html, onNext){ el.insertAdjacentHTML('beforeend', `<div class="feedback ${ok?'ok':'bad'}">${ico(ok?'i-check':'i-x')}<div class="grow">${html||(ok?'<b>Верно!</b>':'<b>Не совсем.</b>')}</div><button class="btn sm primary" data-fb-next="1">Дальше</button></div>`); const b=$('[data-fb-next]',el); b.focus(); b.onclick=onNext; }
  // ---- шаги
  s_intro(b){ const l=this.l; const g=GATES[l.gate-1]; b.innerHTML=`<div class="card"><span class="chip gold">${esc(g.name)} · урок ${l.n}${l.boss?' · испытание':''}</span><h1 class="mt-s">${esc(l.title)}</h1><p class="muted">${esc(l.sub)}</p><div class="hint jade"><b>Цель:</b> ${esc(l.goal)}</div><div class="mt">${l.intro}</div>
    ${l.culture?`<div class="hint mt"><b>Культура:</b> ${esc(l.culture)}</div>`:''}<div class="actions"><button class="btn primary big grow" data-act="next">${ico('i-play')} Начать · ${this.steps.length-2} ${plural(this.steps.length-2,'шаг','шага','шагов').split(' ')[1]}</button></div></div>`; b.onclick=e=>{ if(e.target.closest('[data-act=next]')) this.next(); }; }
  s_vocab(b){ const ws=this.vocab; b.innerHTML=`<div class="card"><h2>Новые слова <span class="chip">${ws.length}</span></h2><p class="small muted">Слушайте и повторяйте вслух каждое. Нажмите на слово — прозвучит ещё раз, на пример — прозвучит пример.</p>
    ${ws.map((w,i)=>`<div class="item" data-i="${i}">${colorZh(w.zh,w.py)}<div class="grow"><div class="py">${esc(w.py)}</div><div class="ru">${esc(w.ru)}</div>${w.ex?`<div class="lit" data-ex="${i}" style="cursor:pointer"><span class="zh">${esc(w.ex)}</span> — ${esc(w.exru)}</div>`:''}</div><button class="btn icon sm" data-say="${i}">${ico('i-sound')}</button></div>`).join('')}
    <div class="actions"><button class="btn" data-act="all">${ico('i-sound')} Прослушать всё</button><button class="btn primary grow" data-act="next">Дальше</button></div></div>`;
    b.onclick=async e=>{ const s=e.target.closest('[data-say]'); const ex=e.target.closest('[data-ex]'); if(s){ TTS.say(ws[+s.dataset.say].zh); return; } if(ex){ TTS.say(ws[+ex.dataset.ex].ex); return; } const a=e.target.closest('[data-act]'); if(!a) return; if(a.dataset.act==='next') this.next(); if(a.dataset.act==='all'){ for(const w of ws){ $$('.item',b).forEach(x=>x.style.borderColor=''); const el=$(`.item[data-i="${ws.indexOf(w)}"]`,b); if(el){ el.style.borderColor='var(--gold)'; el.scrollIntoView({block:'nearest'}); } await TTS.say(w.zh); await new Promise(r=>setTimeout(r,500)); } } };
    if(S.set.autoplay) TTS.say(ws[0].zh); }
  s_items(b){ const items=this.l.items; let i=0; const show=()=>{ const it=items[i]; b.innerHTML=`<div class="card"><div class="row sb"><span class="chip">Слушай и повторяй · ${i+1}/${items.length}</span><span class="xs dim">Цель: сказать так же</span></div>
      <div class="phrase">${colorZh(it.zh,it.py)}<span class="py">${esc(showPy(it.py))}</span><span class="ru">${esc(it.ru)}</span>${it.lit?`<span class="lit">дословно: ${esc(it.lit)}</span>`:''}</div>${it.note?`<div class="hint small">${esc(it.note)}</div>`:''}
      <div class="row mt" style="justify-content:center"><button class="btn" data-act="play">${ico('i-sound')} Слушать</button><button class="btn" data-act="slow">${ico('i-turtle')} Медленно</button></div>
      <div class="mic-wrap">${STT.ok?`<button class="mic" data-act="mic" aria-label="Повторить в микрофон">${ico('i-mic')}</button><div id="heard" class="heard" style="width:100%"><span class="dim small">Нажмите микрофон и повторите фразу</span></div>`:`<div class="hint small">Микрофон недоступен в этом браузере — повторяйте вслух за диктором.</div>`}</div>
      <div class="actions">${i>0?`<button class="btn" data-act="prev">${ico('i-back')}</button>`:''}<button class="btn primary grow" data-act="nx">${i<items.length-1?'Следующая фраза':'Дальше'}</button></div></div>`;
      if(S.set.autoplay) TTS.say(it.zh);
      b.onclick=e=>{ const a=e.target.closest('[data-act]'); if(!a) return; const k=a.dataset.act; if(k==='play') TTS.say(it.zh); if(k==='slow') TTS.say(it.zh,{rate:0.6}); if(k==='prev'){ i--; show(); } if(k==='nx'){ if(i<items.length-1){ i++; show(); } else this.next(); }
        if(k==='mic'){ a.classList.add('on'); const h=$('#heard'); h.innerHTML='<span class="dim">Слушаю…</span>'; STT.start({onResult:t=>{ h.innerHTML=`<span class="zh">${esc(t)}</span>`; }, onEnd:fin=>{ a.classList.remove('on'); const sc=similarity(fin,it.zh); const ok=sc>=0.7; if(ok){ this.ok(); addXP(3); } h.innerHTML=`<div class="row sb"><span class="zh">${esc(fin||'…')}</span><span class="chip ${ok?'jade':sc>=0.4?'gold':'red'}">${Math.round(sc*100)} %</span></div><div class="xs dim mt-s">${ok?'Отлично — идём дальше или повторите для закрепления.':sc>=0.4?'Близко. Послушайте медленно и повторите, следя за тонами.':'Не расслышал. Говорите чётче и ближе к микрофону; можно фразу по частям.'}</div>`; save(); }}); } }; }; show(); }
  s_pattern(b){ const p=this.l.pattern; const tried=new Set(); let cur=null; const nb=(p.frame.match(/＿/g)||[]).length; const fill=(fr,val)=>fr.split('＿').reduce((acc,part,i,arr)=>acc+part+(i<arr.length-1?(val[i]??'＿'):''),'');
    const vz=s=>nb>1? s[0].split(' ') : [s[0].replace(/ /g,'')], vp=s=>nb>1? s[1].split(' ') : [s[1]]; const full=s=>nb? fill(p.frame,vz(s)) : s[0];
    const draw=()=>{ const vals=cur? vz(cur) : []; const pys=cur? vp(cur) : []; const zh=nb? fill(p.frame, vals) : (cur? cur[0] : p.frame), py=nb? fill(p.py, pys) : (cur? cur[1] : p.py); b.innerHTML=`<div class="card"><span class="chip">Замени слово</span><p class="small muted mt-s">Одна рамка — много фраз. Нажимайте на слова внизу: фраза собирается и звучит. Повторяйте каждую вслух. Нужно попробовать минимум 3.</p>
      <div class="phrase">${cur?colorZh(zh,py):`<span class="zh">${esc(showZh(zh))}</span>`}<span class="py">${esc(showPy(py))}</span><span class="ru">${esc(p.ru)}${cur?` <span class="dim">→ ${esc(cur[2])}</span>`:''}</span></div>${p.note?`<div class="hint small">${esc(p.note)}</div>`:''}
      <div class="opts two mt">${p.slots.map((s,i)=>`<button class="opt ${tried.has(i)?'ok':''} ${cur===s?'sel':''}" data-s="${i}"><span class="zh">${esc(s[0])}</span><div><div class="small">${esc(s[1])}</div><div class="xs dim">${esc(s[2])}</div></div></button>`).join('')}</div>
      <div class="actions"><button class="btn" data-act="play" ${cur?'':'disabled'}>${ico('i-sound')} Ещё раз</button>${STT.ok?`<button class="btn icon" data-act="mic" ${cur?'':'disabled'} aria-label="Сказать">${ico('i-mic')}</button>`:''}<button class="btn primary grow" data-act="next" ${tried.size>=3?'':'disabled'}>Дальше ${tried.size<3?`(${tried.size}/3)`:''}</button></div><div id="heard" class="heard mt" hidden></div></div>`;
      b.onclick=e=>{ const s=e.target.closest('[data-s]'); const a=e.target.closest('[data-act]'); if(s){ cur=p.slots[+s.dataset.s]; tried.add(+s.dataset.s); draw(); TTS.say(full(cur)); addXP(1); return; } if(!a) return; if(a.dataset.act==='next') this.next(); if(a.dataset.act==='play'&&cur) TTS.say(full(cur)); if(a.dataset.act==='mic'&&cur){ a.classList.add('on'); const h=$('#heard'); h.hidden=false; h.innerHTML='<span class="dim">Слушаю…</span>'; const target=full(cur); STT.start({onResult:t=>{h.innerHTML=`<span class="zh">${esc(t)}</span>`;}, onEnd:fin=>{ a.classList.remove('on'); const sc=similarity(fin,target); if(sc>=0.7) this.ok(); h.innerHTML=`<span class="zh">${esc(fin||'…')}</span> <span class="chip ${sc>=0.7?'jade':'red'}">${Math.round(sc*100)} %</span>`; }}); } }; }; draw(); }
  s_build(b){ const items=pick(this.l.items.filter(it=>words(it.zh).length>=3), 3); if(!items.length) return this.next(); let i=0; const one=()=>{ if(i>=items.length) return this.next(); const it=items[i]; exBuild(b, it, this, ()=>{ i++; one(); }, `Собери фразу · ${i+1}/${items.length}`); }; one(); }
  s_match(b){ const its=pick(this.l.items, Math.min(4,this.l.items.length)); exMatch(b, its, this, ()=>this.next()); }
  s_hanzi(b){ const chars=this.l.hanzi.slice(0,4); let i=0; const show=()=>{ if(i>=chars.length) return this.next(); const c=chars[i]; const info=charInfo(c); const rad=RADICALS.find(r=>r[0]===c); const py=info.w?info.w.py:(rad?rad[1]:''); const ru=info.w?info.w.ru:(rad?rad[2]:'');
      b.innerHTML=`<div class="card center"><span class="chip">Пропись · ${i+1}/${chars.length}</span><div class="row mt" style="justify-content:center;gap:16px"><span class="zh" style="font-size:3rem">${c}</span><div style="text-align:left"><div style="font-size:1.2rem">${esc(py)}</div><div class="muted small">${esc(ru)}</div></div></div>${rad?`<div class="hint small mt" style="text-align:left">${esc(rad[3])}</div>`:info.comps.length?`<div class="xs dim mt">Ключи внутри: ${info.comps.map(r=>`<span class="zh">${r[0]}</span> ${esc(r[2])}`).join(', ')}</div>`:''}
        <div class="writer mt" id="writer"><svg class="grid" viewBox="0 0 100 100"><path d="M0 50H100M50 0V100" stroke="currentColor" stroke-width=".5" stroke-dasharray="3 3"/></svg></div><div id="wres" class="small muted mt">Смотрите порядок черт, затем пишите пальцем или мышью.</div>
        <div class="actions"><button class="btn" data-act="anim">${ico('i-play')} Ещё раз</button><button class="btn primary" data-act="quiz">${ico('i-brush')} Писать</button><button class="btn ghost" data-act="skip">Пропустить</button></div></div>`;
      let writer=null; setTimeout(()=>{ const el=$('#writer'); const size=el.clientWidth; writer=HanziWriter.create(el,c,{width:size,height:size,padding:10,showOutline:true,strokeAnimationSpeed:1,delayBetweenStrokes:150,strokeColor:getComputedStyle(document.documentElement).getPropertyValue('--fg').trim(),outlineColor:getComputedStyle(document.documentElement).getPropertyValue('--line2').trim(),drawingColor:getComputedStyle(document.documentElement).getPropertyValue('--gold').trim(),highlightColor:getComputedStyle(document.documentElement).getPropertyValue('--jade').trim(),charDataLoader:(ch,onLoad,onErr)=>fetch('data/hanzi/'+encodeURIComponent(ch)+'.json').then(r=>{if(!r.ok)throw 0;return r.json();}).then(onLoad).catch(()=>fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/'+encodeURIComponent(ch)+'.json').then(r=>r.json()).then(onLoad).catch(()=>{ $('#wres').textContent='Нет данных о чертах — пропустите этот знак.'; }))}); writer.animateCharacter(); TTS.say(c); },40);
      b.onclick=e=>{ const a=e.target.closest('[data-act]'); if(!a) return; if(a.dataset.act==='skip'){ i++; show(); } if(!writer) return; if(a.dataset.act==='anim') writer.animateCharacter(); if(a.dataset.act==='quiz'){ $('#wres').textContent='Пишите…'; writer.quiz({showHintAfterMisses:2, onComplete:(sum)=>{ S.hz[c]=(S.hz[c]||0)+1; bump('hanzi',1); this.ok(); addXP(4); save(); $('#wres').innerHTML=`<span class="T2">Готово! Ошибок: ${sum.totalMistakes}</span>`; setTimeout(()=>{ i++; show(); },900); }}); } }; }; show(); }
  s_dialog(b){ const d=this.l.dialog; let mode='listen', role='B', li=0; const draw=()=>{ b.innerHTML=`<div class="card"><div class="row sb"><span class="chip">Диалог${mode==='play'?` · вы — ${role==='B'?'второй':'первый'} собеседник`:''}</span>${mode==='listen'?`<button class="btn sm" data-act="all">${ico('i-sound')} Слушать всё</button>`:''}</div>
      <div class="dialog" id="dlg">${d.map((x,i)=>{ const mine=mode==='play'&&x.a===role; const hidden=mine&&i>=li; return `<div class="line ${x.a==='B'?'b':''}" data-i="${i}" ${i>li&&mode==='play'?'style="opacity:.35"':''}><div class="who">${x.a}</div><div class="bub ${mine?'mine':''}">${hidden?`<span class="ru">${esc(x.ru)}</span><span class="py dim">${esc(x.py)}</span><span class="xs dim">— скажите это по-китайски</span>`:`${colorZh(x.zh,x.py)}<span class="py">${esc(x.py)}</span><span class="ru">${esc(x.ru)}</span>`}</div></div>`; }).join('')}</div>
      ${mode==='listen'?`<div class="actions"><button class="btn primary grow" data-act="play">${ico('i-mic')} Сыграть роль</button><button class="btn" data-act="next">Дальше</button></div>`:`<div class="mic-wrap">${STT.ok?`<button class="mic" data-act="mic">${ico('i-mic')}</button>`:''}<div id="heard" class="heard" style="width:100%"><span class="dim small">${d[li]&&d[li].a===role?'Ваша реплика — нажмите микрофон':'Реплика собеседника'}</span></div></div><div class="actions"><button class="btn" data-act="show">Показать</button><button class="btn primary grow" data-act="step">${li<d.length-1?'Следующая реплика':'Завершить'}</button></div>`}</div>`;
      $$('#dlg .line').forEach(el=>el.onclick=()=>{ const x=d[+el.dataset.i]; if(!(mode==='play'&&x.a===role&&+el.dataset.i>=li)) TTS.say(x.zh); });
      if(mode==='play' && d[li] && d[li].a!==role){ TTS.say(d[li].zh); }
      b.onclick=async e=>{ const a=e.target.closest('[data-act]'); if(!a) return; const k=a.dataset.act; if(k==='next') this.next(); if(k==='all'){ for(let i=0;i<d.length;i++){ $$('#dlg .line').forEach(x=>x.querySelector('.bub').style.borderColor=''); const el=$(`#dlg .line[data-i="${i}"] .bub`); if(el) el.style.borderColor='var(--gold)'; await TTS.say(d[i].zh); await new Promise(r=>setTimeout(r,400)); } }
        if(k==='play'){ mode='play'; role='B'; li=0; draw(); } if(k==='show'){ const el=$(`#dlg .line[data-i="${li}"] .bub`); const x=d[li]; el.innerHTML=`${colorZh(x.zh,x.py)}<span class="py">${esc(x.py)}</span><span class="ru">${esc(x.ru)}</span>`; TTS.say(x.zh); }
        if(k==='step'){ if(li<d.length-1){ li++; draw(); } else if(role==='B'){ role='A'; li=0; toast('Теперь вы — первый собеседник'); draw(); } else this.next(); }
        if(k==='mic'){ const x=d[li]; if(x.a!==role){ toast('Сейчас реплика собеседника — нажмите «Следующая»'); return; } a.classList.add('on'); const h=$('#heard'); h.innerHTML='<span class="dim">Слушаю…</span>'; STT.start({onResult:t=>{h.innerHTML=`<span class="zh">${esc(t)}</span>`;}, onEnd:fin=>{ a.classList.remove('on'); const sc=similarity(fin,x.zh); const ok=sc>=0.65; if(ok){ this.ok(); addXP(3); } h.innerHTML=`<div class="row sb"><span class="zh">${esc(fin||'…')}</span><span class="chip ${ok?'jade':'red'}">${Math.round(sc*100)} %</span></div><div class="xs mt-s"><span class="zh">${esc(x.zh)}</span> ${esc(x.py)}</div>`; const el=$(`#dlg .line[data-i="${li}"] .bub`); el.innerHTML=`${colorZh(x.zh,x.py)}<span class="py">${esc(x.py)}</span><span class="ru">${esc(x.ru)}</span>`; save(); }}); } }; }; draw(); }
  s_tones(b){ const pool=[]; this.l.items.forEach(it=>{ const zw=words(it.zh), pw=words(it.py); zw.forEach((z,i)=>{ const h=hanOnly(z); if(h.length===1 && pw[i] && toneOf(pw[i])<5) pool.push({zh:h,py:pw[i],t:toneOf(pw[i])}); }); }); const extra=WORDS.filter(w=>w.hsk===1&&hanOnly(w.zh).length===1&&toneOf(w.py)<5).map(w=>({zh:w.zh,py:w.py,t:toneOf(w.py)})); const qs=pick([...pool,...pick(extra,6)],5); let i=0;
    const one=()=>{ if(i>=qs.length) return this.next(); const q=qs[i]; b.innerHTML=`<div class="card"><span class="chip">Какой тон? · ${i+1}/${qs.length}</span><div class="phrase"><span class="zh">${q.zh}</span><span class="py dim">${noTone(q.py)} — ${esc(wordByZh(q.zh)?.ru||'')}</span></div><div class="row" style="justify-content:center"><button class="btn primary" data-act="play">${ico('i-sound')} Слушать</button><button class="btn" data-act="slow">${ico('i-turtle')}</button></div>
      <div class="opts" style="grid-template-columns:repeat(4,1fr);margin-top:14px">${[1,2,3,4].map(t=>`<button class="opt" style="justify-content:center;flex-direction:column;gap:2px" data-t="${t}"><span class="T${t}" style="font-size:1.6rem;line-height:1">${['ˉ','ˊ','ˇ','ˋ'][t-1]}</span><span class="xs dim">${t}</span></button>`).join('')}</div></div>`; TTS.say(q.zh,{rate:0.7});
      b.onclick=e=>{ const a=e.target.closest('[data-act]'); const t=e.target.closest('[data-t]'); if(a){ TTS.say(q.zh,{rate:a.dataset.act==='slow'?0.5:0.7}); return; } if(!t) return; const ok=+t.dataset.t===q.t; t.classList.add(ok?'ok':'bad'); $$('[data-t]',b).forEach(x=>x.disabled=true); if(ok){ this.ok(); bump('tones',1); } else { this.bad(); $(`[data-t="${q.t}"]`,b).classList.add('ok'); } this.feedback($('.card',b), ok, `<b class="zh">${q.zh}</b> ${esc(q.py)} — <b class="T${q.t}">${TONES[q.t-1].name}</b>. ${esc(TONES[q.t-1].ru)}`, ()=>{ i++; one(); }); }; }; one(); }
  s_speak(b){ const keys=[]; this.l.items.forEach(it=>words(it.zh).forEach(w=>{ const h=hanOnly(w); if(h.length>=2&&keys.length<12&&!keys.includes(h)) keys.push(h); })); let heardAll='', t0=0, timer=0;
    b.innerHTML=`<div class="card"><span class="chip gold">${ico('i-trophy')} Испытание речи</span><h2 class="mt-s">Расскажите сами</h2><p class="small muted">${esc(this.l.goal)} Говорите 1–2 минуты. Курс отметит опорные слова, которые услышит. Нужно 40 % опорных слов или 60 секунд речи.</p>
      <div class="row" id="keys">${keys.map(k=>`<span class="chip" data-k="${k}"><span class="zh">${k}</span></span>`).join('')}</div>
      <div class="mic-wrap">${STT.ok?`<button class="mic" data-act="mic">${ico('i-mic')}</button>`:'<div class="hint small">Микрофон недоступен — говорите вслух и нажмите «Готово».</div>'}<div class="score" id="mt">0:00</div></div><div class="heard" id="heard"><span class="dim small">Распознанный текст появится здесь</span></div>
      <div class="actions"><button class="btn primary grow" data-act="done">Готово</button></div></div>`;
    b.onclick=e=>{ const a=e.target.closest('[data-act]'); if(!a) return; if(a.dataset.act==='done'){ STT.stop(); const found=$$('#keys .jade').length; const sec=t0?Math.round((Date.now()-t0)/1000):0; const pass=found/Math.max(1,keys.length)>=0.4 || sec>=60 || !STT.ok; if(pass){ this.ok(); addXP(20); toast(`Опорных слов: ${found}/${keys.length}, речи ${sec} с`); this.next(); } else { this.bad(); toast(`Пока мало: ${found}/${keys.length} слов, ${sec} с. Попробуйте ещё — можно подглядывать во фразы урока.`,3500); } }
      if(a.dataset.act==='mic'){ if(STT.active){ STT.stop(); return; } a.classList.add('on'); t0=t0||Date.now(); clearInterval(timer); timer=setInterval(()=>{ const s=Math.round((Date.now()-t0)/1000); $('#mt').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); },500);
        STT.start({continuous:true, onResult:(t)=>{ $('#heard').innerHTML=`<span class="zh">${esc(heardAll+t)}</span>`; const all=heardAll+t; const allPy=noTone(toPyString(all)); keys.forEach(k=>{ if(all.includes(k)||allPy.includes(noTone(toPyString(k)))) $(`#keys [data-k="${k}"]`)?.classList.add('jade'); }); }, onEnd:(fin)=>{ heardAll+=fin; a.classList.remove('on'); clearInterval(timer); }}); } }; }
  s_quiz(b){ const l=this.l; const items=l.items; const n=l.boss?10:7; const types=[]; for(let i=0;i<n;i++) types.push(['listen','translate','build','listen','translate','reverse','build'][i%7]); const qs=shuffle(types).map(t=>({t, it:rnd(items)})); let i=0; const errBefore=this.errors;
    const one=()=>{ if(i>=qs.length) return this.next(); const q=qs[i]; const title=`Проверка · ${i+1}/${qs.length}`; const nx=()=>{ i++; one(); };
      if(q.t==='build' && words(q.it.zh).length>=2) exBuild(b, q.it, this, nx, title); else if(q.t==='listen') exChoice(b, q.it, items, this, nx, title, 'listen'); else if(q.t==='reverse') exChoice(b, q.it, items, this, nx, title, 'reverse'); else exChoice(b, q.it, items, this, nx, title, 'translate'); }; one(); }
  s_done(b){ const l=this.l; const first=!S.done[l.id]; const stars=this.errors===0?3:this.errors<=2?2:1; const bossPass=!l.boss || stars>=2;
    if(bossPass){ const prev=S.done[l.id]; S.done[l.id]={stars:Math.max(stars,prev?prev.stars:0), date:todayKey(), errors:this.errors}; if(first){ bump('lessons',1); addXP(l.boss?60:30); } else addXP(10); if(this.errors===0){ bump('perfect',1); addXP(15); }
      this.vocab.forEach(w=>addCard('w:'+w.id)); l.items.forEach((it,i)=>addCard('p:'+l.id+':'+i)); if(l.boss && !S.gatesDone.includes(l.gate)){ S.gatesDone.push(l.gate); addXP(100); }
      S.tot.min=(S.tot.min||0)+Math.min(30,Math.round((Date.now()-this.startT)/60000)); S.day.min=(S.day.min||0)+Math.min(30,Math.round((Date.now()-this.startT)/60000)); touch(); save(); checkAch(); confetti(); }
    const nl=nextLesson(); const gateNow=S.gatesDone.includes(l.gate)&&l.boss;
    b.innerHTML=`<div class="card ${bossPass?'gold':'red'} center">${bossPass?`<div class="dragon" style="justify-content:center">${dragonSVG(dragonStage())}</div><h1 class="mt-s">${l.boss?(gateNow?'Ворота открыты!':'Испытание пройдено!'):'Урок пройден!'}</h1><div style="font-size:2rem;color:var(--gold)">${'★'.repeat(stars)}<span class="dim">${'★'.repeat(3-stars)}</span></div>`:`<h1>Пока не хватило</h1><p class="muted">Ошибок: ${this.errors}. Для испытания нужно не больше двух. Повторите уроки ворот и возвращайтесь — обычно хватает одного дня.</p>`}
      ${bossPass?`<p class="muted">${this.errors===0?'Без единой ошибки — чистый лист!':`Ошибок: ${this.errors}. `+(stars===2?'Хороший результат.':'Урок засчитан; повторите его позже ради трёх звёзд.')}</p>
      <div class="grid3 mt"><div class="stat"><b>+${first?(l.boss?60:30):10}${this.errors===0?'+15':''}</b><span>XP</span></div><div class="stat"><b>${this.vocab.length+l.items.length}</b><span>карточек в повтор</span></div><div class="stat"><b>${S.streak}</b><span>серия</span></div></div>
      ${l.tip?`<div class="hint mt" style="text-align:left"><b>Совет:</b> ${esc(l.tip)}</div>`:''}`:''}
      <div class="actions">${nl&&bossPass?`<a class="btn primary big grow" href="#/lesson/${nl.id}">${ico('i-play')} Следующий: ${esc(nl.title)}</a>`:''}${!bossPass?`<a class="btn primary big grow" href="#/lesson/${l.id}">Ещё раз</a>`:''}<a class="btn big" href="#/path">${ico('i-path')} Путь</a><a class="btn big" href="#/review">${ico('i-cards')} Повторить</a></div></div>`; }
}
const STEP_NAMES={intro:'Введение',vocab:'Слова',items:'Слушай и повторяй',pattern:'Замени слово',build:'Собери фразу',match:'Пары',hanzi:'Пропись',dialog:'Диалог',tones:'Тоны',speak:'Речь',quiz:'Проверка',done:'Итог'};

// ============================================================ ТРЕНАЖЁРЫ (общие)
function exBuild(b, it, run, onNext, title){ const zw=words(it.zh).map(w=>stripPunct(w)).filter(Boolean); const pw=words(it.py).map(p=>p.replace(/[.,!?，。！？]/g,''));
  const pairs=[]; run.l.items.filter(x=>x!==it).forEach(x=>{ const a=words(x.zh).map(stripPunct), c=words(x.py).map(p=>p.replace(/[.,!?，。！？]/g,'')); if(a.length===c.length) a.forEach((w,i)=>{ if(w&&!zw.includes(w)&&!pairs.some(q=>q.w===w)) pairs.push({w,py:c[i]}); }); });
  const distract=pick(pairs, Math.min(2, Math.max(0, 7-zw.length)));
  const tiles=shuffle([...zw.map((w,i)=>({w,py:pw[i]||'',ok:true,id:'t'+i})), ...distract.map((d,i)=>({w:d.w,py:d.py,ok:false,id:'d'+i}))]); let ans=[];
  const draw=()=>{ b.innerHTML=`<div class="card"><span class="chip">${title}</span><div class="phrase" style="padding:10px"><span class="ru" style="font-size:1.2rem">${esc(it.ru)}</span><button class="btn sm mt-s" data-act="play">${ico('i-sound')} Подсказка голосом</button></div>
    <div class="tiles answer" id="ans">${ans.map(t=>`<button class="tile" data-un="${t.id}">${esc(t.w)}</button>`).join('')||'<span class="dim small" style="align-self:center">Нажимайте плитки по порядку</span>'}</div>
    <div class="tiles mt" style="border:0;padding:0">${tiles.map(t=>`<button class="tile ${ans.includes(t)?'used':''}" data-t="${t.id}">${esc(t.w)}${t.py&&S.set.pinyin!=='never'?`<small>${esc(t.py)}</small>`:''}</button>`).join('')}</div>
    <div class="actions"><button class="btn primary grow" data-act="check" ${ans.length?'':'disabled'}>Проверить</button></div></div>`;
    b.onclick=e=>{ const t=e.target.closest('[data-t]'); const u=e.target.closest('[data-un]'); const a=e.target.closest('[data-act]'); if(t){ ans.push(tiles.find(x=>x.id===t.dataset.t)); draw(); } if(u){ ans=ans.filter(x=>x.id!==u.dataset.un); draw(); } if(!a) return; if(a.dataset.act==='play') TTS.say(it.zh);
      if(a.dataset.act==='check'){ const ok=ans.length===zw.length && ans.every((t,i)=>t.w===zw[i]); $$('#ans .tile').forEach((el,i)=>el.classList.add(ok||(ans[i].ok&&ans[i].w===zw[i])?'ok':'bad')); if(ok) run.ok(); else run.bad(); TTS.say(it.zh); run.feedback($('.card',b), ok, `${colorZh(it.zh,it.py)}<div class="small">${esc(showPy(it.py))}</div>${ok?'':'<div class="xs dim">Порядок: кто → когда → где → что делает.</div>'}`, onNext); $$('.tile',b).forEach(x=>x.disabled=true); } }; }; draw(); }
function exChoice(b, it, pool, run, onNext, title, mode){ // listen: слышу → выбираю zh; translate: ru → zh; reverse: zh → ru
  const others=pick(pool.filter(x=>x!==it && x.ru!==it.ru), 3); const opts=shuffle([it,...others]); const showRu=mode==='reverse';
  b.innerHTML=`<div class="card"><span class="chip">${title}</span><div class="phrase" style="padding:12px">${mode==='listen'?`<button class="btn primary big" data-act="play">${ico('i-sound')} Слушать</button> <button class="btn big" data-act="slow">${ico('i-turtle')}</button><span class="lit mt-s">Что вы услышали?</span>`:mode==='translate'?`<span class="ru" style="font-size:1.25rem">${esc(it.ru)}</span><span class="lit">Как это по-китайски?</span>`:`${colorZh(it.zh,it.py)}<span class="py">${esc(showPy(it.py))}</span><span class="lit">Что это значит?</span>`}</div>
    <div class="opts">${opts.map((o,i)=>`<button class="opt" data-o="${i}"><span class="k">${i+1}</span>${showRu?esc(o.ru):`<span class="zh">${esc(showZh(o.zh))}</span>`}</button>`).join('')}</div></div>`;
  if(mode==='listen') TTS.say(it.zh);
  b.onclick=e=>{ const a=e.target.closest('[data-act]'); const o=e.target.closest('[data-o]'); if(a){ TTS.say(it.zh,{rate:a.dataset.act==='slow'?0.55:S.set.rate}); return; } if(!o) return; const ok=opts[+o.dataset.o]===it; o.classList.add(ok?'ok':'bad'); $$('[data-o]',b).forEach(x=>{ x.disabled=true; if(opts[+x.dataset.o]===it) x.classList.add('ok'); }); if(ok) run.ok(); else run.bad(); if(mode!=='listen') TTS.say(it.zh); run.feedback($('.card',b), ok, `${colorZh(it.zh,it.py)}<div class="small">${esc(showPy(it.py))} — ${esc(it.ru)}</div>`, onNext); };
  document.onkeydown=e=>{ if(/^[1-4]$/.test(e.key)){ const o=$(`[data-o="${+e.key-1}"]`,b); if(o&&!o.disabled) o.click(); } }; }
function exMatch(b, items, run, onNext){ const L=shuffle(items.map((it,i)=>({i,t:showZh(it.zh),py:it.py}))), R=shuffle(items.map((it,i)=>({i,t:it.ru}))); let sel=null, left=items.length;
  b.innerHTML=`<div class="card"><span class="chip">Соедини пары</span><p class="small muted mt-s">Нажмите фразу слева, затем её перевод справа.</p><div class="pairs mt-s" id="pairs"><div style="display:grid;gap:10px">${L.map(x=>`<button class="opt" data-l="${x.i}"><span class="zh" style="font-size:1.15rem">${esc(x.t)}</span></button>`).join('')}</div><div style="display:grid;gap:10px">${R.map(x=>`<button class="opt" data-r="${x.i}"><span class="small">${esc(x.t)}</span></button>`).join('')}</div></div></div>`;
  b.onclick=e=>{ const l=e.target.closest('[data-l]'); const r=e.target.closest('[data-r]'); if(l){ $$('[data-l]',b).forEach(x=>x.classList.remove('sel')); l.classList.add('sel'); sel=+l.dataset.l; TTS.say(items[sel].zh); return; } if(r&&sel!=null){ const ok=+r.dataset.r===sel; const le=$(`[data-l="${sel}"]`,b); if(ok){ run.ok(); le.classList.add('gone'); r.classList.add('gone'); left--; sel=null; if(!left){ run.feedback($('.card',b), true, '<b>Все пары найдены!</b>', onNext); } } else { run.bad(); r.classList.add('bad'); le.classList.add('bad'); setTimeout(()=>{ r.classList.remove('bad'); le.classList.remove('bad'); },500); } } }; }

// ============================================================ ЗАПУСК
document.addEventListener('click', e=>{ if(e.target.closest('[data-act=close-modal]')) e.target.closest('.modal')?.remove(); });
setInterval(()=>{ if(document.visibilityState!=='visible') return; if(/^#\/(lesson|review|tones|speak|hanzi)/.test(location.hash)){ S.tot.min=(S.tot.min||0)+1; S.day.min=(S.day.min||0)+1; if(S.tot.min%5===0) save(); } }, 60000);
(async function boot(){
  load(); indexData(); rollDay(); TTS.init(); lastStage=dragonStage();
  if(location.protocol!=='file:' && 'serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
  await API.probe(); if(API.ok && API.token){ await API.pull(); }
  route();
  if(!S.name && !S.flags.welcomed){ S.flags.welcomed=true; save(); modal(`<div class="center"><div class="dragon" style="justify-content:center">${dragonSVG(0)}</div><h2>Путь Дракона</h2><p class="muted">Китайский с нуля: сначала речь и тоны, потом иероглифы. 20 минут в день, каждый день. Дракон растёт от ваших XP — кормите его.</p>
    <p class="small">Как вас называть?</p><input class="txt" id="wname" placeholder="Имя" autocomplete="off"><div class="actions"><button class="btn primary block" data-act="go">Начать с Ворот Звука</button></div>
    <p class="xs dim">Нужны: звук (китайский голос есть в Windows/Android/iOS) и микрофон — для тонов и речи. Курс работает бесплатно и без интернета после первого открытия.</p></div>`, m=>{ m.onclick=e=>{ if(e.target.closest('[data-act=go]')){ S.name=$('#wname',m).value.trim(); save(); m.remove(); location.hash='#/lesson/g1-01'; route(); } }; $('#wname',m).focus(); }); }
})();
