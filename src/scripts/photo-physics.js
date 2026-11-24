// Compatibility for local editor processes started before the upward-flow rename.
// The current homepage and editor import photo-flow.js directly.
const photoClamp = (value, low, high) => Math.max(low, Math.min(high, value));

function photoSize(photo, index, width, height, count) {
  const phone = width < 700, compact = phone && count > 5 ? .77 : 1;
  const preferred = photoClamp(width * (phone ? .34 + (index % 3) * .025 : .19 + (index % 3) * .018), phone ? 110 : 165, phone ? 176 : 330) * compact;
  const maxHeight = Math.max(68, Math.min(phone ? 168 : 270, height * (phone ? .20 : .29))) * compact;
  const ratio = photo.width / photo.height;
  const w = Math.min(preferred, maxHeight * ratio);
  return { w, h: w / ratio };
}

// Spaced streams share an upward clock. Sideways sway stays inside each
// stream, so photographs never need collisions, wall bounces, or forces.
class PhotoFlow {
  constructor({ width, height, sizes, zones = [] }) {
    this.width = width; this.height = height; this.zones = zones;
    this.time = 0; this.boost = 0;
    this.bodies = sizes.map((size, id) => ({ id, ...size, gray: 0, grayFor: 0, fade: 1, retired: false, state: 'active' }));
    this.layout(sizes);
  }
  layout(sizes) {
    const phone = this.width < 700;
    this.header = phone ? 72 : 80;
    this.gap = phone ? 14 : 24;
    this.speed = phone ? 23 : 29;
    this.columns = Math.min(this.bodies.length, phone ? 2 : 3) || 1;
    this.laneWidth = this.width / this.columns;
    this.sway = Math.min(phone ? 18 : 32, this.laneWidth * .075);
    this.envelope = Math.max(68, Math.min(phone ? 168 : 270, this.height * (phone ? .20 : .29)));
    const rows = Math.ceil(this.bodies.length / this.columns);
    this.cycle = Math.max(this.height + this.envelope + 96, rows * (this.envelope + this.gap + 32));
    this.minimumVisible = Math.min(this.bodies.length, phone ? 3 : 4);
    this.bodies.forEach((body, i) => {
      const lane = i % this.columns;
      const laneCount = this.bodies.filter(other => other.id % this.columns === lane).length;
      const row = Math.floor(i / this.columns);
      this.fitSize(body, sizes[i]);
      // Offset the streams so arrivals and departures never happen together.
      body.centerY = ((row + .44 + lane * .29) / laneCount) * this.cycle - this.envelope / 2 - 48;
      body.state = 'active'; body.retired = false; body.fade = 1; body.grayFor = 0;
      this.position(body);
    });
  }
  fitSize(body, size) {
    const scale = Math.min(1, Math.max(12, this.laneWidth - this.gap - this.sway * 2) / size.w);
    body.w = size.w * scale; body.h = size.h * scale;
  }
  position(body) {
    const lane = body.id % this.columns;
    body.x = (lane + .5) * this.laneWidth - body.w / 2 + Math.sin(this.time * .22 + body.id * 1.8) * this.sway;
    body.y = body.centerY - body.h / 2;
    body.vx = Math.cos(this.time * .22 + body.id * 1.8) * this.sway * .22;
    body.vy = -Math.max(7, this.speed + this.boost);
  }
  resize(width, height, sizes) {
    this.width = width; this.height = height;
    this.layout(sizes);
  }
  setZones(zones) { this.zones = zones; }
  impulse(pixels) {
    if (Number.isFinite(pixels)) this.boost = photoClamp(this.boost + photoClamp(pixels, -180, 180) * .12, -16, 42);
  }
  visibleFraction(body) {
    const w = Math.max(0, Math.min(this.width, body.x + body.w) - Math.max(0, body.x));
    const h = Math.max(0, Math.min(this.height, body.y + body.h) - Math.max(this.header, body.y));
    return w * h / (body.w * body.h);
  }
  visibleCount() {
    return this.bodies.filter(body => body.state !== 'exited' && body.fade > .2 && this.visibleFraction(body) > .18).length;
  }
  textPressure(body) {
    let gray = 0;
    for (const zone of this.zones) {
      if (zone.bottom < 0 || zone.top > this.height) continue;
      const cx = body.x + body.w / 2 - (zone.left + zone.right) / 2;
      const cy = body.y + body.h / 2 - (zone.top + zone.bottom) / 2;
      const ox = (body.w + zone.right - zone.left) / 2 + 18 - Math.abs(cx);
      const oy = (body.h + zone.bottom - zone.top) / 2 + 18 - Math.abs(cy);
      if (ox > 0 && oy > 0) gray = Math.max(gray, photoClamp(Math.min(ox, oy) / 55, 0, 1));
    }
    return { gray };
  }
  step(seconds) {
    const dt = photoClamp(seconds, 0, .05);
    this.time += dt;
    this.boost *= Math.exp(-dt * 2.5);
    for (const body of this.bodies) {
      // Even a delayed image load keeps its reserved place in the stream.
      body.centerY -= Math.max(7, this.speed + this.boost) * dt;
      this.position(body);
      if (body.state === 'exited') continue;
      const gray = this.textPressure(body).gray;
      body.gray += (gray - body.gray) * Math.min(1, dt * 5);
      body.grayFor = body.gray > .5 ? body.grayFor + dt : 0;
      const residents = this.bodies.filter(other => !other.retired && other.state !== 'exited' && this.visibleFraction(other) > .18).length;
      if (body.grayFor > 3.2 && residents > this.minimumVisible) body.retired = true;
      if (body.retired) body.fade = Math.max(0, body.fade - dt / 1.2);
      if (body.y + body.h < -48) body.state = 'exited';
    }
  }
  respawn(id, size) {
    const body = this.bodies[id];
    this.fitSize(body, size);
    // A replacement always enters from below. If decoding took too long,
    // skip a circuit rather than flashing a new photograph into the viewport.
    do { body.centerY += this.cycle; } while (body.centerY - body.h / 2 < this.height + 48);
    Object.assign(body, { state: 'active', gray: 0, grayFor: 0, fade: 1, retired: false });
    this.position(body);
  }
}
