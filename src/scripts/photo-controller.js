(() => {
  const gallery=JSON.parse(document.querySelector('#gallery-data').textContent);
  if (!gallery.length) return;
  const field=document.querySelector('.photo-field');
  const allButtons=[...field.querySelectorAll('.float-photo')];
  const text=[...document.querySelectorAll('.reading-zone')];
  const footer=document.querySelector('.hero-footer');
  const browse=document.querySelector('.browse');
  const viewer=document.querySelector('.viewer');
  const viewerImage=viewer.querySelector('.viewer-image');
  const caption=viewer.querySelector('.caption');
  const count=viewer.querySelector('.count');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const assets=new Map(), pending=new Map();
  let world, buttons=[], cursor=0, frame=0, lastFrame=0, geometryDirty=true;
  let selected=0, inspection=false, closing=false, request=0, imageAnimation=null, origin=null;
  let lastScroll=scrollY, lastWheel=-1000;

  function asset(index) {
    if (assets.has(index)) return assets.get(index);
    // Keep decoded images separate from reusable field elements. Otherwise
    // changing a field element's src invalidates the old photo's ready cache.
    const image=new Image();
    const record={ready:false,failed:false,image};
    record.promise=new Promise((resolve,reject) => {
      const loaded=() => {
        const decoded=image.decode ? image.decode().catch(()=>{}) : Promise.resolve();
        decoded.then(()=>{record.ready=true;resolve(record);});
      };
      image.addEventListener('load',loaded,{once:true});
      image.addEventListener('error',()=>{record.failed=true;reject(new Error('Photo could not load.'));},{once:true});
      if (image.complete && image.naturalWidth) loaded();
    });
    record.promise.catch(()=>{});
    assets.set(index,record);
    image.src=gallery[index].src;
    return record;
  }
  // Keep the quiet seven-photo fallback, then fill the animated streams
  // with more distinct photographs when JavaScript is available.
  while (allButtons.length < Math.min(gallery.length, 12)) {
    const button=allButtons[0].cloneNode(true);
    button.hidden=true;
    bind(button,allButtons.length);
    field.append(button);
    allButtons.push(button);
  }
  allButtons.forEach(button=>asset(Number(button.dataset.index)));

  function prime() {
    const used=new Set(buttons.map(button=>Number(button.dataset.index)));
    let prepared=0;
    for (let i=0;i<gallery.length && prepared<3;i++) {
      const index=(cursor+i)%gallery.length;
      if (!used.has(index)) { asset(index); prepared++; }
    }
  }
  function bind(button,index) {
    const photo=gallery[index], image=button.querySelector('img');
    if (Number(button.dataset.index)!==index) image.src=photo.src;
    image.alt=photo.alt; image.width=photo.width; image.height=photo.height;
    button.dataset.index=String(index);
    button.setAttribute('aria-label','View photo: '+(photo.caption || photo.alt));
    button.setAttribute('aria-haspopup','dialog');
  }
  function dimensions() {
    const bounds=field.getBoundingClientRect();
    return {width:bounds.width,height:bounds.height};
  }
  function readGeometry() {
    if (!world) return;
    const rect=footer.getBoundingClientRect();
    const opacity=photoClamp((rect.top-world.header-20)/35,0,1);
    const zones=text.map(node=>node.getBoundingClientRect());
    if (opacity>.1 && rect.top<world.height) zones.push(browse.getBoundingClientRect());
    world.setZones(zones);
    footer.style.opacity=String(opacity);
    footer.style.visibility=opacity<.02?'hidden':'visible';
    browse.tabIndex=opacity<.02?-1:0;
    geometryDirty=false;
  }
  function size(index,slot) {
    const {width,height}=dimensions();
    return photoSize(gallery[index],slot,width,height,buttons.length);
  }
  function applySize(slot) {
    const body=world.bodies[slot], button=buttons[slot];
    button.style.width=body.w+'px'; button.style.height=body.h+'px';
  }
  function configure() {
    const {width,height}=dimensions();
    const desired=Math.min(allButtons.length,width<700?10:12);
    if (!world || desired!==buttons.length) {
      pending.clear(); buttons=allButtons.slice(0,desired);
      const used=new Set();
      buttons.forEach(button=>{
        let index=Number(button.dataset.index);
        if (used.has(index)) index=gallery.findIndex((_,i)=>!used.has(i));
        used.add(index); bind(button,index);
      });
      allButtons.forEach((button,i)=>{button.hidden=i>=desired;});
      world=new PhotoFlow({width,height,sizes:buttons.map((button,i)=>size(Number(button.dataset.index),i)),
        zones:text.map(node=>node.getBoundingClientRect())});
      cursor=desired%gallery.length;
    } else if (Math.abs(width-world.width)>1 || Math.abs(height-world.height)>1) {
      world.resize(width,height,buttons.map((button,i)=>size(Number(button.dataset.index),i)));
    }
    field.classList.add('is-moving');
    buttons.forEach((_,i)=>applySize(i));
    readGeometry();
    if (reduced.matches) world.bodies.forEach(body=>{body.gray=world.textPressure(body).gray;});
    render(); prime();
  }
  function replaceExited() {
    for (const body of world.bodies) {
      if (body.state!=='exited' || pending.has(body.id)) continue;
      const used=new Set(buttons.filter((_,i)=>i!==body.id).map(button=>Number(button.dataset.index)));
      pending.forEach(job=>used.add(job.index));
      let index=-1;
      for (let i=0;i<gallery.length;i++) {
        const candidate=(cursor+i)%gallery.length;
        if (!used.has(candidate) && !assets.get(candidate)?.failed) {index=candidate;break;}
      }
      if (index<0) index=Number(buttons[body.id].dataset.index);
      cursor=(index+1)%gallery.length;
      const job={index,world}; pending.set(body.id,job);
      asset(index).promise.then(()=>{
        if (pending.get(body.id)!==job || world!==job.world) return;
        bind(buttons[body.id],index);
        world.respawn(body.id,size(index,body.id));
        applySize(body.id); pending.delete(body.id); prime(); render();
      }).catch(()=>{if(pending.get(body.id)===job)pending.delete(body.id);});
    }
  }
  function render() {
    world.bodies.forEach(body=>{
      const button=buttons[body.id];
      button.style.transform=`translate3d(${body.x.toFixed(2)}px,${body.y.toFixed(2)}px,0)`;
      button.style.opacity=body.state==='exited'?'0':String((1-body.gray*.76)*body.fade);
      button.style.pointerEvents=body.fade<.05 || body.state==='exited'?'none':'';
      button.style.filter=body.gray>.015?`saturate(${1-body.gray*.8}) blur(${body.gray*2.5}px)`:'none';
    });
  }
  function tick(now) {
    const dt=lastFrame?Math.min((now-lastFrame)/1000,.05):0; lastFrame=now;
    if (geometryDirty) readGeometry();
    world.step(dt); replaceExited(); render();
    frame=requestAnimationFrame(tick);
  }
  function run() {
    cancelAnimationFrame(frame); lastFrame=0;
    if (!document.hidden && !reduced.matches && !inspection) frame=requestAnimationFrame(tick);
    else if (world) render();
  }
  function pictureAnimation(from,opening) {
    const current=getComputedStyle(viewerImage);
    const currentFrame={transform:current.transform,opacity:current.opacity};
    imageAnimation?.cancel();
    if (!viewerImage.animate) return Promise.resolve();
    const target=viewerImage.getBoundingClientRect();
    const transform=from && from.width>0 && from.height>0
      ? `translate(${from.left-target.left}px,${from.top-target.top}px) scale(${from.width/target.width},${from.height/target.height})`
      : 'scale(.94)';
    const full={transform:'none',opacity:1};
    const small=reduced.matches?{opacity:0}:{transform,opacity:from?1:0};
    viewerImage.style.willChange='transform';
    const animation=viewerImage.animate(opening?[small,full]:[currentFrame,small],{
      duration:reduced.matches?100:opening?520:280,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
    imageAnimation=animation;
    return animation.finished.catch(()=>{}).then(()=>{
      if (imageAnimation===animation) {animation.cancel();imageAnimation=null;viewerImage.style.willChange='auto';}
    });
  }
  async function showPhoto(index,button=null) {
    if (closing) return;
    index=((index%gallery.length)+gallery.length)%gallery.length;
    const ticket=++request, wasOpen=viewer.open, old=selected;
    selected=index;
    const from=button?.getBoundingClientRect();
    try { await asset(index).promise; } catch {
      if (request===ticket && viewer.open) {selected=old;caption.textContent='This photo could not load. Try another photo.';}
      return;
    }
    if (request!==ticket || closing) return;
    const photo=gallery[index];
    viewerImage.src=photo.src; viewerImage.alt=photo.alt;
    viewerImage.width=photo.width; viewerImage.height=photo.height;
    caption.replaceChildren(document.createTextNode(photo.caption || photo.alt));
    if (photo.date) {
      const date=document.createElement('time'); date.className='date'; date.dateTime=photo.date;
      date.textContent=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})
        .format(new Date(photo.date+'T00:00:00Z'));
      caption.append(date);
    }
    count.textContent=`${index+1} of ${gallery.length}`;
    if (!wasOpen) {
      inspection=true;run();origin=button;
      if (origin) origin.style.visibility='hidden';
      viewer.showModal();
      pictureAnimation(from,true);
    } else {
      if (origin) origin.style.visibility=''; origin=null;
      imageAnimation?.cancel();
      if (!reduced.matches && viewerImage.animate) viewerImage.animate([{opacity:.25},{opacity:1}],{duration:180});
    }
  }
  async function closeViewer() {
    if (!viewer.open || closing) return;
    closing=true;request++;
    viewer.classList.add('is-closing');
    const from=origin?.getBoundingClientRect();
    await pictureAnimation(from,false);
    viewer.close();
  }
  allButtons.forEach((button,slot)=>{
    button.addEventListener('click',()=>showPhoto(Number(button.dataset.index),button));
  });
  browse.addEventListener('click',()=>showPhoto(0));
  viewer.querySelector('.viewer-close').addEventListener('click',closeViewer);
  viewer.querySelector('.previous').addEventListener('click',()=>showPhoto(selected-1));
  viewer.querySelector('.next').addEventListener('click',()=>showPhoto(selected+1));
  viewer.addEventListener('cancel',event=>{event.preventDefault();closeViewer();});
  viewer.addEventListener('keydown',event=>{
    if (event.key==='ArrowRight'||event.key==='ArrowLeft') {event.preventDefault();showPhoto(selected+(event.key==='ArrowRight'?1:-1));}
  });
  viewer.addEventListener('click',event=>{if(event.target===viewer)closeViewer();});
  viewer.addEventListener('close',()=>{
    request++;closing=false;inspection=false;viewer.classList.remove('is-closing');
    if (origin) origin.style.visibility='';origin=null;
    geometryDirty=true;run();
  });
  addEventListener('scroll',()=>{
    const delta=scrollY-lastScroll;lastScroll=scrollY;geometryDirty=true;
    if (!inspection&&!reduced.matches&&performance.now()-lastWheel>100) world.impulse(delta);
    if (reduced.matches) {readGeometry();world.bodies.forEach(body=>{body.gray=world.textPressure(body).gray;});render();}
  },{passive:true});
  addEventListener('wheel',event=>{
    if (event.ctrlKey||inspection||reduced.matches) return;
    lastWheel=performance.now();
    world.impulse(event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?world.height:1));
  },{passive:true});
  addEventListener('resize',()=>{configure();geometryDirty=true;});
  reduced.addEventListener('change',()=>{configure();run();});
  document.addEventListener('visibilitychange',run);
  configure();run();
})();
