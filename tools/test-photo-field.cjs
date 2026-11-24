const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/pages/index.astro'), 'utf8');
const controller = source.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];

function setup(length = 7, reduced = false) {
  const events = () => ({ handlers: new Map(), addEventListener(name, fn) { this.handlers.set(name, fn); } });
  const gallery = Array.from({ length }, (_, i) => ({ id: `photo-${i}`, src: `/images/${i}.jpeg`,
    width: 400, height: i === 8 ? 700 : 225, caption: `Caption ${i}`, alt: `Description ${i}`, date: i % 2 ? '' : '2026-05-06' }));
  const photos = gallery.slice(0, 7).map((photo, i) => ({
    ...events(), dataset: { index: String(i) }, offsetLeft: i * 100, offsetTop: i * 110,
    offsetWidth: 250, image: {}, attributes: {},
    style: { ratio: String(photo.width / photo.height), getPropertyValue() { return this.ratio; }, setProperty(_, v) { this.ratio = v; } },
    querySelector() { return this.image; }, matches() { return false; },
    setAttribute(name, value) { this.attributes[name] = value; }
  }));
  const caption = { replaceChildren(value) { this.textContent = value; this.date = null; }, append(value) { this.date = value; } };
  const count = {};
  const image = {};
  const close = events(), previous = events(), next = events(), browse = events();
  const dialog = { ...events(), open: false, showModal() { this.open = true; }, close() { this.open = false; this.handlers.get('close')(); },
    querySelector(selector) { return ({ '.viewer-image': image, '.caption': caption, '.count': count,
      '.viewer-close': close, '.previous': previous, '.next': next })[selector]; } };
  const motion = { ...events(), matches: reduced }, mobile = { ...events(), matches: false };
  const doc = { ...events(), hidden: false, querySelectorAll() { return []; },
    createTextNode(text) { return text; }, createElement() { return {}; },
    querySelector(selector) { return ({ '#gallery-data': { textContent: JSON.stringify(gallery) },
      '.photo-field': { querySelectorAll: () => photos }, '.viewer': dialog, '.browse': browse })[selector]; } };
  const globalEvents = new Map(), frames = new Map();
  let frameId = 0, time = 1000;
  const context = vm.createContext({ document: doc, innerHeight: 900, scrollY: 0, Intl,
    matchMedia: q => q.includes('max-width') ? mobile : motion,
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener(name, fn) { globalEvents.set(name, fn); },
    Image: class { set src(value) { this.onload(); } }
  });
  vm.runInContext(controller, context);
  function step() {
    const entry = frames.entries().next().value;
    if (!entry) return false;
    frames.delete(entry[0]); time += 16; entry[1](time);
    return true;
  }
  function seconds(n) { for (let i = 0; i < n * 63; i++) step(); }
  return { photos, gallery, motion, mobile, doc, frames, globalEvents, dialog, image, caption, count,
    browse, previous, next, step, seconds };
}

const page = setup();
page.seconds(1);
const before = page.photos[1].style.transform;
page.seconds(1);
assert.notEqual(page.photos[1].style.transform, before, 'Photos drift automatically');
page.photos[1].handlers.get('pointerenter')({ pointerType: 'mouse' });
const held = page.photos[1].style.transform;
page.seconds(1);
assert.equal(page.photos[1].style.transform, held, 'Hover holds the photograph still');
page.photos[1].handlers.get('pointerleave')();
page.photos[3].handlers.get('click')();
assert.equal(page.caption.textContent, 'Caption 3');
assert.equal(page.count.textContent, '4 of 7');
assert.equal(page.dialog.open, true);
const inspected = page.photos[1].style.transform;
page.seconds(1);
assert.equal(page.photos[1].style.transform, inspected, 'Inspection pauses the field');
page.next.handlers.get('click')();
assert.equal(page.caption.textContent, 'Caption 4');
assert.equal(page.caption.date.dateTime, '2026-05-06');
page.dialog.close();
page.seconds(1);
assert.notEqual(page.photos[1].style.transform, inspected, 'Closing detail resumes the field');
page.browse.handlers.get('click')();
page.previous.handlers.get('click')();
assert.equal(page.count.textContent, '7 of 7', 'Previous wraps to the final photo');
page.dialog.close();

page.motion.matches = true;
page.motion.handlers.get('change')();
assert.equal(page.frames.size, 0, 'Reduced motion cancels autoplay');
page.motion.matches = false;
page.motion.handlers.get('change')();
assert.equal(page.frames.size, 1);
page.doc.hidden = true;
page.doc.handlers.get('visibilitychange')();
assert.equal(page.frames.size, 0, 'Hidden documents cancel autoplay');

const mobile = setup(10);
mobile.mobile.matches = true;
mobile.mobile.handlers.get('change')();
mobile.seconds(17);
assert(mobile.photos.some(p => p.dataset.index === '7'), 'Extra photos enter the field on mobile');
mobile.seconds(17);
assert(mobile.photos.some(p => p.dataset.index === '8'), 'Later portrait photos also enter the field');
assert.equal(new Set(mobile.photos.map(p => p.dataset.index)).size, 7, 'Visible slots never duplicate photos');
const swapped = mobile.photos.find(p => p.dataset.index === '8');
swapped.handlers.get('click')();
assert.equal(mobile.caption.textContent, 'Caption 8', 'Clicking a replaced image uses its own caption');
assert.equal(mobile.image.height, 700);

const empty = setup(0);
assert.equal(empty.frames.size, 0, 'Empty galleries do not start the animation');
const single = setup(1);
single.browse.handlers.get('click')();
single.next.handlers.get('click')();
assert.equal(single.count.textContent, '1 of 1');
console.log('Passed drift, hover, viewer, captions, dates, wrapping, reduced motion, visibility, extra-photo rotation, portrait, empty, and single-photo checks.');
