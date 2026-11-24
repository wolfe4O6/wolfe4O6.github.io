const photoClamp = (value, low, high) => Math.max(low, Math.min(high, value));

function photoSize(photo, index, width, height, count) {
  const phone=width<700, compact=phone && count>5 ? .77 : 1;
  const preferred=photoClamp(width*(phone ? .34+(index%3)*.025 : .19+(index%3)*.018),phone?110:165,phone?176:330)*compact;
  const maxHeight=Math.max(68,Math.min(phone?168:270,height*(phone?.20:.29)))*compact;
  const ratio=photo.width/photo.height;
  const w=Math.min(preferred,maxHeight*ratio);
  return {w,h:w/ratio};
}

class PhotoWorld {
  constructor({ width, height, sizes, zones = [], seed = 23917 }) {
    this.width = width; this.height = height; this.zones = zones;
    this.seed = seed; this.time = 0; this.boost = 0;
    this.gap = width < 700 ? 14 : 24;
    this.header = width < 700 ? 72 : 80;
    this.minimumVisible = Math.min(sizes.length, sizes.length < 3 ? 1 : width < 700 ? 3 : 4);
    const anchors = width < 700
      ? [[.27,.21],[.77,.24],[.16,.73],[.83,.76],[.48,.91],[.14,.43],[.86,.46]]
      : [[.48,.15],[.14,.57],[.12,.27],[.86,.24],[.88,.62],[.68,.87],[.19,.88]];
    this.bodies = sizes.map((size, id) => {
      const speed = (width < 700 ? 16 : 23) + this.random()*9;
      const angle = id*2.399 - .85;
      return { id, ...size, x:anchors[id][0]*width-size.w/2, y:anchors[id][1]*height-size.h/2,
        vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        dx:Math.cos(angle)*speed, dy:Math.sin(angle)*speed, speed,
        age:0, visibleFor:0, grayFor:0, gray:0,
        lifetime:24+id*3.1+this.random()*4, state:'active', held:false, exitTime:0 };
    });
    this.settle(60);
  }
  random() {
    this.seed = (1664525*this.seed+1013904223) >>> 0;
    return this.seed/4294967296;
  }
  visibleFraction(body) {
    const w = Math.max(0,Math.min(this.width,body.x+body.w)-Math.max(0,body.x));
    const h = Math.max(0,Math.min(this.height,body.y+body.h)-Math.max(this.header,body.y));
    return w*h/(body.w*body.h);
  }
  visibleCount() {
    return this.bodies.filter(b => b.state !== 'exited' && this.visibleFraction(b) > .18).length;
  }
  impulse(pixels) {
    if (Number.isFinite(pixels)) this.boost = photoClamp(this.boost + photoClamp(pixels,-180,180)*.12,-52,52);
  }
  setZones(zones) { this.zones = zones; }
  resize(width, height, sizes) {
    const rx = width/this.width, ry = height/this.height;
    this.width = width; this.height = height;
    this.gap = width < 700 ? 14 : 24; this.header = width < 700 ? 72 : 80;
    this.bodies.forEach((body,i) => {
      body.x = (body.x+body.w/2)*rx-sizes[i].w/2;
      body.y = (body.y+body.h/2)*ry-sizes[i].h/2;
      body.w=sizes[i].w; body.h=sizes[i].h;
    });
    this.settle(60);
  }
  constrain(body) {
    if (body.state !== 'active') return;
    const minX=-body.w*.12, maxX=this.width-body.w*.88;
    const minY=this.header-body.h*.12, maxY=this.height-body.h*.86-12;
    // Reflect velocity at the soft walls; never snap a partially visible
    // photograph inward. Positional clipping would also shove its neighbors.
    if (body.x < minX) { body.vx=Math.max(12,Math.abs(body.vx)); body.dx=Math.max(12,Math.abs(body.dx)); }
    if (body.x > maxX) { body.vx=-Math.max(12,Math.abs(body.vx)); body.dx=-Math.max(12,Math.abs(body.dx)); }
    if (body.y < minY) { body.vy=Math.max(12,Math.abs(body.vy)); body.dy=Math.max(12,Math.abs(body.dy)); }
    if (body.y > maxY) { body.vy=-Math.max(12,Math.abs(body.vy)); body.dy=-Math.max(12,Math.abs(body.dy)); }
  }
  settle(passes = 20) {
    for (let pass=0; pass<passes; pass++) {
      let collisions=0;
      this.bodies.forEach(b => this.constrain(b));
      for (let i=0; i<this.bodies.length; i++) for (let j=i+1; j<this.bodies.length; j++) {
        const a=this.bodies[i], b=this.bodies[j];
        if (a.state==='exited' || b.state==='exited') continue;
        const cx=b.x+b.w/2-a.x-a.w/2, cy=b.y+b.h/2-a.y-a.h/2;
        const ox=(a.w+b.w)/2+this.gap-Math.abs(cx), oy=(a.h+b.h)/2+this.gap-Math.abs(cy);
        if (ox<=0 || oy<=0) continue;
        collisions++;
        const nx=ox<oy ? (cx>=0?1:-1) : 0, ny=ox<oy ? 0 : (cy>=0?1:-1);
        const mass=body=>body.held?0:body.state==='entering'?.25:body.state==='leaving'?.5:1;
        const ia=mass(a), ib=mass(b), sum=ia+ib;
        if (!sum) continue;
        const distance=(Math.min(ox,oy)+.05)/sum;
        a.x-=nx*distance*ia; a.y-=ny*distance*ia;
        b.x+=nx*distance*ib; b.y+=ny*distance*ib;
        const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if (relative<0) {
          const kick=-(1.65*relative)/sum;
          a.vx-=kick*nx*ia; a.vy-=kick*ny*ia;
          b.vx+=kick*nx*ib; b.vy+=kick*ny*ib;
          for (const body of [a,b]) {
            const length=Math.hypot(body.vx,body.vy)||1;
            body.dx=body.vx/length*body.speed; body.dy=body.vy/length*body.speed;
          }
        }
      }
      if (!collisions) break;
    }
  }
  textPressure(body) {
    let gray=0, fx=0, fy=0, escape={x:0,y:0};
    for (const zone of this.zones) {
      if (zone.bottom<0 || zone.top>this.height) continue;
      const cx=body.x+body.w/2-(zone.left+zone.right)/2;
      const cy=body.y+body.h/2-(zone.top+zone.bottom)/2;
      const ox=(body.w+zone.right-zone.left)/2+18-Math.abs(cx);
      const oy=(body.h+zone.bottom-zone.top)/2+18-Math.abs(cy);
      if (ox<=0 || oy<=0) continue;
      const nx=ox<oy ? (cx>=0?1:-1) : 0, ny=ox<oy ? 0 : (cy>=0?1:-1);
      const amount=Math.min(ox,oy);
      const strength=photoClamp(amount/45,0,2)*24;
      fx+=nx*strength; fy+=ny*strength;
      const shade=photoClamp(amount/55,0,1);
      if (shade>gray) { gray=shade; escape={x:nx,y:ny}; }
    }
    return { gray, fx, fy, escape };
  }
  chooseExit(body) {
    const candidates=[{x:-1,y:0,d:body.x+body.w},{x:1,y:0,d:this.width-body.x},
      {x:0,y:-1,d:body.y+body.h},{x:0,y:1,d:this.height-body.y}];
    candidates.forEach(c => {
      c.d += this.bodies.filter(other => other!==body && other.state==='active' &&
        ((c.x<0&&other.x<body.x)||(c.x>0&&other.x>body.x)||(c.y<0&&other.y<body.y)||(c.y>0&&other.y>body.y))).length*50;
    });
    return candidates.sort((a,b)=>a.d-b.d)[0];
  }
  substep(dt) {
    this.time+=dt; this.boost*=Math.exp(-dt*2.5);
    let busy=this.bodies.filter(b=>b.state!=='active').length;
    const departures=Math.max(0,this.bodies.length-this.minimumVisible);
    for (const body of this.bodies) {
      if (body.state==='exited') continue;
      if (body.held && body.holdUntil!==undefined && this.time>=body.holdUntil) body.held=false;
      body.age+=dt;
      if (this.visibleFraction(body)>.2) body.visibleFor+=dt;
      const pressure=this.textPressure(body);
      body.gray+=(pressure.gray-body.gray)*Math.min(1,dt*5);
      body.grayFor=body.gray>.5 ? body.grayFor+dt : 0;
      if (body.held) { body.vx=0; body.vy=0; continue; }
      if (body.state==='active' && busy<departures && this.bodies.length>1 && (body.visibleFor>9 || body.grayFor>3.2) &&
          (body.age>body.lifetime || body.grayFor>3.2) && this.visibleCount()>this.minimumVisible) {
        body.state='leaving'; body.exit=this.chooseExit(body); body.exitTime=0; busy++;
      }
      let ax=pressure.fx, ay=pressure.fy;
      if (body.grayFor>2.4 && body.state!=='entering') {
        ax+=pressure.escape.x*75; ay+=pressure.escape.y*75;
        body.dx=pressure.escape.x*body.speed; body.dy=pressure.escape.y*body.speed;
      }
      if (body.state==='leaving') {
        body.exitTime+=dt;
        const speed=this.width<700 ? 62 : 95;
        const exitX=body.exit.x || (body.x+body.w/2<this.width/2?-.6:.6);
        const exitY=body.exit.y || (body.y+body.h/2<this.height/2?-.6:.6);
        ax=(exitX*speed-body.vx)*3;
        ay=(exitY*speed-body.vy)*3;
      } else if (body.state==='entering') {
        body.entryTime+=dt;
        const targetX=photoClamp(body.x,-body.w*.12+8,this.width-body.w*.88-8);
        const targetY=photoClamp(body.y,this.header-body.h*.12+8,this.height-body.h*.86-20);
        const length=Math.hypot(targetX-body.x,targetY-body.y)||1;
        ax=pressure.fx*.3+((targetX-body.x)/length*48-body.vx)*3;
        ay=pressure.fy*.3+((targetY-body.y)/length*48-body.vy)*3;
        if (this.visibleFraction(body)>.65) body.state='active';
        else if (body.entryTime>12 && this.visibleFraction(body)<.02) {
          this.respawn(body.id,{w:body.w,h:body.h}); continue;
        }
      } else {
        ax+=(body.dx-body.vx)*.8;
        ay+=(body.dy-this.boost-body.vy)*.8;
      }
      body.vx+=ax*dt; body.vy+=ay*dt;
      const maximum=this.width<700 ? 74 : 110, speed=Math.hypot(body.vx,body.vy);
      if (speed>maximum) { body.vx*=maximum/speed; body.vy*=maximum/speed; }
      body.x+=body.vx*dt; body.y+=body.vy*dt;
    }
    this.settle(24);
    for (const body of this.bodies) {
      if (body.state==='leaving' && (body.x+body.w<-32 || body.x>this.width+32 || body.y+body.h<-32 || body.y>this.height+32)) {
        body.state='exited'; body.gray=0; body.grayFor=0;
      }
    }
  }
  step(seconds) {
    let remaining=photoClamp(seconds,0,.05);
    while (remaining>1e-7) { const dt=Math.min(1/120,remaining); this.substep(dt); remaining-=dt; }
  }
  respawn(id, size) {
    const body=this.bodies[id];
    body.w=size.w; body.h=size.h;
    const candidates=[];
    for (let n=0;n<9;n++) {
      const t=.1+n*.1;
      candidates.push({x:-body.w-36,y:t*(this.height-body.h),vx:48,vy:(this.random()-.5)*18},
        {x:this.width+36,y:t*(this.height-body.h),vx:-48,vy:(this.random()-.5)*18},
        {x:t*(this.width-body.w),y:this.height+36,vx:(this.random()-.5)*18,vy:-48});
    }
    candidates.forEach(c => {
      const target={...body,x:c.x+c.vx*2,y:c.y+c.vy*2};
      c.score=this.textPressure(target).gray*60;
      this.bodies.forEach(other => {
        if (other===body || other.state==='exited') return;
        const dx=Math.max(0,Math.max(other.x-target.x-target.w,target.x-other.x-other.w));
        const dy=Math.max(0,Math.max(other.y-target.y-target.h,target.y-other.y-other.h));
        c.score+=120/(Math.hypot(dx,dy)+12);
      });
      c.score+=this.random()*3;
    });
    const chosen=candidates.sort((a,b)=>a.score-b.score)[0];
    Object.assign(body,chosen,{dx:chosen.vx*.5,dy:chosen.vy*.5,state:'entering',age:0,visibleFor:0,
      gray:0,grayFor:0,lifetime:28+this.random()*16,held:false,exitTime:0,
      entry:{x:chosen.vx,y:chosen.vy},entryTime:0});
    this.settle(20);
  }
}
