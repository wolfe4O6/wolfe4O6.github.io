const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../src/scripts/photo-flow.js'), 'utf8');
const { PhotoFlow, photoSize } = new Function(code + '; return { PhotoFlow, photoSize };')();
const saved = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/gallery.json'), 'utf8'));
const gallery = [...saved, {width:100,height:1800}, {width:2400,height:100}];
let frames = 0;
for (const [width,height,count] of [[1440,900,10],[990,852,12],[494,852,10],[390,844,10],[320,568,10],[1920,1080,12]]) {
  const sizes = Array.from({length:count},(_,i)=>photoSize(gallery[i],i,width,height,count));
  const zone = {left:Math.max(25,width/2-280),right:Math.min(width-25,width/2+280),top:height*.3,bottom:height*.64};
  const flow = new PhotoFlow({width,height,sizes,zones:[zone]});
  let cursor=count, replacements=0, minVisible=count, largestMove=0, lateralDistance=0, minRecognizable=count;
  const waiting = new Map();
  for (let n=0;n<60*180;n++) {
    if (n%37===0) flow.impulse(n%74===0?100000:-100000);
    if (n%180===0) flow.setZones([{...zone,top:n%360===0?height*.3:height*.15,bottom:n%360===0?height*.64:height*.7}]);
    const before=flow.bodies.map(b=>({...b}));
    flow.step(1/60);
    for (const body of flow.bodies) {
      const prior=before[body.id];
      assert(Number.isFinite(body.x)&&Number.isFinite(body.y));
      assert(body.y<prior.y,'Every photograph always moves upward, including during reverse scrolling');
      assert(body.vy<0,'No bounces or downward velocity');
      const jump=Math.hypot(body.x-prior.x,body.y-prior.y);
      largestMove=Math.max(largestMove,jump);
      lateralDistance+=Math.abs(body.x-prior.x);
      if (body.state==='exited' && !waiting.has(body.id)) {
        assert(body.y+body.h < -48,'Replace only after leaving through the top');
        waiting.set(body.id,n+(replacements%5===0?90:0));
      }
      if (waiting.has(body.id)&&n>=waiting.get(body.id)) {
        flow.respawn(body.id,photoSize(gallery[cursor++%gallery.length],body.id,width,height,count));
        assert(body.y>=height+48,'Replacements always begin below the screen');
        waiting.delete(body.id);replacements++;
      }
    }
    minVisible=Math.min(minVisible,flow.visibleCount());
    minRecognizable=Math.min(minRecognizable,flow.bodies.filter(b=>b.state!=='exited'&&flow.visibleFraction(b)>.35&&b.fade*(1-b.gray*.76)>.5).length);
    for (let i=0;i<count;i++) for(let j=i+1;j<count;j++) {
      const a=flow.bodies[i],b=flow.bodies[j];
      const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
      const oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
      assert(ox<=0||oy<=0,`Photos overlap at ${width}x${height}, frame ${n}`);
    }
    frames++;
  }
  assert(minVisible>=4,'The denser field keeps at least four photos visible through scrolling, fades, and image loads');
  if (width>=390 && width<700) assert(minRecognizable>=2,'Multiple phone photographs stay recognizable outside the reading zones');
  assert(replacements>=10,'The full gallery keeps rotating');
  assert(largestMove<1.3,'Scrolling cannot teleport photographs');
  assert(lateralDistance>1000,'Side-to-side sway remains noticeable');
  console.log(`${width}x${height}: upward only, no overlaps, at least ${minVisible} visible, ${minRecognizable} recognizable, ${replacements} replacements, max step ${largestMove.toFixed(2)}px`);
}
for (const count of [0,1,2]) {
  const flow=new PhotoFlow({width:390,height:844,sizes:gallery.slice(0,count).map((p,i)=>photoSize(p,i,390,844,count))});
  for (let n=0;n<6000;n++) {flow.step(1/60);for(const b of flow.bodies)if(b.state==='exited')flow.respawn(b.id,{w:b.w,h:b.h});}
  assert.equal(flow.bodies.length,count);
}
console.log(`Passed ${frames.toLocaleString()} flow frames plus small/empty galleries.`);
