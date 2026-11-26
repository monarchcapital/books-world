import * as THREE from './three.module.min.js';

const stops = [
  { id: 'hall', name: 'Grand Hall', position: [0, 1.65, 11.5], look: [0, 2.6, -6] },
  { id: 'west', name: 'West Stacks', position: [-2.25, 1.68, 4.4], look: [-4.85, 1.7, 4.4] },
  { id: 'east', name: 'East Gallery', position: [2.25, 1.68, -.3], look: [4.85, 1.7, -.3] },
  { id: 'archives', name: 'The Archives', position: [-2.25, 1.68, -5], look: [-4.85, 1.7, -5] },
  { id: 'desk', name: 'Reading Desk', position: [0, 1.65, -6.1], look: [0, 1.05, -8.7] }
];

const shelfAreas = {
  west: ['history', 'politics', 'philosophy', 'religion', 'biography', 'fiction', 'literature'],
  east: ['science', 'technology', 'economics', 'finance', 'business', 'psychology', 'self-help', 'health'],
  archives: ['reference', '']
};

const width = 3.8;
const vector = values => new THREE.Vector3(...values);
const easing = value => 1 - Math.pow(1 - value, 3);
const colours = [0x54332c, 0x3a4235, 0x704d37, 0x353b44, 0x613c29, 0x4e3543, 0x34302c, 0x6e5a3f];
const timber = new THREE.MeshStandardMaterial({ color: 0x513628, roughness: .81 });
const trim = new THREE.MeshStandardMaterial({ color: 0x79533a, roughness: .72 });
const brass = new THREE.MeshStandardMaterial({ color: 0xb58b52, metalness: .54, roughness: .52 });
const stone = new THREE.MeshStandardMaterial({ color: 0x776955, roughness: .98 });
const leather = new THREE.MeshStandardMaterial({ color: 0x354235, roughness: .93 });
const cream = new THREE.MeshStandardMaterial({ color: 0xe3cea3, roughness: 1 });

function panel(parent, material, dimensions, position) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function texture(base, grain, floor = false) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const context = canvas.getContext('2d');
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);
  let seed = 64415;
  const sample = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  context.strokeStyle = grain;
  for (let index = 0; index < 470; index++) {
    const x = sample() * 256;
    const y = sample() * 256;
    context.globalAlpha = .07 + sample() * .31;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + sample() * 3, y + 40, x - sample() * 2, y + 70, x, y + 110);
    context.stroke();
  }
  if (floor) {
    context.globalAlpha = .63;
    for (let line = 0; line < 256; line += 32) {
      context.fillStyle = grain;
      context.fillRect(line, 0, 1, 256);
      context.fillRect(line, line % 3 * 73, 32, 1);
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

function arch(parent, z, radius, spring, material) {
  const outline = new THREE.Shape();
  outline.moveTo(radius + .18, spring);
  outline.absarc(0, spring, radius + .18, 0, Math.PI, false);
  outline.lineTo(-radius, spring);
  outline.absarc(0, spring, radius, Math.PI, 0, true);
  outline.lineTo(radius + .18, spring);
  const geo = new THREE.ExtrudeGeometry(outline, { depth: .24, bevelEnabled: false, curveSegments: 20 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.z = z;
  parent.add(mesh);
}

function lamp(parent, x, y, z, glow = 3.2) {
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.075, .12, .06, 10), brass);
  foot.position.set(x, y, z);
  parent.add(foot);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.015, .022, .32, 8), brass);
  rod.position.set(x, y + .17, z);
  parent.add(rod);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(.24, .16, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xc7a374, emissive: 0x7e4929, emissiveIntensity: .48, side: THREE.DoubleSide }));
  shade.position.set(x, y + .36, z);
  parent.add(shade);
  const light = new THREE.PointLight(0xffc991, glow, 7, 1.65);
  light.position.set(x, y + .28, z);
  parent.add(light);
}

function shelf(scene, x, z, side, id, targets) {
  const object = new THREE.Group();
  object.position.set(x, 0, z);
  object.rotation.y = side * Math.PI / 2;
  scene.add(object);
  panel(object, timber, [width, 4.5, .09], [0, 2.27, -.32]);
  for (const height of [.16, .94, 1.72, 2.50, 3.28, 4.06, 4.49]) {
    panel(object, trim, [width + .16, .083, .72], [0, height, .01]);
    panel(object, timber, [width + .14, .042, .07], [0, height + .05, .36]);
  }
  for (const x of [-width / 2, width / 2]) {
    panel(object, trim, [.17, 4.5, .75], [x, 2.25, .01]);
    panel(object, timber, [.052, 4.26, .065], [x, 2.25, .405]);
    panel(object, brass, [.065, .1, .07], [x, 2.62, .43]);
  }
  panel(object, trim, [width + .31, .21, .84], [0, 4.55, .01]);
  panel(object, trim, [width + .14, .14, .79], [0, .10, .01]);
  const hot = panel(object, new THREE.MeshBasicMaterial({ visible: false }), [width - .15, 3.7, .025], [0, 2.07, .12]);
  hot.userData.stop = id;
  targets.push(hot);
  const contents = new THREE.Group();
  object.add(contents);
  return contents;
}

function bookObject(book, i, color, interactive = true) {
  const object = new THREE.Group();
  const bookWidth = .105 + (i % 6) * .014;
  const height = .47 + (i % 4) * .038;
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: .9 });
  const cover = panel(object, cloth, [bookWidth, height, .30], [0, height / 2, -.13]);
  panel(object, cream, [bookWidth * .76, height * .97, .23], [0, height / 2, -.19]);
  for (const stripe of [.15, .23, .73, .84]) {
    panel(object, brass, [bookWidth * .95, .004, .003], [0, height * stripe, .023]);
  }
  if (interactive) {
    cover.userData.book = book;
    cover.userData.model = object;
  }
  return { object, cover };
}

function space(scene, targets) {
  timber.map = texture('#765541', '#2a1e1a');
  trim.map = timber.map;
  const parquet = texture('#735741', '#2a2019', true);
  parquet.repeat.set(5, 10);
  const floor = new THREE.MeshStandardMaterial({ color: 0x906d50, map: parquet, roughness: .77 });
  panel(scene, floor, [11.4, .1, 29], [0, -.075, 0]);
  panel(scene, timber, [2.5, .022, 18], [0, -.005, .4]);
  panel(scene, new THREE.MeshStandardMaterial({ color: 0x6f4d34, roughness: .96 }), [2.04, .028, 18], [0, .003, .4]);
  for (const x of [-5.5, 5.5]) {
    panel(scene, stone, [.3, 6.5, 29], [x, 3.15, 0]);
    panel(scene, trim, [.24, .16, 26], [x * .99, 4.92, 0]);
    for (const z of [-12, -7.6, -2.7, 2, 6.8, 11.5]) {
      panel(scene, stone, [.62, 5.78, .54], [x * .94, 2.89, z]);
      panel(scene, trim, [.72, .20, .69], [x * .94, 5.71, z]);
      panel(scene, trim, [.82, .18, .73], [x * .94, .09, z]);
    }
  }
  for (const z of [-12, -7.6, -2.7, 2, 6.8, 11.5]) arch(scene, z, 5.18, 5.7, trim);
  const ceiling = new THREE.Mesh(new THREE.CylinderGeometry(5.35, 5.35, 29, 40, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x755542, roughness: .9, side: THREE.BackSide }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 5.7;
  scene.add(ceiling);
  panel(scene, stone, [11.4, 11, .30], [0, 5.45, -13.7]);
  panel(scene, timber, [2.8, 5.0, .20], [0, 2.45, -13.45]);
  arch(scene, -13.3, 1.44, 4.9, brass);
  const window = new THREE.MeshStandardMaterial({ color: 0xbbbb90, emissive: 0x9c8b6c, emissiveIntensity: .8, roughness: .45 });
  panel(scene, window, [1.75, 2.5, .10], [0, 7.6, -13.43]);
  for (const x of [-.9, -.45, 0, .45, .9]) panel(scene, timber, [.06, 2.56, .14], [x, 7.6, -13.32]);
  panel(scene, timber, [1.84, .07, .12], [0, 7.5, -13.32]);
  const sun = new THREE.DirectionalLight(0xffd9a8, 1.28);
  sun.position.set(-2, 9, -11);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xf4dcbd, 0x78645e, 1.53));
  const table = panel(scene, trim, [2.95, .115, 1.14], [0, .92, -8.45]);
  table.userData.stop = 'desk';
  targets.push(table);
  panel(scene, leather, [1.74, .011, .8], [0, .985, -8.41]);
  for (const x of [-1.33, 1.33]) {
    for (const z of [-8.90, -7.99]) panel(scene, timber, [.15, .94, .15], [x, .46, z]);
  }
  lamp(scene, 1.11, 1.02, -8.58, 7);
  lamp(scene, -3.12, 1.55, 7.2, 6);
  lamp(scene, 3.12, 1.55, 2.6, 6);
  lamp(scene, -3.12, 1.55, -3.5, 6);
  const spaces = {};
  for (const [id, x, z, side] of [['west', -5, 4.4, 1], ['east', 5, -.3, -1], ['archives', -5, -5, 1]]) {
    spaces[id] = shelf(scene, x, z, side, id, targets);
  }
  for (const [x, z, side] of [[5, 4.4, -1], [-5, -.3, 1], [5, -5, -1], [-5, -9.8, 1], [5, -9.8, -1], [-5, 9.15, 1], [5, 9.15, -1]]) {
    shelf(scene, x, z, side, x === -5 ? 'west' : 'east', targets);
  }
  return spaces;
}

function disposeGroup(group) {
  for (const mesh of group.children) {
    mesh.traverse(child => { if (child.isMesh) child.geometry.dispose(); });
  }
  group.clear();
}

export function createLibraryTour({ canvas, message, onStop, onPick, getCover, onPage }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x261b15);
  scene.fog = new THREE.FogExp2(0x2e211a, .019);
  const camera = new THREE.PerspectiveCamera(61, 1, .065, 80);
  const targets = [];
  const shelves = space(scene, targets);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let stop = stops[0];
  let aim = vector(stop.look);
  let animation = null;
  let selected = [];
  let stored = [];
  let shelfIndex = 0;
  let press;
  let frame = 0;
  let paused = true;
  let lifted;
  let behind;
  let openedCover;
  camera.position.copy(vector(stop.position));
  camera.lookAt(aim);

  function draw() { if (!paused) renderer.render(scene, camera); }
  function resize() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    draw();
  }
  const resizer = new ResizeObserver(resize);
  resizer.observe(canvas);

  function animate(time) {
    frame = 0;
    if (paused) return;
    const active = animation;
    if (active) {
      const proportion = Math.min((time - active.start) / active.duration, 1);
      active.update(easing(proportion));
      if (proportion === 1) {
        animation = null;
        active.done?.();
      }
    }
    draw();
    if (animation && !frame) frame = requestAnimationFrame(animate);
  }

  function transition(duration, update, done) {
    if (reduced.matches) {
      update(1);
      done?.();
      draw();
      return;
    }
    animation = { start: performance.now(), duration, update, done };
    if (!frame) frame = requestAnimationFrame(animate);
  }

  function go(id, complete) {
    const destination = stops.find(place => place.id === id);
    if (!destination) return;
    if (lifted && !complete) {
      scene.remove(lifted);
      openedCover?.dispose();
      openedCover = undefined;
      lifted = undefined;
    }
    if (behind) {
      behind.visible = true;
      behind = undefined;
    }
    const changedRoom = stop.id !== destination.id;
    stop = destination;
    onStop(stop.id);
    if (changedRoom && shelfIndex !== 0) setBooks(stored);
    else onPage?.(shelfIndex, pageCount(stop.id));
    const origin = camera.position.clone();
    const next = vector(stop.position);
    const oldAim = aim.clone();
    const nextAim = vector(stop.look);
    const way = new THREE.Vector3(0, origin.y, (origin.z + next.z) / 2);
    const curve = new THREE.QuadraticBezierCurve3(origin, way, next);
    transition(id === 'desk' ? 970 : 1160, fraction => {
      camera.position.copy(curve.getPoint(fraction));
      aim.lerpVectors(oldAim, nextAim, fraction);
      camera.lookAt(aim);
    }, complete);
  }

  function stage(book, model) {
    if (paused) return onPick(book);
    const from = model ? model.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.5, -7.6);
    const material = new THREE.MeshStandardMaterial({ color: colours[book.title.length % colours.length], roughness: .72 });
    const bookModel = new THREE.Group();
    const pivot = new THREE.Group();
    const cover = panel(pivot, material, [.43, .61, .025], [.21, .30, .016]);
    panel(bookModel, cream, [.42, .60, .085], [.21, .30, -.037]);
    panel(bookModel, material, [.44, .62, .022], [.21, .30, -.088]);
    bookModel.add(pivot);
    const label = Object.assign(document.createElement('canvas'), { width: 256, height: 352 });
    const ctx = label.getContext('2d');
    ctx.fillStyle = '#' + material.color.getHexString();
    ctx.fillRect(0, 0, 256, 352);
    ctx.strokeStyle = '#ddbd84';
    ctx.strokeRect(15, 15, 226, 322);
    ctx.fillStyle = '#fff0d5';
    ctx.font = '26px Georgia';
    ctx.textAlign = 'center';
    const words = book.title.split(' ');
    let line = '', y = 84;
    for (const word of words) {
      if (ctx.measureText(line + ' ' + word).width > 201 && line) {
        ctx.fillText(line, 128, y, 204);
        y += 34;
        line = '';
      }
      line += (line ? ' ' : '') + word;
      if (y > 245) break;
    }
    ctx.fillText(line, 128, y, 204);
    ctx.font = '16px Georgia';
    ctx.fillText(book.author || '', 128, 310, 201);
    const jacket = new THREE.CanvasTexture(label);
    jacket.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.389, .563), new THREE.MeshStandardMaterial({ map: jacket, roughness: .86 }));
    face.position.set(.21, .30, .03);
    pivot.add(face);
    if (lifted) scene.remove(lifted);
    openedCover?.dispose();
    openedCover = jacket;
    if (book.cover && getCover) {
      getCover(book).then(blob => createImageBitmap(blob)).then(bitmap => {
        const context = label.getContext('2d');
        const ratio = Math.min(256 / bitmap.width, 352 / bitmap.height);
        const w = bitmap.width * ratio;
        const h = bitmap.height * ratio;
        context.fillStyle = '#231914';
        context.fillRect(0, 0, 256, 352);
        context.drawImage(bitmap, (256 - w) / 2, (352 - h) / 2, w, h);
        bitmap.close();
        if (openedCover === jacket) { jacket.needsUpdate = true; draw(); }
      }).catch(() => {});
    }
    const pick = () => {
      const resting = new THREE.Vector3(-.22, 1.13, -7.94);
      bookModel.position.copy(resting);
      bookModel.rotation.x = -.35;
      lifted = bookModel;
      scene.add(bookModel);
      transition(1100, amount => {
        bookModel.position.y = resting.y + Math.sin(amount * Math.PI) * .08;
        pivot.rotation.y = -amount * Math.PI * .84;
        cover.material.needsUpdate = false;
      }, () => onPick(book));
    };
    if (stop.id === 'desk') { pick(); return; }
    if (model) {
      lifted = bookModel;
      behind = model;
      model.visible = false;
      scene.add(bookModel);
      const pulled = from.clone().lerp(camera.position, .24);
      const turn = new THREE.Vector3().subVectors(camera.position, from).normalize();
      transition(650, amount => {
        bookModel.position.lerpVectors(from, pulled, amount);
        bookModel.rotation.y = amount * Math.atan2(turn.x, turn.z);
      }, () => {
        scene.remove(bookModel);
        go('desk', pick);
      });
    } else go('desk', pick);
  }

  const inArea = (book, id) => shelfAreas[id].includes(book.genre || '') || (id === 'archives' && !Object.values(shelfAreas).flat().includes(book.genre));
  function pageCount(id) {
    return Object.hasOwn(shelfAreas, id) ? Math.ceil(stored.filter(book => inArea(book, id)).length / 45) : 0;
  }
  function setBooks(books, page = 0) {
    stored = books;
    shelfIndex = page;
    selected = [];
    for (const [id, shelf] of Object.entries(shelves)) {
      disposeGroup(shelf);
      const matching = books.filter(book => inArea(book, id));
      const pageBooks = matching.slice(page * 45, page * 45 + 45);
      pageBooks.forEach((book, i) => {
        const row = Math.floor(i / 15);
        const column = i % 15;
        const { object, cover } = bookObject(book, i, colours[i % colours.length]);
        object.position.set(-1.53 + column * .215, .99 + row * .78, .27);
        shelf.add(object);
        selected.push(cover);
      });
    }
    onPage?.(shelfIndex, pageCount(stop.id));
    draw();
  }

  function target(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const view = raycaster.intersectObjects([...selected, ...targets], false);
    return view.find(candidate => candidate.object.visible && candidate.object.parent?.visible)?.object;
  }
  canvas.addEventListener('pointerdown', event => {
    press = { x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (press && !animation) {
      const x = event.clientX - press.x;
      const y = event.clientY - press.y;
      if (press.moved || Math.hypot(x, y) > 4) {
        press.moved = true;
        press.x = event.clientX;
        press.y = event.clientY;
        const direction = aim.clone().sub(camera.position);
        const spherical = new THREE.Spherical().setFromVector3(direction);
        spherical.theta -= x * .005;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi - y * .004, .35, 2.48);
        aim = new THREE.Vector3().setFromSpherical(spherical).add(camera.position);
        camera.lookAt(aim);
        draw();
      }
    } else if (!animation) {
      const object = target(event);
      const title = object?.userData.book?.title;
      canvas.classList.toggle('can-pick', Boolean(object));
      message.textContent = title || '';
    }
  });
  canvas.addEventListener('pointercancel', () => { press = null; });
  canvas.addEventListener('pointerup', event => {
    if (press && !press.moved && !animation) {
      const object = target(event);
      if (object?.userData.book) stage(object.userData.book, object.userData.model);
      else if (object?.userData.stop) go(object.userData.stop);
    }
    press = null;
  });
  canvas.addEventListener('pointerleave', () => { message.textContent = ''; });
  canvas.addEventListener('keydown', event => {
    const directions = { ArrowLeft: 'west', ArrowRight: 'east', ArrowUp: 'desk', ArrowDown: 'archives', Home: 'hall' };
    if (!directions[event.key]) return;
    event.preventDefault();
    go(directions[event.key]);
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    canvas.dispatchEvent(new CustomEvent('tourunavailable'));
  });

  return {
    go, stage, setBooks,
    page: step => setBooks(stored, Math.max(0, Math.min(shelfIndex + step, pageCount(stop.id) - 1))),
    setVisible(visible) { paused = !visible; if (visible) resize(); },
    setLighting(night) { renderer.toneMappingExposure = night ? .58 : 1.12; draw(); }
  };
}
