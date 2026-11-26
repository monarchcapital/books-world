import * as THREE from './three.module.min.js';

const stops = [
  { id: 'hall', name: 'Grand Hall', position: [0, 1.65, 11.5], look: [0, 2.6, -6] },
  { id: 'west', name: 'West Stacks', position: [-2.25, 1.68, 4.4], look: [-4.85, 2.02, 4.4] },
  { id: 'east', name: 'East Gallery', position: [2.25, 1.68, -.3], look: [4.85, 2.02, -.3] },
  { id: 'archives', name: 'The Archives', position: [-2.25, 1.68, -5], look: [-4.85, 2.02, -5] },
  { id: 'desk', name: 'Reading Desk', position: [0, 1.65, -6.1], look: [0, 1.05, -8.7] },
  { id: 'portrait', name: 'Portrait Gallery', position: [3.65, 2.22, -10.2], look: [3.6, 2.82, -13.28] }
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
const timber = new THREE.MeshStandardMaterial({ color: 0x9a7355, roughness: .81 });
const trim = new THREE.MeshStandardMaterial({ color: 0xbf926a, roughness: .72 });
const brass = new THREE.MeshStandardMaterial({ color: 0xb58b52, metalness: .54, roughness: .52 });
const stone = new THREE.MeshStandardMaterial({ color: 0xb5a899, roughness: .98 });
const leather = new THREE.MeshStandardMaterial({ color: 0x303943, roughness: .93 });
const cream = new THREE.MeshStandardMaterial({ color: 0xe3cea3, roughness: 1 });
const candleWax = new THREE.MeshStandardMaterial({ color: 0xf2d9ae, roughness: .79, emissive: 0x9b6c3a, emissiveIntensity: .14 });
const candleFlame = new THREE.MeshBasicMaterial({ color: 0xffc367 });
const candleCore = new THREE.MeshBasicMaterial({ color: 0xffe6ac });
const bookCloth = new Map(colours.map(color => [color, new THREE.MeshStandardMaterial({ color, roughness: .91 })]));

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

function stonework() {
  const canvas = Object.assign(document.createElement('canvas'), { width: 384, height: 384 });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#514a46';
  ctx.fillRect(0, 0, 384, 384);
  let seed = 3991;
  const number = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < 6; y++) {
    for (let x = -1; x < 5; x++) {
      const tone = Math.round(101 + 38 * number());
      const left = x * 96 + (y % 2) * 48;
      ctx.fillStyle = 'rgb(' + (tone + 7) + ',' + tone + ',' + (tone - 5) + ')';
      ctx.fillRect(left + 1, y * 64 + 1, 94, 62);
      ctx.fillStyle = '#d2baa0';
      ctx.globalAlpha = .29;
      ctx.fillRect(left + 2, y * 64 + 2, 93, 1);
      ctx.globalAlpha = 1;
    }
  }
  for (let index = 0; index < 1650; index++) {
    ctx.globalAlpha = number() * .26;
    ctx.fillStyle = index % 2 ? '#3c322a' : '#d8c4ac';
    ctx.fillRect(number() * 384, number() * 384, .3 + number() * 2.7, .35 + number() * 2.2);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

function taper(scene, x, y, z, phase) {
  const item = new THREE.Group();
  item.position.set(x, y, z);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(.027, .033, .30, 9), candleWax);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(.037, 10, 7), candleFlame);
  flame.position.y = .205;
  flame.scale.set(.68, 1.8, .67);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.018, 9, 7), candleCore);
  core.position.y = .196;
  core.scale.y = 1.54;
  item.add(stick, flame, core);
  scene.add(item);
  return { item, flame, y, phase };
}

function arch(parent, z, radius, spring, material) {
  const outline = new THREE.Shape();
  const peak = spring + radius * 1.09;
  outline.moveTo(-radius - .17, spring);
  outline.quadraticCurveTo(-radius * .98, spring + radius * .60, 0, peak + .17);
  outline.quadraticCurveTo(radius * .98, spring + radius * .60, radius + .17, spring);
  outline.lineTo(radius, spring);
  outline.quadraticCurveTo(radius * .90, spring + radius * .54, 0, peak);
  outline.quadraticCurveTo(-radius * .90, spring + radius * .54, -radius, spring);
  outline.closePath();
  const geo = new THREE.ExtrudeGeometry(outline, { depth: .30, bevelEnabled: true, bevelSize: .025, bevelThickness: .035, bevelSegments: 1, curveSegments: 19 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.z = z;
  parent.add(mesh);
  return mesh;
}

function lancet(scene, x, y, z, width, height, panes) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, height * .68);
  shape.quadraticCurveTo(-width * .47, height * .86, 0, height);
  shape.quadraticCurveTo(width * .47, height * .86, width / 2, height * .68);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const coloredGlass = new THREE.Mesh(new THREE.ShapeGeometry(shape, 19), panes[0]);
  coloredGlass.position.set(x, y, z);
  scene.add(coloredGlass);
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 3; column++) {
      const color = panes[(row * 3 + column * 2) % panes.length];
      panel(scene, color, [width / 3 - .035, height * .131, .018], [x + (column - 1) * width / 3, y + (row + .5) * height * .135, z + .018]);
    }
  }
  for (const offset of [-1, -.33, .33, 1]) panel(scene, stone, [.047, height * .68, .08], [x + width * offset / 2, y + height * .34, z + .045]);
  for (let row = 0; row <= 5; row++) panel(scene, stone, [width + .04, .035, .065], [x, y + row * height * .135, z + .046]);
  arch(scene, z + .039, width * .52, height * .69, trim).position.set(x, y, z + .04);
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

function bookObject(book, i, color, simple = false) {
  const object = new THREE.Group();
  const bookWidth = .105 + (i % 6) * .014;
  const height = .47 + (i % 4) * .038;
  const cloth = bookCloth.get(color);
  const cover = panel(object, cloth, [bookWidth, height, .30], [0, height / 2, -.13]);
  panel(object, cream, [bookWidth * .76, height * .97, .23], [0, height / 2, -.19]);
  for (const stripe of simple ? [.78] : [.15, .23, .73, .84]) {
    panel(object, brass, [bookWidth * .95, .004, .003], [0, height * stripe, .023]);
  }
  cover.userData.book = book;
  cover.userData.model = object;
  return { object, cover };
}

function person(selection) {
  const girl = selection === 'girl';
  const librarian = selection === 'librarian';
  const root = new THREE.Group();
  root.scale.setScalar(.83);
  const houseColor = new THREE.MeshStandardMaterial({ color: librarian ? 0xb89d5f : girl ? 0x9d4b53 : 0x52778d, roughness: .85 });
  const cloth = new THREE.MeshStandardMaterial({ color: librarian ? 0x263944 : girl ? 0x3d3548 : 0x29374a, roughness: .88 });
  const trousers = new THREE.MeshStandardMaterial({ color: librarian ? 0x302f31 : girl ? 0x453439 : 0x342d2b, roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xa46f54, roughness: .82 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x302419, roughness: .96 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x302218, roughness: .74 });
  const orb = (parent, material, position, scale) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  };
  orb(root, cloth, [0, .98, 0], [.245, .27, .161]);
  const robeGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(.264, .23), new THREE.Vector2(.267, .34), new THREE.Vector2(.222, .64),
    new THREE.Vector2(.191, .88), new THREE.Vector2(.228, 1.05), new THREE.Vector2(.193, 1.14),
    new THREE.Vector2(.080, 1.21)
  ], 24, .22, Math.PI * 2 - .44);
  const points = robeGeometry.attributes.position;
  for (let index = 0; index < points.count; index++) {
    const fold = 1 + Math.sin(Math.atan2(points.getX(index), points.getZ(index)) * 9) * Math.max(0, 1.14 - points.getY(index)) * .09;
    points.setX(index, points.getX(index) * fold);
    points.setZ(index, points.getZ(index) * fold * .80);
  }
  robeGeometry.computeVertexNormals();
  const robe = new THREE.Mesh(robeGeometry, cloth);
  root.add(robe);
  orb(root, cream, [0, 1.174, .128], [.119, .056, .054]);
  const lapel = panel(root, houseColor, [.064, .23, .022], [0, 1.043, .153]);
  lapel.rotation.z = -.21;
  panel(root, houseColor, [.092, .045, .024], [0, 1.155, .15]);
  orb(root, houseColor, [0, 1.10, -.151], [.166, .108, .032]);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cloth);
  hood.position.set(0, 1.089, -.145);
  hood.scale.set(.171, .117, .089);
  root.add(hood);
  if (!librarian) {
    const scarf = panel(root, houseColor, [.107, .41, .032], [.105, .953, -.187]);
    scarf.rotation.z = -.21;
    for (const y of [.80, .85, 1.019]) panel(root, brass, [.105, .013, .009], [.126, y, -.208]);
  }
  orb(root, skin, [0, 1.34, .018], [.137, .176, .126]);
  orb(root, hair, [0, 1.409, -.027], [.143, .136, .127]);
  if (girl || librarian) orb(root, hair, [0, 1.28, -.08], [.129, girl ? .202 : .127, .096]);
  if (librarian) {
    orb(root, hair, [0, 1.412, -.137], [.081, .092, .066]);
    for (const x of [-.052, .052]) {
      const eye = new THREE.Mesh(new THREE.TorusGeometry(.031, .004, 6, 16), brass);
      eye.position.set(x, 1.359, .133);
      root.add(eye);
    }
    panel(root, brass, [.042, .005, .011], [0, 1.360, .133]);
    panel(root, brass, [.041, .065, .01], [.108, .99, .15]);
  }
  const arms = [], feet = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * .208, 1.12, 0);
    orb(arm, cloth, [0, -.178, 0], [.070, .217, .069]);
    orb(arm, houseColor, [0, -.316, .005], [.071, .032, .070]);
    orb(arm, skin, [0, -.355, .006], [.048, .075, .047]);
    arm.rotation.z = side * .103;
    arms.push(arm);
    root.add(arm);
    const leg = new THREE.Group();
    leg.position.set(side * .094, .65, 0);
    orb(leg, trousers, [0, -.270, 0], [.073, .29, .08]);
    orb(leg, shoes, [0, -.58, .045], [.086, .061, .137]);
    feet.push(leg);
    root.add(leg);
  }
  let time = 0;
  return {
    root,
    pace(delta, walking, reduced) {
      if (walking) time += delta * 12.5;
      const swing = walking && !reduced ? Math.sin(time) * .42 : 0;
      for (const index of [0, 1]) {
        feet[index].rotation.x = swing * (index ? -1 : 1);
        arms[index].rotation.x = -swing * (index ? -1 : 1);
      }
      root.position.y = walking && !reduced ? Math.abs(Math.sin(time)) * .032 : 0;
    }
  };
}

function space(scene, targets) {
  timber.map = texture('#765541', '#2a1e1a');
  trim.map = timber.map;
  const parquet = texture('#735741', '#2a2019', true);
  parquet.repeat.set(5, 10);
  const floor = new THREE.MeshStandardMaterial({ color: 0x906d50, map: parquet, roughness: .77 });
  panel(scene, floor, [11.4, .1, 29], [0, -.075, 0]);
  const rug = new THREE.MeshStandardMaterial({ color: 0x493746, roughness: 1 });
  panel(scene, timber, [2.65, .022, 19.5], [0, -.005, .1]);
  panel(scene, rug, [2.38, .028, 19.4], [0, .003, .1]);
  for (const x of [-1.15, 1.15]) panel(scene, brass, [.016, .006, 19.35], [x, .023, .1]);
  const compass = new THREE.Mesh(new THREE.RingGeometry(.69, .71, 40), brass);
  compass.rotation.x = -Math.PI / 2;
  compass.position.set(0, .023, 8);
  scene.add(compass);
  for (let turn = 0; turn < 6; turn++) {
    const ray = panel(scene, brass, [.018, .006, 1.25], [0, .025, 8]);
    ray.rotation.y = turn * Math.PI / 6;
  }
  stone.map = stonework();
  stone.map.repeat.set(3, 3);
  for (const x of [-5.5, 5.5]) {
    panel(scene, stone, [.3, 6.5, 29], [x, 3.15, 0]);
    panel(scene, trim, [.24, .16, 26], [x * .99, 4.92, 0]);
    for (const z of [-12, -7.6, -2.7, 2, 6.8, 11.5]) {
      panel(scene, stone, [.62, 5.78, .54], [x * .94, 2.89, z]);
      panel(scene, trim, [.72, .20, .69], [x * .94, 5.71, z]);
      panel(scene, trim, [.82, .18, .73], [x * .94, .09, z]);
    }
  }
  for (const z of [-12, -7.6, -2.7, 2, 6.8, 11.5]) arch(scene, z, 5.16, 5.70, stone);
  const roof = new THREE.Shape();
  roof.moveTo(-5.51, 5.65);
  roof.quadraticCurveTo(-5.19, 8.69, 0, 11.52);
  roof.quadraticCurveTo(5.19, 8.69, 5.51, 5.65);
  roof.lineTo(5.24, 5.65);
  roof.quadraticCurveTo(4.92, 8.48, 0, 11.22);
  roof.quadraticCurveTo(-4.92, 8.48, -5.24, 5.65);
  const ceiling = new THREE.Mesh(new THREE.ExtrudeGeometry(roof, { depth: 29, bevelEnabled: false, curveSegments: 25 }), new THREE.MeshStandardMaterial({ color: 0x7a7066, roughness: .97, side: THREE.DoubleSide }));
  ceiling.position.z = -14.5;
  scene.add(ceiling);
  panel(scene, stone, [11.4, 11, .30], [0, 5.45, -13.7]);
  panel(scene, timber, [2.8, 5.0, .20], [0, 2.45, -13.45]);
  arch(scene, -13.3, 1.44, 4.9, brass);
  const panes = [0x98a2a4, 0x9e8ea5, 0xbab38c, 0x899fa1, 0xa8959f].map(color => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .50, roughness: .46 }));
  lancet(scene, 0, 6.30, -13.39, 1.85, 3.74, panes);
  lancet(scene, -2.39, 6.05, -13.38, 1.11, 2.64, panes.slice(1));
  lancet(scene, 2.39, 6.05, -13.38, 1.11, 2.64, panes.slice(2));
  for (const x of [-3.56, 3.56]) {
    const banner = panel(scene, new THREE.MeshStandardMaterial({ color: x < 0 ? 0x563440 : 0x374450, roughness: 1 }), [1.05, 2.42, .019], [x, 5.03, -13.46]);
    panel(scene, brass, [1.18, .064, .065], [x, 6.27, -13.41]);
    const sigil = new THREE.Mesh(new THREE.RingGeometry(.245, .268, 5), brass);
    sigil.position.set(x, 5.24, -13.431);
    sigil.rotation.z = Math.PI / 2;
    scene.add(sigil);
    banner.rotation.z = x < 0 ? -.01 : .01;
  }
  const sun = new THREE.DirectionalLight(0xffe3bd, 1.82);
  sun.position.set(-2, 9, -11);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffebcf, 0xb2957e, 1.97));
  scene.add(new THREE.AmbientLight(0xffe6ca, .26));
  for (const z of [8.5, 4.4, -.3, -5, -10.2]) {
    const aisleLight = new THREE.PointLight(0xffe2b5, 19, 11, 1.36);
    aisleLight.position.set(0, 4.8, z);
    scene.add(aisleLight);
  }
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
  const flames = [];
  for (let index = 0; index < 7; index++) {
    flames.push(taper(scene, -1.18 + .16 * (index % 3), 3.88 + .26 * (index % 2), 8.3 - 2.68 * index, index * .91));
    flames.push(taper(scene, 1.38 - .17 * (index % 3), 4.05 + .3 * ((index + 1) % 2), 7.2 - 2.71 * index, index * 1.23));
  }
  const spaces = {};
  for (const [id, x, z, side] of [['west', -5, 4.4, 1], ['east', 5, -.3, -1], ['archives', -5, -5, 1]]) {
    spaces[id] = shelf(scene, x, z, side, id, targets);
  }
  const alcoves = [];
  for (const [x, z, side] of [[5, 4.4, -1], [-5, -.3, 1], [5, -5, -1], [-5, -9.8, 1], [5, -9.8, -1], [-5, 9.15, 1], [5, 9.15, -1]]) {
    alcoves.push(shelf(scene, x, z, side, x === -5 ? 'west' : 'east', targets));
  }
  return { spaces, alcoves, flames };
}

function disposeGroup(group) {
  for (const mesh of group.children) {
    mesh.traverse(child => { if (child.isMesh) child.geometry.dispose(); });
  }
  group.clear();
}

export function createLibraryTour({ canvas, message, onStop, onPick, compact, getCover, onPage, hasPortrait, getPortrait, onAim, onJourney }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.34;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x261b15);
  scene.fog = new THREE.FogExp2(0x2e211a, .019);
  const camera = new THREE.PerspectiveCamera(61, 1, .065, 80);
  const targets = [];
  const { spaces: shelves, alcoves, flames } = space(scene, targets);
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
  const fingers = new Map();
  let gesture;
  let frame = 0;
  let paused = true;
  let lifted;
  let behind;
  let openedCover;
  let walker;
  let lastFrame = 0;
  let lastPaint = 0;
  let lastAim = 0;
  const moving = new Set();
  const movementKeys = { w: 'forward', s: 'back', a: 'left', d: 'right', ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right' };
  camera.position.copy(vector(stop.position));
  camera.lookAt(aim);

  function heading() {
    const direction = aim.clone().sub(camera.position).setY(0);
    return direction.lengthSq() > .0001 ? direction.normalize() : new THREE.Vector3(0, 0, -1);
  }

  function follow(distance = 1.9) {
    if (!walker) return;
    const forward = heading();
    const ahead = camera.position.clone().addScaledVector(forward, distance);
    walker.root.position.set(THREE.MathUtils.clamp(ahead.x, -4.30, 4.30), 0, THREE.MathUtils.clamp(ahead.z, -12.7, 12.0));
    walker.root.rotation.y = Math.atan2(forward.x, forward.z);
    walker.root.visible = stop.id !== 'desk';
  }

  function setAvatar(selection) {
    if (walker) {
      scene.remove(walker.root);
      disposeGroup(walker.root);
    }
    walker = person(selection);
    scene.add(walker.root);
    follow(2.8);
    draw();
  }

  function walk(delta) {
    const forward = heading();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const forwardStep = Number(moving.has('forward')) - Number(moving.has('back'));
    const sideStep = Number(moving.has('right')) - Number(moving.has('left'));
    const direction = forward.multiplyScalar(forwardStep).addScaledVector(right, sideStep).normalize();
    if (!direction.lengthSq()) return;
    const before = camera.position.clone();
    const next = before.clone().addScaledVector(direction, delta * 2.35);
    next.x = THREE.MathUtils.clamp(next.x, -4.15, 4.15);
    next.z = THREE.MathUtils.clamp(next.z, -11.9, 12.35);
    if (Math.abs(next.x) < 1.65 && next.z < -7.78 && next.z > -9.18) next.z = before.z;
    camera.position.copy(next);
    aim.add(next.clone().sub(before));
    camera.lookAt(aim);
    follow(2.48);
    if (walker) {
      walker.root.visible = true;
      walker.root.rotation.y = Math.atan2(direction.x, direction.z);
      walker.pace(delta, true, reduced.matches);
    }
  }

  function movement(direction, value) {
    if (value) moving.add(direction);
    else moving.delete(direction);
    if (!frame && !paused) frame = requestAnimationFrame(animate);
  }

  function stopMoving() {
    moving.clear();
    if (walker) walker.pace(0, false, reduced.matches);
    draw();
  }

  if (getPortrait) {
    getPortrait().then(blob => createImageBitmap(blob, { imageOrientation: 'flipY' })).then(bitmap => {
      const image = new THREE.Texture(bitmap);
      image.colorSpace = THREE.SRGBColorSpace;
      image.needsUpdate = true;
      const framed = new THREE.Group();
      framed.position.set(3.58, 2.88, -13.32);
      scene.add(framed);
      panel(framed, timber, [2.30, 2.47, .13], [0, 0, .01]);
      panel(framed, brass, [2.21, 2.34, .08], [0, 0, .085]);
      panel(framed, trim, [2.10, 2.22, .075], [0, 0, .132]);
      panel(framed, brass, [1.99, 2.05, .06], [0, 0, .17]);
      const painting = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 1.86), new THREE.MeshStandardMaterial({ map: image, roughness: .92, emissive: 0x423021, emissiveIntensity: .16 }));
      painting.position.z = .21;
      painting.userData.stop = 'portrait';
      framed.add(painting);
      targets.push(painting);
      const glow = new THREE.PointLight(0xffd1a2, 7, 5, 1.55);
      glow.position.set(3.56, 4.20, -12.66);
      scene.add(glow);
      hasPortrait?.(true);
      draw();
    }).catch(() => { hasPortrait?.(false); });
  }

  function draw() {
    if (paused) return;
    renderer.render(scene, camera);
    if (compact?.matches && onAim && performance.now() - lastAim > 75) {
      const bounds = canvas.getBoundingClientRect();
      const hit = bounds.width && bounds.height ? target({ clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2, pointerType: 'touch' }) : null;
      onAim(hit?.userData.book);
      lastAim = performance.now();
    }
  }
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
    const delta = lastFrame ? Math.min((time - lastFrame) / 1000, .045) : .016;
    lastFrame = time;
    const active = animation;
    if (active) {
      const proportion = Math.min((time - active.start) / active.duration, 1);
      active.update(easing(proportion));
      if (proportion === 1) {
        animation = null;
        active.done?.();
      }
    } else if (moving.size) walk(delta);
    else if (walker) walker.pace(0, false, reduced.matches);
    const idleLights = !document.hidden && !reduced.matches;
    if ((idleLights && time - lastPaint >= 32) || active || moving.size || !lastPaint) {
      if (idleLights) {
        for (const flame of flames) {
          flame.item.position.y = flame.y + Math.sin(time * .00125 + flame.phase) * .094;
          flame.flame.scale.y = 1.68 + Math.sin(time * .009 + flame.phase) * .24;
        }
      }
      draw();
      lastPaint = time;
    }
    if ((animation || moving.size || idleLights) && !frame) frame = requestAnimationFrame(animate);
    else lastFrame = 0;
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

  function go(id, complete, travel) {
    const destination = stops.find(place => place.id === id);
    if (!destination) return;
    stopMoving();
    if (!complete) onJourney?.(undefined);
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
    else announcePage();
    const origin = camera.position.clone();
    const next = vector(stop.position);
    const oldAim = aim.clone();
    const nextAim = vector(stop.look);
    const way = new THREE.Vector3(0, origin.y, (origin.z + next.z) / 2);
    const curve = new THREE.QuadraticBezierCurve3(origin, way, next);
    transition(travel ?? (id === 'desk' ? 970 : 1160), fraction => {
      camera.position.copy(curve.getPoint(fraction));
      aim.lerpVectors(oldAim, nextAim, fraction);
      camera.lookAt(aim);
      follow(id === 'hall' ? 2.8 : 1.90);
      walker?.pace(.05, fraction < 1, reduced.matches);
    }, complete);
  }

  function stage(book, model, touch = false) {
    if (paused) return onPick(book);
    const quick = touch || compact?.matches;
    onJourney?.(book);
    if (!model) {
      const nearby = selected.find(item => item.userData.book?.id === book.id && item.parent.visible &&
        item.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position) < 4);
      model = nearby?.userData.model;
    }
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
      transition(quick ? 450 : 1100, amount => {
        bookModel.position.y = resting.y + Math.sin(amount * Math.PI) * .08;
        pivot.rotation.y = -amount * Math.PI * .84;
        cover.material.needsUpdate = false;
      }, () => { onJourney?.(undefined); onPick(book); });
    };
    if (stop.id === 'desk') { pick(); return; }
    if (model) {
      lifted = bookModel;
      behind = model;
      model.visible = false;
      scene.add(bookModel);
      const pulled = from.clone().lerp(camera.position, .24);
      const turn = new THREE.Vector3().subVectors(camera.position, from).normalize();
      transition(quick ? 220 : 650, amount => {
        bookModel.position.lerpVectors(from, pulled, amount);
        bookModel.rotation.y = amount * Math.atan2(turn.x, turn.z);
      }, () => {
        scene.remove(bookModel);
        go('desk', pick, quick ? 580 : undefined);
      });
    } else go('desk', pick, quick ? 580 : undefined);
  }

  const inArea = (book, id) => shelfAreas[id].includes(book.genre || '') || (id === 'archives' && !Object.values(shelfAreas).flat().includes(book.genre));
  function pageCount(id) {
    return Object.hasOwn(shelfAreas, id) ? Math.ceil(stored.filter(book => inArea(book, id)).length / 45) : 0;
  }
  function currentPage(id) {
    return Object.hasOwn(shelfAreas, id) ? stored.filter(book => inArea(book, id)).slice(shelfIndex * 45, (shelfIndex + 1) * 45) : [];
  }
  function announcePage() { onPage?.(shelfIndex, pageCount(stop.id), currentPage(stop.id)); }
  function setBooks(books, page = 0) {
    stored = books;
    shelfIndex = page;
    selected = [];
    const placed = new Set();
    for (const [id, shelf] of Object.entries(shelves)) {
      disposeGroup(shelf);
      const pageBooks = currentPage(id);
      pageBooks.forEach((book, i) => {
        const row = Math.floor(i / 15);
        const column = i % 15;
        const { object, cover } = bookObject(book, i, colours[i % colours.length]);
        const columns = Math.min(15, pageBooks.length - row * 15);
        object.position.set((column - (columns - 1) / 2) * .215, [1.77, .99, 2.55][row], .27);
        shelf.add(object);
        placed.add(book.id);
        cover.userData.area = id;
        selected.push(cover);
      });
    }
    const unplaced = books.filter(book => !placed.has(book.id));
    alcoves.forEach((shelf, index) => {
      disposeGroup(shelf);
      const booksAlongside = unplaced.slice(index * 17, (index + 1) * 17);
      booksAlongside.forEach((book, offset) => {
        const { object, cover } = bookObject(book, offset, colours[(offset + index) % colours.length], true);
        object.position.set(-1.50 + (offset % 12) * .25, 1.72 + Math.floor(offset / 12) * .78, .27);
        shelf.add(object);
        selected.push(cover);
      });
    });
    announcePage();
    draw();
  }

  function locate(book) {
    const area = Object.keys(shelfAreas).find(id => inArea(book, id));
    if (!area) return;
    const index = stored.filter(item => inArea(item, area)).findIndex(item => item.id === book.id);
    if (index < 0) return;
    go(area, () => {
      setBooks(stored, Math.floor(index / 45));
      const spine = selected.find(item => item.userData.book?.id === book.id && item.userData.area === area);
      if (!spine) return;
      aim = spine.getWorldPosition(new THREE.Vector3());
      camera.lookAt(aim);
      message.textContent = book.title;
      draw();
    });
  }

  function target(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const view = raycaster.intersectObjects([...selected, ...targets], false);
    const hit = view.find(candidate => candidate.object.visible && candidate.object.parent?.visible)?.object;
    if (event.pointerType !== 'touch' || hit?.userData.book) return hit;
    let closest = hit;
    let distance = 18;
    for (const spine of selected) {
      const world = spine.getWorldPosition(new THREE.Vector3());
      if (!spine.parent.visible || world.distanceTo(camera.position) > 4) continue;
      const location = world.project(camera);
      if (location.z < -1 || location.z > 1) continue;
      const difference = Math.hypot((location.x - pointer.x) * bounds.width / 2, (location.y - pointer.y) * bounds.height / 2);
      if (difference < distance) { distance = difference; closest = spine; }
    }
    return closest;
  }
  function zoom(change) {
    camera.fov = THREE.MathUtils.clamp(camera.fov + change, 28, 82);
    camera.updateProjectionMatrix();
    draw();
  }
  function turn(x, y) {
    const direction = aim.clone().sub(camera.position);
    const spherical = new THREE.Spherical().setFromVector3(direction);
    spherical.theta -= x * .005;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi - y * .004, .35, 2.48);
    aim = new THREE.Vector3().setFromSpherical(spherical).add(camera.position);
    camera.lookAt(aim);
  }
  function fingerGeometry() {
    const [a, b] = [...fingers.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') {
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.size === 2) { gesture = fingerGeometry(); press = null; }
    }
    if (fingers.size < 2) press = { x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (fingers.has(event.pointerId)) {
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.size > 1) {
        if (!gesture) gesture = fingerGeometry();
        const next = fingerGeometry();
        if (!animation && next.distance > 6 && gesture.distance > 6) {
          turn((next.x - gesture.x) * .55, (next.y - gesture.y) * .55);
          zoom(camera.fov * (gesture.distance / next.distance - 1));
        }
        gesture = next;
        return;
      }
    }
    if (press && !animation) {
      const x = event.clientX - press.x;
      const y = event.clientY - press.y;
      if (press.moved || Math.hypot(x, y) > 4) {
        press.moved = true;
        press.x = event.clientX;
        press.y = event.clientY;
        turn(x, y);
        draw();
      }
    } else if (!animation) {
      const object = target(event);
      const title = object?.userData.book?.title || (object?.userData.stop === 'portrait' ? 'View the framed portrait' : '');
      canvas.classList.toggle('can-pick', Boolean(object));
      message.textContent = title || '';
    }
  });
  canvas.addEventListener('pointercancel', event => { fingers.delete(event.pointerId); gesture = null; press = null; });
  canvas.addEventListener('pointerup', event => {
    fingers.delete(event.pointerId);
    if (gesture) { if (fingers.size < 2) gesture = null; press = null; return; }
    if (press && !press.moved && !animation) {
      const object = target(event);
      if (object?.userData.book) stage(object.userData.book, object.userData.model, event.pointerType === 'touch');
      else if (object?.userData.stop) go(object.userData.stop);
    }
    press = null;
  });
  canvas.addEventListener('pointerleave', () => { message.textContent = ''; });
  function keyMove(event, down) {
    const direction = movementKeys[event.key] || movementKeys[event.key.toLowerCase()];
    const bounds = canvas.getBoundingClientRect();
    if (!direction || paused || (down && (event.altKey || event.ctrlKey || event.metaKey ||
      bounds.bottom < 150 || bounds.top >= innerHeight || event.target.closest?.('input,select,textarea,dialog,[contenteditable=true]') || document.querySelector('dialog[open]')))) return;
    event.preventDefault();
    movement(direction, down);
  }
  window.addEventListener('keydown', event => keyMove(event, true));
  window.addEventListener('keyup', event => keyMove(event, false));
  window.addEventListener('blur', stopMoving);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMoving();
    else if (!paused && !frame) frame = requestAnimationFrame(animate);
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    canvas.dispatchEvent(new CustomEvent('tourunavailable'));
  });

  return {
    go, stage, locate, setBooks, setAvatar, movement, stopMoving, zoom,
    page: step => setBooks(stored, Math.max(0, Math.min(shelfIndex + step, pageCount(stop.id) - 1))),
    setVisible(visible) {
      paused = !visible;
      if (visible) { resize(); if (!frame) frame = requestAnimationFrame(animate); }
      else stopMoving();
    },
    setLighting(night) { renderer.toneMappingExposure = night ? .72 : 1.34; draw(); }
  };
}
