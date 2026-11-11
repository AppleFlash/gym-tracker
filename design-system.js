'use strict';
/* Design system runtime: push/pop transitions, edge swipe-back, sheets, alerts, iOS-style bar chart.
   Knows nothing about workouts: the app feeds it routes, html and data (see ds.swipe / ds.chartCard). */
const ds=(()=>{
const EASE='cubic-bezier(.32,.72,0,1)',DUR=400;
const $=s=>document.querySelector(s);
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api={fresh:false,scroll:new Map(),onDismiss:()=>{}};
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
  if(move){snap=layer(app);stack.append(snap);snap.scrollTop=app.scrollTop;const t=app.querySelector('.car-track'),c=snap.querySelector('.car-track');if(t&&c)c.scrollLeft=t.scrollLeft;}
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
  // Non-modal on purpose: a modal clone would make the page inert until it is gone, eating the next tap or focus.
  const dim=document.createElement('div');dim.className='sheet-dim closing';
  document.body.append(dim,c);c.show();
  const drop=()=>{if(c.isConnected){c.close();c.remove();dim.remove();}};
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
const TOGGLES='[role=switch],.check,.sp-cell,.ex[data-id]';
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

/* ---------- Trend chart: weight and reps of one representative set per workout ----------
   One card, two stacked panels on a shared date axis: weight on top (smooth line, translucent area, dots),
   reps below. Every value is printed next to its point, so nothing needs touch, hover or a colour legend.
   A single point is drawn alone, without an invented line. */
const W=340,PAD_X=22,r1=v=>Math.round(v*10)/10;
const num=v=>v.toLocaleString('ru-RU',{maximumFractionDigits:2});
let gradients=0;
// Fritsch–Carlson monotone cubic through the points: smooth, never overshooting a real value.
const smooth=P=>{
  const n=P.length;if(n<2)return'';
  const d=[],m=[];
  for(let i=0;i<n-1;i++)d.push((P[i+1][1]-P[i][1])/(P[i+1][0]-P[i][0]));
  m[0]=d[0];m[n-1]=d[n-2];
  for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
  for(let i=0;i<n-1;i++){
    if(!d[i]){m[i]=m[i+1]=0;continue;}
    const a=m[i]/d[i],b=m[i+1]/d[i],h=a*a+b*b;
    if(h>9){const t=3/Math.sqrt(h);m[i]=t*a*d[i];m[i+1]=t*b*d[i];}
  }
  let s=`M${r1(P[0][0])},${r1(P[0][1])}`;
  for(let i=0;i<n-1;i++){const dx=(P[i+1][0]-P[i][0])/3;s+=`C${r1(P[i][0]+dx)},${r1(P[i][1]+m[i]*dx)} ${r1(P[i+1][0]-dx)},${r1(P[i+1][1]-m[i+1]*dx)} ${r1(P[i+1][0])},${r1(P[i+1][1])}`;}
  return s;
};
const gradient=id=>`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ic-stop-top"/><stop offset="1" class="ic-stop-bottom"/></linearGradient></defs>`;
const lineAndArea=(P,base,gid)=>{const line=smooth(P);return line?`${gid?`<path class="ic-area" fill="url(#${gid})" d="${line}L${r1(P.at(-1)[0])},${base}L${r1(P[0][0])},${base}Z"/>`:''}<path class="ic-line" pathLength="1" d="${line}"/>`:'';};
// Values mapped into [top, bottom] with headroom; equal values sit in the middle.
const yScale=(vals,top,bottom)=>{const lo=Math.min(...vals),hi=Math.max(...vals);return v=>hi===lo?(top+bottom)/2:bottom-(v-lo)/(hi-lo)*(bottom-top);};
// Weight labels sit above their points, reps labels below, so neither collides with the panel title.
function panel(cls,title,P,values,fmt,top,bottom,gid,below,visible){
  let s=`<text class="ic-title" x="0" y="${top-30}">${e(title)}</text>`;
  s+=lineAndArea(P,bottom,gid);
  s+=P.map(([x,y],i)=>visible&&!visible.includes(i)?'':`<circle class="ic-dot ${cls}" style="--i:${visible?visible.indexOf(i):i}" cx="${r1(x)}" cy="${r1(y)}" r="${i===P.length-1?5:3.5}"/><text class="ic-value ${i===P.length-1?'last':''}" x="${r1(x)}" y="${r1(below?y+18:y-10)}" text-anchor="${visible&&P.length>1?(i===0?'start':i===P.length-1?'end':'middle'):'middle'}">${e(fmt(values[i]))}</text>`).join('');
  return `<g class="ic-panel ${cls}">${s}</g>`;
}
// points: [{label, weight, reps, date?}], oldest first; volume uses weight as total kg.
api.trendChart=(points,label,{volume=false}={})=>{
  const n=points.length;if(!n)return'';
  const x=i=>n>1?PAD_X+i*(W-2*PAD_X)/(n-1):W/2;
  const WT=44,WB=132,RT=186,RB=222,H=volume?172:262,gid=n>1?'ic-g'+(++gradients):null;
  const weights=points.map(p=>p.weight),wy=yScale(weights,WT,WB);
  const PW=points.map((p,i)=>[x(i),wy(p.weight)]);
  const all=points.map((_,i)=>i),edges=n>1?[0,n-1]:[0];
  // shortcut: estimate widths for the fixed SVG fonts; measure text if typography changes.
  const fits=(indices,text,charWidth)=>{
    let right=-Infinity;
    return indices.every(i=>{
      const width=text(i).length*charWidth,left=x(i)-(n>1&&i===0?0:n>1&&i===n-1?width:width/2);
      const clear=left>=right+8;right=left+width;return clear;
    });
  };
  let values=volume&&n>6?edges:all,dates=volume&&n>6?[0,Math.floor((n-1)/2),n-1]:all;
  if(volume&&!fits(values,i=>num(weights[i]),8))values=edges;
  if(volume&&!fits(dates,i=>points[i].label,6.5))dates=n>2?[0,Math.floor((n-1)/2),n-1]:edges;
  if(volume&&!fits(dates,i=>points[i].label,6.5))dates=edges;
  let s=gid?gradient(gid):'';
  s+=values.map(i=>`<line class="ic-guide" x1="${r1(x(i))}" x2="${r1(x(i))}" y1="${WT-6}" y2="${(volume?WB:RB)+6}"/>`).join('');
  s+=panel('w',volume?'Объём, кг':'Вес, кг',PW,weights,num,WT,WB,gid,false,volume?values:null);
  if(!volume){
    const reps=points.map(p=>p.reps),ry=yScale(reps,RT,RB),PR=points.map((p,i)=>[x(i),ry(p.reps)]);
    s+=panel('r','Повторения',PR,reps,v=>'×'+v,RT,RB,null,true);
  }
  s+=dates.map(i=>`<text class="ic-axis" x="${r1(x(i))}" y="${H-4}" text-anchor="${volume&&n>1?(i===0?'start':i===n-1?'end':'middle'):'middle'}">${e(points[i].label)}</text>`).join('');
  let run=0;
  const summary=points.map((p,i)=>{
    if(!volume)return`${p.label}: ${num(p.weight)} кг × ${p.reps}`;
    run=p.date&&p.date===points[i-1]?.date?run+1:1;
    const sameDay=p.date&&(p.date===points[i-1]?.date||p.date===points[i+1]?.date);
    return`${p.date||p.label}${sameDay?', занятие '+run:''}: ${num(p.weight)} кг`;
  }).join('; ');
  return`<div class="trend-chart ${api.fresh?'fresh':''}"><svg viewBox="0 -4 ${W} ${H+4}" role="img" aria-label="${e(label)}. ${e(summary)}">${s}</svg></div>`;
};
// Compact trend line for list rows: same curve and fill, no axes, last value marked.
api.sparkline=(values,label='')=>{
  const v=values.map(Number).filter(Number.isFinite).slice(-12);
  if(!v.length)return'<span class="sparkline empty" aria-hidden="true"></span>';
  const w=64,h=28,p=3,lo=Math.min(...v),hi=Math.max(...v),span=hi-lo||1,gid='ic-g'+(++gradients);
  const P=v.map((x,i)=>[v.length>1?p+i*(w-2*p)/(v.length-1):w/2,hi===lo?h/2:p+(h-2*p)*(1-(x-lo)/span)]),[lx,ly]=P.at(-1);
  return`<svg class="sparkline" viewBox="0 0 ${w} ${h}" ${label?`role="img" aria-label="${e(label)}"`:'aria-hidden="true"'}>${gradient(gid)}${lineAndArea(P,h,gid)}<circle class="ic-sel" cx="${r1(lx)}" cy="${r1(ly)}" r="2.6"/></svg>`;
};

return api;
})();
