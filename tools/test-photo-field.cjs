const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../src/scripts/photo-physics.js'), 'utf8');
const { PhotoWorld, photoSize } = new Function(code + '; return { PhotoWorld, photoSize };')();
const gallery = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/gallery.json'), 'utf8'));
let checkedFrames = 0;

for (const [width, height, count] of [[1440,900,7], [990,852,7], [494,852,5], [390,844,5], [390,844,7], [1920,1080,7]]) {
  const zone = { left:Math.max(25,width/2-280), right:Math.min(width-25,width/2+280), top:height*.3, bottom:height*.64 };
  const sizes = Array.from({length:count},(_,i)=>photoSize(gallery[i%gallery.length],i,width,height,count));
  const world = new PhotoWorld({width,height,sizes,zones:[zone],seed:123});
  let cursor = count, replacements = 0, minVisible = count, maxGray = 0, maxLeap = 0, samplesMoving = 0, leapEvent;
  let lastSample = world.bodies.map(b=>({x:b.x,y:b.y}));
  for (let n=0;n<60*180;n++) {
    if (n%37===0) world.impulse(n%74===0 ? 100000 : -100000);
    if (n%180===0) world.setZones([{...zone,top:n%360===0?height*.3:height*.15,bottom:n%360===0?height*.64:height*.7}]);
    const oldTime=world.time, before=world.bodies.map(b=>({...b}));
    world.step(1/60);
    assert(world.time>=oldTime, 'Scroll reversal never reverses lifetime timers');
    for (const body of world.bodies) {
      assert(Number.isFinite(body.x)&&Number.isFinite(body.y)&&Number.isFinite(body.vx)&&Number.isFinite(body.vy));
      maxGray=Math.max(maxGray,body.grayFor);
      const prior=before[body.id];
      if (body.state==='active'&&prior.state==='active') { const move=Math.hypot(body.x-prior.x,body.y-prior.y); if(move>maxLeap){maxLeap=move;leapEvent={n,id:body.id,from:[prior.x,prior.y],to:[body.x,body.y],states:world.bodies.map(b=>({id:b.id,state:b.state,x:b.x,y:b.y,w:b.w,h:b.h}))};} }
      if (prior.state==='active'&&body.state==='leaving') assert(body.visibleFor>9||body.grayFor>3.2, 'Clear photos have a minimum lifetime; dimmed photos have a separate timeout');
      if (body.state==='exited') {
        assert(body.x+body.w<-32||body.x>width+32||body.y+body.h<-32||body.y>height+32, 'A photo is replaced only after it is completely offscreen');
        world.respawn(body.id,photoSize(gallery[cursor++%gallery.length],body.id,width,height,count));
        replacements++;
      }
    }
    minVisible=Math.min(minVisible,world.visibleCount());
    for (let i=0;i<count;i++) for(let j=i+1;j<count;j++) {
      const a=world.bodies[i],b=world.bodies[j];
      if(a.state==='exited'||b.state==='exited')continue;
      const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
      const oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
      assert(ox<=0||oy<=0, `Photos overlap at ${width}x${height}, frame ${n}`);
    }
    if(n>0&&n%120===0) {
      const moved=world.bodies.filter(b=>world.visibleFraction(b)>.18&&Math.hypot(b.x-lastSample[b.id].x,b.y-lastSample[b.id].y)>6).length;
      if(moved>=2)samplesMoving++;
      lastSample=world.bodies.map(b=>({x:b.x,y:b.y}));
    }
    checkedFrames++;
  }
  assert(minVisible>=world.minimumVisible,'The field maintains its visible-photo budget');
  assert(replacements>=10,'The full gallery keeps rotating');
  if(maxGray>=12) console.log({width,height,maxGray,maxLeap,replacements,states:world.bodies.map(b=>({id:b.id,state:b.state,gray:b.grayFor,x:b.x,y:b.y}))});
  assert(maxGray<12,'Photos do not remain gray indefinitely');
  if(maxLeap>=24) console.log(JSON.stringify({width,height,maxLeap,leapEvent},null,2));
  assert(maxLeap<24,'Fast scrolling does not teleport visible photos');
  assert(samplesMoving>=70,'Multiple visible photographs keep moving noticeably');
  console.log(`${width}x${height}: no overlaps; at least ${minVisible} visible; ${replacements} offscreen replacements; longest gray episode ${maxGray.toFixed(1)}s; largest active-frame move ${maxLeap.toFixed(1)}px`);
}
const size=photoSize(gallery[0],0,390,844,1);
const single=new PhotoWorld({width:390,height:844,sizes:[size]});
for(let i=0;i<1000;i++){single.impulse(i%2?99999:-99999);single.step(1/60);assert(single.visibleCount()===1);}
const empty=new PhotoWorld({width:390,height:844,sizes:[]});empty.step(1/60);assert.equal(empty.visibleCount(),0);
const held=new PhotoWorld({width:1440,height:900,sizes:gallery.slice(0,7).map((p,i)=>photoSize(p,i,1440,900,7))});
held.bodies[0].held=true;const start=held.bodies.map(b=>({x:b.x,y:b.y}));
for(let i=0;i<120;i++)held.step(1/60);
assert.equal(held.bodies[0].x,start[0].x);assert.equal(held.bodies[0].y,start[0].y);
assert(held.bodies.slice(1).some(b=>Math.hypot(b.x-start[b.id].x,b.y-start[b.id].y)>8),'Hover holds one photo rather than freezing the field');
held.bodies[0].holdUntil=held.time+.8;
for(let i=0;i<120;i++)held.step(1/60);
assert.equal(held.bodies[0].held,false,'Pointer hover expires so a parked cursor cannot freeze a gray photo forever');
console.log(`Passed ${checkedFrames.toLocaleString()} stress frames, lifetime, minimum-visibility, gray-timeout, single/empty gallery, and independent hover checks.`);
