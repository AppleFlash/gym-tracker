'use strict';
/* Design system runtime: push/pop transitions, edge swipe-back, sheets, alerts, iOS-style bar chart.
   Knows nothing about workouts: the app feeds it routes, html and data (see ds.swipe / ds.chartCard). */
const ds=(()=>{
const EASE='cubic-bezier(.32,.72,0,1)',DUR=400;
const $=s=>document.querySelector(s);
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api={fresh:false,range:'all',scroll:new Map(),charts:new Map(),onDismiss:()=>{}};
let busy=false;

/* ---------- Screen transitions ---------- */
// A frozen copy of the current screen, kept at the same scroll offset, is animated next to the live one.
function layer(app){
  const c=app.cloneNode(true);
  c.removeAttribute('id');c.className='snapshot';c.inert=true;c.setAttribute('aria-hidden','true');
  c.querySelectorAll('dialog').forEach(d=>d.remove());
  return c;
}
// Animates the live layer `cur` against its frozen predecessor `snap`: the incoming layer slides over, the other drifts back 30%.
function slide(cur,snap,push){
  const top=push?cur:snap,under=push?snap:cur;
  top.classList.add('top');under.classList.add('under');
  const o={duration:DUR,easing:EASE,fill:'both'},dim=b=>({filter:`brightness(${b})`});
  const a=top.animate(push?[{transform:'translateX(100%)'},{transform:'translateX(0)'}]:[{transform:'translateX(0)'},{transform:'translateX(100%)'}],o);
  const u=under.animate(push?[{transform:'translateX(0)',...dim(1)},{transform:'translateX(-30%)',...dim(.88)}]:[{transform:'translateX(-30%)',...dim(.88)},{transform:'translateX(0)',...dim(1)}],o);
  return Promise.allSettled([a.finished,u.finished]).then(()=>{
    a.cancel();u.cancel();top.classList.remove('top');under.classList.remove('under');snap.remove();
  });
}
// dir: 1 push, -1 pop, 0 none. keys: {from,to} remember scroll so a pop lands where the user left.
api.go=(dir,mutate,{from,to,animate=true}={})=>{
  const app=$('#app'),stack=$('#stack');
  if(from)api.scroll.set(from,app.scrollTop);
  const move=dir&&animate&&!busy&&!reduced()&&!!app.animate;
  let snap=null;
  if(move){snap=layer(app);stack.append(snap);snap.scrollTop=app.scrollTop;}
  api.fresh=animate;mutate();api.fresh=false;
  app.scrollTop=dir<0&&to?api.scroll.get(to)||0:0;
  api.syncNavbar();
  if(!move)return;
  busy=true;stack.style.pointerEvents='none';
  slide(app,snap,dir>0).then(()=>{busy=false;stack.style.pointerEvents='';});
};

/* ---------- Navigation bar: inline title fades in once the large title scrolls under it ---------- */
api.syncNavbar=()=>{
  const app=$('#app'),bar=app.querySelector('.navbar'),h1=app.querySelector('.screen-body h1');
  if(!bar)return;
  const title=bar.querySelector('.nav-title');
  if(h1&&title.textContent!==h1.textContent)title.textContent=h1.textContent;
  bar.classList.toggle('blur',app.scrollTop>1); // material as soon as content slides under the bar
  bar.classList.toggle('scrolled',h1?h1.getBoundingClientRect().bottom<bar.getBoundingClientRect().bottom+4:app.scrollTop>4);
};
$('#app').addEventListener('scroll',()=>requestAnimationFrame(api.syncNavbar),{passive:true});

/* ---------- Interactive swipe-back from the left edge ----------
   hooks: parent() -> route|null, html(route) -> screen html, key(route), commit(route) navigates without animation. */
api.swipe=({parent,html,key,commit})=>{
  const stack=$('#stack');let st=null;
  const place=(app,under,dx,W)=>{
    app.style.transform=`translateX(${dx}px)`;
    under.style.transform=`translateX(${-30*(1-dx/W)}%)`;under.style.filter=`brightness(${.88+.12*dx/W})`;
  };
  const start=()=>{
    const app=$('#app'),under=document.createElement('main');
    under.className='snapshot under';under.inert=true;under.setAttribute('aria-hidden','true');under.innerHTML=html(st.p);
    stack.insertBefore(under,app);under.scrollTop=api.scroll.get(key(st.p))||0;
    app.classList.add('top');st.app=app;st.under=under;st.W=stack.clientWidth;st.active=true;place(app,under,0,st.W);
  };
  const end=ok=>{
    const {app,under,W,dx,p}=st;st=null;
    const finish=()=>{
      if(ok)commit(p);
      app.classList.remove('top','settling');under.classList.remove('settling');
      app.style.transform='';under.remove();busy=false;
    };
    busy=true;app.classList.add('settling');under.classList.add('settling');
    place(app,under,ok?W:0,W);
    let done=false;const once=()=>{if(!done){done=true;finish();}};
    app.addEventListener('transitionend',once,{once:true});setTimeout(once,450);
  };
  document.addEventListener('touchstart',ev=>{
    if(st||busy||ev.touches.length!==1||$('dialog[open]'))return;
    const t=ev.touches[0],p=t.clientX<=24&&parent();
    if(p)st={p,x:t.clientX,y:t.clientY,dx:0,lx:t.clientX,lt:performance.now(),v:0,active:false};
  },{passive:true});
  document.addEventListener('touchmove',ev=>{
    if(!st)return;
    const t=ev.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.active){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){st=null;return;}
      if(dx<8)return;
      start();
    }
    ev.preventDefault();
    const now=performance.now();st.v=(t.clientX-st.lx)/Math.max(1,now-st.lt);st.lx=t.clientX;st.lt=now;
    st.dx=Math.max(0,Math.min(st.W,dx));place(st.app,st.under,st.dx,st.W);
  },{passive:false});
  const release=()=>{if(!st)return;if(!st.active){st=null;return;}end(st.dx>st.W*.4||st.v>.5);};
  document.addEventListener('touchend',release);document.addEventListener('touchcancel',release);
};

/* ---------- Sheet ---------- */
api.sheetOpened=(dlg,hadSheet)=>{
  if(hadSheet)dlg.classList.add('instant');
  dlg.tabIndex=-1;dlg.focus({preventScroll:true}); // no focus ring on the first button
  if(!dlg.querySelector('.sheet-grabber')){const g=document.createElement('div');g.className='sheet-grabber';g.setAttribute('aria-hidden','true');dlg.prepend(g);}
};
// The re-render replaces the open dialog, so animate a clone out instead.
api.sheetClosed=old=>{
  const c=old.cloneNode(true);
  c.removeAttribute('open');c.classList.remove('instant','dragging','settle');c.classList.add('closing');c.inert=true;
  document.body.append(c);c.showModal();
  const drop=()=>{if(c.isConnected){c.close();c.remove();}};
  c.addEventListener('animationend',ev=>{if(ev.target===c)drop();});setTimeout(drop,600);
};
document.addEventListener('pointerdown',ev=>{
  const g=ev.target.closest('.sheet-grabber');if(!g)return;
  const d=g.closest('dialog'),y0=ev.clientY,t0=performance.now();let dy=0;
  d.classList.add('instant','dragging');d.classList.remove('settle');g.setPointerCapture(ev.pointerId);
  const mv=m=>{dy=Math.max(0,m.clientY-y0);d.style.transform=`translateY(${dy}px)`;};
  const up=()=>{
    g.removeEventListener('pointermove',mv);g.removeEventListener('pointerup',up);g.removeEventListener('pointercancel',up);
    d.classList.remove('dragging');
    if(dy>120||(dy>30&&dy/(performance.now()-t0)>.6)){api.onDismiss();return;}
    d.classList.add('settle');d.style.transform='';setTimeout(()=>d.classList.remove('settle'),360);
  };
  g.addEventListener('pointermove',mv);g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);
});

// Navigation inside an open sheet (e.g. group -> exercises) pushes like a screen, clipped by the sheet.
api.sheetLayer=dlg=>{
  const shell=dlg.querySelector(':scope>.card');if(!shell)return null;
  const c=shell.cloneNode(true);
  c.classList.add('snapshot');c.inert=true;c.setAttribute('aria-hidden','true');
  c._scroll=[...shell.querySelectorAll('.catalog-content')].map(n=>n.scrollTop);
  return c;
};
api.sheetSlide=(dlg,snap,dir)=>{
  const cur=dlg.querySelector(':scope>.card:not(.snapshot)');
  if(!snap||!cur||reduced()||!cur.animate)return;
  dlg.append(snap);
  snap.querySelectorAll('.catalog-content').forEach((n,i)=>{n.scrollTop=snap._scroll[i]||0;});
  slide(cur,snap,dir>0);
};

/* ---------- Toggles: the screen is re-rendered on every change, so replay the flip ----------
   Capture on/off state of switches, checkmarks and completed rows before rendering, then show the old state
   for one frame and flip to the new one, so CSS transitions run. */
const TOGGLES='[role=switch],.check,.ex[data-id]';
const tkey=el=>(el.dataset.action||'')+'|'+(el.dataset.day||'')+'|'+(el.dataset.id||'');
const tcls=el=>el.matches('.ex')?'completed':'checked';
const isOn=el=>el.hasAttribute('aria-checked')?el.getAttribute('aria-checked')==='true':el.classList.contains(tcls(el));
const setOn=(el,on)=>{
  if(el.hasAttribute('aria-checked'))el.setAttribute('aria-checked',on);else el.classList.toggle(tcls(el),on);
  if(el.hasAttribute('aria-pressed'))el.setAttribute('aria-pressed',on);
};
api.captureToggles=root=>new Map([...root.querySelectorAll(TOGGLES)].map(el=>[tkey(el),isOn(el)]));
api.playToggles=(root,prev)=>{
  if(reduced())return;
  const flips=[...root.querySelectorAll(TOGGLES)].filter(el=>prev.has(tkey(el))&&prev.get(tkey(el))!==isOn(el)).map(el=>[el,isOn(el)]);
  if(!flips.length)return;
  flips.forEach(([el,on])=>setOn(el,!on));
  void root.offsetWidth;
  flips.forEach(([el,on])=>setOn(el,on));
};

/* ---------- Alert popup ---------- */
// actions: [{label,value,style:'default'|'destructive',cancel}]; resolves with the tapped action's value.
api.alert=({title,message='',actions})=>new Promise(resolve=>{
  const d=document.createElement('dialog');
  d.className='ds-alert';d.setAttribute('role','alertdialog');d.setAttribute('aria-labelledby','dsAlertTitle');
  d.innerHTML=`<div class="alert-body"><div class="alert-title" id="dsAlertTitle">${e(title)}</div>${message?`<div class="alert-message">${e(message)}</div>`:''}</div><div class="alert-actions ${actions.length===2?'pair':''}">${actions.map((a,i)=>`<button type="button" class="${a.style||''}" data-i="${i}">${e(a.label)}</button>`).join('')}</div>`;
  const done=v=>{
    d.classList.add('closing');
    const drop=()=>{if(d.isConnected){d.close();d.remove();}};
    d.addEventListener('animationend',drop,{once:true});setTimeout(drop,400);resolve(v);
  };
  d.addEventListener('click',ev=>{const b=ev.target.closest('button[data-i]');if(b)done(actions[b.dataset.i].value);});
  d.addEventListener('cancel',ev=>{ev.preventDefault();done((actions.find(a=>a.cancel)||{}).value??false);});
  document.body.append(d);d.showModal();d.tabIndex=-1;d.focus({preventScroll:true});
});
api.confirm=(title,message,{ok='OK',destructive=false}={})=>api.alert({title,message,actions:[{label:'Отмена',value:false,cancel:true},{label:ok,value:true,style:destructive?'destructive':'default'}]});

/* ---------- iOS-style bar chart ----------
   Hairline grid, labels on the trailing edge, rounded bars, the last bar selected; touch and drag to scrub. */
const RANGES=[['1m','1М',30],['3m','3М',90],['6m','6М',180],['all','Все',0]];
const W=340,H=190,PAD_R=34,PAD_T=10,PAD_B=24,PW=W-PAD_R,PH=H-PAD_T-PAD_B;
const inRange=(pts,r)=>{const d=RANGES.find(x=>x[0]===r)?.[2];return d?pts.filter(p=>p.t&&p.t>=Date.now()-d*864e5):pts;};
const niceStep=(max,n=4)=>{const raw=max/n,p=10**Math.floor(Math.log10(raw)),f=raw/p;return(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p;};
const num=v=>v.toLocaleString('ru-RU',{maximumFractionDigits:2});
const barPath=(x,y,w,h,r)=>{r=Math.min(r,w/2,h);return`M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`;};
const geometry=pts=>{
  const max=Math.max(1,...pts.map(p=>p.v)),step=niceStep(max),top=step*Math.ceil(max/step),slot=PW/pts.length;
  return{step,top,slot,y:v=>PAD_T+PH*(1-v/top),cx:i=>i*slot+slot/2};
};
const head=(c,p)=>`<div class="chart-head"><div class="chart-value num" data-ic-val>${e(num(p.v))}<small>${e(c.unit)}</small></div><div class="chart-sub" data-ic-sub>${e(p.sub)}</div></div>`;
function chartBody(id){
  const c=api.charts.get(id),pts=inRange(c.pts,api.range).slice(-30);
  if(!pts.length)return'<p class="chart-empty">Нет записей за этот период.</p>';
  const g=geometry(pts),sel=pts.length-1,bw=Math.min(28,g.slot*.62),every=Math.ceil(pts.length/Math.max(1,Math.floor(PW/54)));
  let s='';
  for(let i=0;i<=Math.round(g.top/g.step);i++){const y=g.y(i*g.step);s+=`<line class="ic-grid" x1="0" x2="${PW}" y1="${y}" y2="${y}"/><text class="ic-axis" x="${W}" y="${y}" dy=".35em" text-anchor="end">${e(num(i*g.step))}</text>`;}
  s+=`<line class="ic-rule" x1="${g.cx(sel)}" x2="${g.cx(sel)}" y1="${PAD_T}" y2="${PAD_T+PH}"/>`;
  s+=pts.map((p,i)=>`<path class="ic-bar ${i===sel?'sel':''}" style="--i:${i}" d="${barPath(g.cx(i)-bw/2,g.y(p.v),bw,Math.max(2,PAD_T+PH-g.y(p.v)),6)}"/>`).join('');
  s+=pts.map((p,i)=>(pts.length-1-i)%every?'':`<text class="ic-axis" x="${g.cx(i)}" y="${H-6}" text-anchor="middle">${e(p.label)}</text>`).join('');
  return head(c,pts[sel])+`<div class="ios-chart ${api.fresh?'fresh':''}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(c.label)}">${s}</svg><div class="chart-callout"><b></b><span></span></div></div>`;
}
api.chartCard=(id,c)=>{
  api.charts.set(id,c);
  return`<section class="card chart-card" data-chart="${e(id)}"><div class="segmented" role="tablist" aria-label="Период" style="--n:${RANGES.length};--i:${RANGES.findIndex(r=>r[0]===api.range)}">${RANGES.map(r=>`<button type="button" role="tab" aria-selected="${r[0]===api.range}" data-action="chartRange" data-range="${r[0]}">${r[1]}</button>`).join('')}</div><div class="chart-body" data-id="${e(id)}">${chartBody(id)}</div></section>`;
};
api.setRange=(card,r)=>{
  api.range=r;
  const seg=card.querySelector('.segmented'),body=card.querySelector('.chart-body');
  seg.style.setProperty('--i',RANGES.findIndex(x=>x[0]===r));
  seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.range===r));
  api.fresh=true;body.innerHTML=chartBody(body.dataset.id);api.fresh=false;
};
function pick(ch,ev){
  const body=ch.closest('.chart-body'),c=api.charts.get(body.dataset.id),pts=inRange(c.pts,api.range).slice(-30),g=geometry(pts);
  const r=ch.querySelector('svg').getBoundingClientRect();
  const i=Math.max(0,Math.min(pts.length-1,Math.floor((ev.clientX-r.left)/r.width*W/g.slot))),p=pts[i];
  ch.querySelectorAll('.ic-bar').forEach((b,k)=>b.classList.toggle('sel',k===i));
  const rule=ch.querySelector('.ic-rule');rule.setAttribute('x1',g.cx(i));rule.setAttribute('x2',g.cx(i));
  body.querySelector('[data-ic-val]').innerHTML=`${e(num(p.v))}<small>${e(c.unit)}</small>`;
  body.querySelector('[data-ic-sub]').textContent=p.sub;
  const co=ch.querySelector('.chart-callout');
  co.style.left=Math.min(84,Math.max(16,g.cx(i)/W*100))+'%';co.style.top=g.y(p.v)/H*100+'%';
  co.firstChild.textContent=`${num(p.v)} ${c.unit}`;co.lastChild.textContent=p.label;
}
document.addEventListener('pointerdown',ev=>{
  const ch=ev.target.closest('.ios-chart');if(!ch)return;
  ch._down=true;ch.classList.add('scrub');ch.setPointerCapture(ev.pointerId);pick(ch,ev);
});
document.addEventListener('pointermove',ev=>{const ch=ev.target.closest?.('.ios-chart');if(ch?._down)pick(ch,ev);});
['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,ev=>{const ch=ev.target.closest?.('.ios-chart');if(ch){ch._down=false;ch.classList.remove('scrub');}}));

return api;
})();
