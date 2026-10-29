(() => {
 'use strict';
 const host=document.querySelector('[data-map]'); if(!host) return;
 const data=window.HG_MAPAS?.[host.dataset.map]; if(!data) return;
 const viewport=host.querySelector('.hg-viewport'),stage=host.querySelector('.hg-stage');
 const layer=document.createElement('div');layer.className='hg-markers';viewport.append(layer);
 const tip=host.querySelector('.hg-tooltip'),empty=host.querySelector('.hg-empty'),chosen=host.querySelector('.hg-chosen');
 const name=host.querySelector('.hg-selected-name'),open=host.querySelector('.hg-open');
 const coarse=matchMedia('(pointer:coarse)'),compact=matchMedia('(max-width:768px)');
 viewport.style.aspectRatio=`${data.width} / ${data.height}`;
 let scale=1,x=0,y=0,selected=null,hovered=null,lastPointer='mouse',moved=false,suppressUntil=0;
 let pointers=new Map(),gesture=null,frame=0;
 const maxScale=8;
 const svg='<svg viewBox="0 0 26 36" aria-hidden="true"><path d="M13 35S1 20 1 13a12 12 0 0 1 24 0c0 7-12 22-12 22Z" fill="currentColor" stroke="white" stroke-width="2"/><circle cx="13" cy="13" r="4" fill="white"/></svg>';
 function point(p){return {x:x+p.x/100*viewport.clientWidth*scale,y:y+p.y/100*viewport.clientHeight*scale};}
 function clear(){selected=null;chosen.hidden=true;empty.hidden=false;tip.hidden=true;hovered=null;render();}
 function select(p){selected=p;name.textContent=p.name;open.href=p.href;empty.hidden=true;chosen.hidden=false;render();if(compact.matches)chosen.scrollIntoView({block:'nearest'});}
 function tooltip(p,el){
  if(!p||!el){tip.hidden=true;return;}
  tip.textContent=p.name;tip.hidden=false;
  const a=el.getBoundingClientRect(),b=viewport.getBoundingClientRect();
  const left=Math.max(8,Math.min(b.width-tip.offsetWidth-8,a.left-b.left+a.width/2-tip.offsetWidth/2));
  let top=a.top-b.top-tip.offsetHeight-5;if(top<6)top=a.bottom-b.top+6;
  tip.style.left=left+'px';tip.style.top=Math.min(b.height-tip.offsetHeight-6,Math.max(6,top))+'px';
 }
 function cluster(points){
  const distance=(coarse.matches||compact.matches)?58:42,groups=[];
  for(const p of points){
   const at=point(p);if(at.x< -45||at.x>viewport.clientWidth+45||at.y< -45||at.y>viewport.clientHeight+45)continue;
   let g=groups.find(g=>g.members.every(q=>{const b=point(q);return Math.hypot(at.x-b.x,at.y-b.y)<distance;}));
   if(g)g.members.push(p);else groups.push({members:[p]});
  }
  return groups;
 }
 function render(){
  const activeId=document.activeElement?.dataset?.marker;
  x=Math.max(viewport.clientWidth*(1-scale),Math.min(0,x));y=Math.max(viewport.clientHeight*(1-scale),Math.min(0,y));
  stage.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
  layer.replaceChildren();
  for(const g of cluster(data.markers)){
   const members=g.members,p=members[0],isCluster=members.length>1;
   const avg={x:members.reduce((a,b)=>a+b.x,0)/members.length,y:members.reduce((a,b)=>a+b.y,0)/members.length};
   const pos=point(avg),el=document.createElement(isCluster?'button':'a');
   el.className='hg-marker'+(isCluster?' hg-cluster':'');el.style.left=pos.x+'px';el.style.top=pos.y+'px';
   if(isCluster){
    el.type='button';el.textContent=members.length;el.setAttribute('aria-label',`Ampliar grupo de ${members.length} pins`);
    el.addEventListener('click',e=>{e.preventDefault();if(performance.now()<suppressUntil)return; zoom(Math.min(maxScale,scale*1.8),pos.x,pos.y,true);});
   }else{
    el.href=p.href;el.innerHTML=svg;el.setAttribute('aria-label',p.name);el.dataset.marker=p.id;
    if(selected?.id===p.id)el.setAttribute('aria-current','true');
    el.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!compact.matches&&!gesture){hovered=p;tooltip(p,el);}});
    el.addEventListener('pointerleave',()=>{hovered=null;tip.hidden=true;});
    el.addEventListener('focus',()=>{if(!compact.matches&&!coarse.matches)tooltip(p,el);});el.addEventListener('blur',()=>{tip.hidden=true;});
    el.addEventListener('click',e=>{
     if(performance.now()<suppressUntil){e.preventDefault();return;}
     if(lastPointer==='touch'||lastPointer==='pen'||(e.detail!==0&&(coarse.matches||compact.matches))){e.preventDefault();select(p);tip.hidden=true;}
    });
   }
   layer.append(el);
  }
  host.querySelector('.hg-scale').value=Math.round(scale*100)+'%';
  host.querySelector('[data-zoom="out"]').disabled=scale<=1;
  host.querySelector('[data-zoom="in"]').disabled=scale>=maxScale;
  if(activeId){const same=Array.from(layer.children).find(a=>a.dataset.marker===activeId);same?.focus({preventScroll:true});}
  if(hovered){const same=Array.from(layer.children).find(a=>a.dataset.marker===hovered.id);tooltip(hovered,same);}
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});}
 function zoom(next,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2,center=false){
  next=Math.max(1,Math.min(maxScale,next));const ratio=next/scale;
  x=(center?viewport.clientWidth/2:cx)-(cx-x)*ratio;y=(center?viewport.clientHeight/2:cy)-(cy-y)*ratio;scale=next;hovered=null;tip.hidden=true;render();
 }
 host.querySelector('[data-zoom="in"]').onclick=()=>zoom(scale*1.5);
 host.querySelector('[data-zoom="out"]').onclick=()=>zoom(scale/1.5);
 host.querySelector('[data-zoom="reset"]').onclick=()=>{scale=1;x=y=0;clear();};
 host.querySelector('.hg-dismiss').onclick=()=>{clear();viewport.focus({preventScroll:true});};
 function position(e){const b=viewport.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top};}
 function startGesture(){
  const all=[...pointers.values()];if(!all.length){gesture=null;return;}
  const a=all[0],b=all[1];gesture={x,y,scale,start:a,center:b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a,distance:b?Math.hypot(a.x-b.x,a.y-b.y):0};
 }
 viewport.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;lastPointer=e.pointerType;pointers.set(e.pointerId,position(e));moved=false;startGesture();
 });
 viewport.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;
  pointers.set(e.pointerId,position(e));const all=[...pointers.values()],a=all[0],b=all[1];
  if(b&&gesture.distance){
   const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};const next=Math.max(1,Math.min(maxScale,gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance));
   x=center.x-(gesture.center.x-gesture.x)*next/gesture.scale;y=center.y-(gesture.center.y-gesture.y)*next/gesture.scale;scale=next;moved=true;
  }else{
   const dx=a.x-gesture.start.x,dy=a.y-gesture.start.y;
   if(Math.hypot(dx,dy)>6)moved=true;if(moved){x=gesture.x+dx;y=gesture.y+dy;}
  }
  if(moved){viewport.setPointerCapture(e.pointerId);viewport.classList.add('is-dragging');hovered=null;tip.hidden=true;suppressUntil=performance.now()+400;schedule();}
 });
 function end(e){
  if(!pointers.has(e.pointerId))return;
  pointers.delete(e.pointerId);if(moved)suppressUntil=performance.now()+400;
  if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);
  viewport.classList.remove('is-dragging');startGesture();
 }
 window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
 viewport.addEventListener('click',e=>{if(performance.now()<suppressUntil)return;if(!e.target.closest('.hg-marker'))clear();});
 viewport.addEventListener('keydown',e=>{
  if(e.key==='Escape'){clear();viewport.focus();e.preventDefault();return;}
  if(e.target!==viewport)return;
  if(e.key==='+'||e.key==='='){zoom(scale*1.5);e.preventDefault();}
  else if(e.key==='-'){zoom(scale/1.5);e.preventDefault();}
  else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
   e.preventDefault();if(e.key==='ArrowLeft')x+=60;if(e.key==='ArrowRight')x-=60;if(e.key==='ArrowUp')y+=60;if(e.key==='ArrowDown')y-=60;render();
  }
 });
 // Page scrolling stays natural. Ctrl + wheel provides optional desktop map zoom.
 viewport.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();const p=position(e);zoom(scale*(e.deltaY<0?1.15:1/1.15),p.x,p.y);},{passive:false});
 new ResizeObserver(()=>{scale=1;x=y=0;render();}).observe(viewport);
 render();
})();
