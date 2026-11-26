import * as THREE from './three.module.min.js';

// This plan is shared by every player. The catalogue wing retains its original local coordinates.
const floors = [
  ['library', -4.9, 4.9, -14, 13.5],
  ['castle', -10.6, 10.6, 15.1, 35.6],
  ['library-door', -1.65, 1.65, 12.9, 15.7],
  ['gate', -3.45, 3.45, 35.2, 48.4],
  ['orrery', -26.3, -14.1, 17.5, 31.8],
  ['orrery-door', -14.7, -10.0, 22.6, 25.4],
  ['conservatory', 14.1, 26.3, 17.5, 31.8],
  ['conservatory-door', 10.0, 14.7, 22.6, 25.4],
  ['court', 14.7, 25.3, -11.3, 16.6],
  ['court-door', 18.45, 21.55, 15.8, 18.0],
];

const obstacles = [
  [-1.64, 1.64, -9.08, -7.72], // Reading desk
  [-21.72, -18.28, 22.65, 25.35], // Orrery
  [16.0, 17.35, 25.5, 27.1], [23.2, 24.55, 21.45, 23.05], // Planters
  [24.46, 25.92, 26.80, 28.43], [14.94, 16.41, 19.72, 21.32],
  [19.0, 21.0, -3.2, -.9], // Courtyard plinth
];
const inside = (x, z, left, right, north, south) => x >= left && x <= right && z >= north && z <= south;

export function walkable(x, z) {
  return floors.some(([, ...rectangle]) => inside(x, z, ...rectangle)) &&
    !obstacles.some(rectangle => inside(x, z, ...rectangle));
}

export function roomAt(x, z) {
  if (x < -12.2) return 'orrery';
  if (x > 12.2) return z < 17.25 ? 'court' : 'conservatory';
  if (z >= 36.05) return 'gate';
  if (z >= 14.46) return 'castle';
  if (x < -2.3 && z >= -7.2 && z <= -2.6) return 'archives';
  if (x < -2.3 && z >= 2.3 && z <= 6.6) return 'west';
  if (x > 2.3 && z >= -2.9 && z <= 2.3) return 'east';
  if (x > 2.25 && z < -10.1) return 'portrait';
  if (Math.abs(x) < 1.62 && z <= -5.4 && z > -7.7) return 'desk';
  return 'hall';
}

const groups = [
  ['gate', 'castle'], ['castle', 'hall'], ['castle', 'orrery'],
  ['castle', 'conservatory'], ['conservatory', 'court'],
];
const thresholds = [
  [0, 36, 0, 3.55], [0, 14.47, 0, 1.70], [-10.9, 24, Math.PI / 2, 1.62],
  [10.9, 24, -Math.PI / 2, 1.62], [20, 17.22, 0, 1.66],
];

export const castleRoom = id => ['gate','castle','orrery','conservatory','court'].includes(id) ? id : 'hall';

export function buildCastle(scene, { panel, arch, lancet, lamp, stone, timber, brass, floorMap, seed }) {
  const warmStone = stone.clone();
  warmStone.color.setHex(0xd5c7b6);
  const paving = new THREE.MeshStandardMaterial({ map: floorMap, color: 0x868785, metalness: .12, roughness: .52 });
  const shadowStone = stone.clone();
  shadowStone.color.setHex(0x807870);
  const oak = timber.clone();
  oak.color.setHex(0x8a5631);
  const indigo = timber.clone();
  indigo.color.setHex(0x354968);
  const green = timber.clone();
  green.color.setHex(0x394b37);
  const brocade = new THREE.MeshStandardMaterial({ color: 0x584458, roughness: .92 });
  const glass = [0x92b2be, 0xa4a4a0, 0x8589ad, 0xc0a376].map(color =>
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .46, roughness: .29, metalness: .21 }));
  const shrub = new THREE.MeshStandardMaterial({ color: 0x638052, roughness: .89 });
  const hall = new THREE.Group();
  scene.add(hall);
  const targets = [];
  const doors = [];
  const cube = (dims, pos, material = warmStone, parent = hall) => panel(parent, material, dims, pos);
  const flat = (x, z, w, d) => cube([w, .16, d], [x, -.1, z], paving);

  function wall(parent, y, width, height, opening = 0) {
    if (!opening) { cube([width, height, .35], [0, y + height / 2, 0], warmStone, parent); return; }
    const segment = width / 2 - opening;
    for (const side of [-1, 1]) cube([segment, height, .39], [side * (opening + segment / 2), y + height / 2, 0], warmStone, parent);
    cube([opening * 2, height - opening * .66 - 2.52, .40],
      [0, (height + opening * .66 + 2.52) / 2, 0], warmStone, parent);
  }

  function partition(x, z, angle, width, height, opening) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = angle;
    hall.add(group);
    wall(group, 0, width, height, opening);
    return group;
  }

  function placard(parent, text, y, z, reverse = false) {
    const canvas = Object.assign(document.createElement('canvas'), { width: 512, height: 120 });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e2028';
    ctx.fillRect(0, 0, 512, 120);
    ctx.strokeStyle = '#c69b61';
    ctx.lineWidth = 5;
    ctx.strokeRect(7, 7, 498, 106);
    ctx.fillStyle = '#fff0c7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '42px Georgia';
    ctx.fillText(text, 256, 61, 476);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(text.length > 13 ? 2.55 : 2.05, .46),
      new THREE.MeshBasicMaterial({ map, toneMapped: false, side: THREE.FrontSide }));
    sign.position.set(0, y, z);
    sign.rotation.y = reverse ? Math.PI : 0;
    parent.add(sign);
  }

  function door(index, width, height, material, labels, gate = false) {
    const [x, z, rotation, half] = thresholds[index];
    const parent = partition(x, z, rotation, width, height, half);
    const spring = gate ? 3.2 : 2.43;
    const casing = arch(parent, -.035, half, spring, shadowStone);
    casing.scale.y = gate ? 1.12 : 1;
    arch(parent, .22, half + .17, spring + .16, warmStone);
    for (const side of [-1, 1]) {
      cube([.22, spring, .5], [side * (half + .13), spring / 2, 0], shadowStone, parent);
      for (const y of [.22, spring - .10]) cube([.42, .15, .62], [side * (half + .13), y, 0], brass, parent);
    }
    placard(parent, labels[0], spring + half + .35, .30);
    placard(parent, labels[1], spring + half + .35, -.30, true);
    if (gate) {
      const grille = new THREE.Group();
      parent.add(grille);
      const iron = new THREE.MeshStandardMaterial({ color: 0x4c5053, metalness: .7, roughness: .68 });
      for (let bar = -7; bar <= 7; bar++) {
        const length = spring + 2.3 - Math.abs(bar) * .25;
        const post = cube([.124, length, .135], [bar * .47, length / 2, 0], iron, grille);
        post.userData.door = index;
        targets.push(post);
      }
      for (const y of [.55, 1.65, 2.65, 3.25]) cube([half * 1.94, .11, .17], [0, y, 0], iron, grille);
      doors.push({ x, z, grille, angle: 0, openUntil: 0, rooms: groups[index] });
      return;
    }
    const hinges = [-1, 1].map(side => {
      const pivot = new THREE.Group();
      pivot.position.x = side * (half - .03);
      parent.add(pivot);
      const leaf = cube([half - .06, spring, .13], [-side * half / 2, spring / 2, 0], material, pivot);
      const accent = gate ? .19 : .11;
      for (const y of [.37, spring - .32])
        cube([half * .93, accent, .18], [-side * half / 2, y, 0], brass, pivot);
      cube([.10, .24, .23], [-side * (half - .26), spring * .49, 0], brass, pivot);
      leaf.userData.door = index;
      targets.push(leaf);
      return { pivot, side };
    });
    doors.push({ x, z, hinges, angle: 0, openUntil: 0, rooms: groups[index] });
  }

  flat(0, 25.4, 22, 22.2);
  flat(0, 42.2, 7.45, 12.6);
  flat(-20, 24.6, 12.8, 14.85);
  flat(20, 24.6, 12.8, 14.85);
  flat(-12.4, 24, 3.7, 3.3);
  flat(12.4, 24, 3.8, 3.3);
  flat(20, 17, 3.4, 3.5);
  door(0, 22, 10.8, shadowStone, ['FORMYRIA', 'EXIT · BRIDGE'], true);
  door(1, 22, 10.8, oak, ['RIA’S LIBRARY', 'EXIT · CASTLE HALL']);
  door(2, 21.15, 8.0, indigo, ['ORRERY TOWER', 'EXIT · CASTLE HALL']);
  door(3, 21.15, 8.0, green, ['CONSERVATORY', 'EXIT · CASTLE HALL']);
  door(4, 12.85, 6, green, ['SUNSTONE COURT', 'EXIT · CONSERVATORY']);
  // A second cap closes the wide hall wall above each side passage.
  for (const x of [-10.9, 10.9]) {
    cube([.44, 3, 21.15], [x, 9.45, 25.4]);
    for (const z of [17.1, 20.5, 27.4, 33.8]) {
      cube([.77, 7.4, .73], [x * .974, 3.7, z], shadowStone);
      for (const y of [.19, 5.2, 7.22]) cube([.92, .23, .92], [x * .974, y, z]);
    }
  }
  for (const z of [16.0, 20.8, 25.6, 30.3, 35.15]) arch(hall, z, 10.5, 7.65, shadowStone);
  const vaultProfile = new THREE.Shape();
  vaultProfile.moveTo(-10.55, 7.58);
  vaultProfile.quadraticCurveTo(-10.25, 12.22, 0, 16.56);
  vaultProfile.quadraticCurveTo(10.25, 12.22, 10.55, 7.58);
  vaultProfile.lineTo(10.86, 7.58);
  vaultProfile.quadraticCurveTo(10.59, 12.63, 0, 16.98);
  vaultProfile.quadraticCurveTo(-10.59, 12.63, -10.86, 7.58);
  vaultProfile.closePath();
  const vault = new THREE.Mesh(new THREE.ExtrudeGeometry(vaultProfile, { depth: 21.7, bevelEnabled: false, curveSegments: 34 }), shadowStone);
  vault.position.z = 14.43;
  hall.add(vault);
  for (const x of [-7.4, 7.4]) {
    lancet(hall, x, 5.38, 14.73, 1.92, 3.72, glass);
    for (const side of [-1, 1]) {
      cube([.53, 4.97, .53], [x + side * 1.77, 2.495, 14.92], shadowStone);
      cube([.68, .27, .68], [x + side * 1.77, 5.02, 14.92]);
    }
  }
  for (const x of [-4.26, 4.26]) {
    cube([1.54, 3.07, .032], [x, 4.27, 14.94], brocade);
    cube([1.72, .055, .064], [x, 5.81, 14.98], brass);
    const crest = new THREE.Mesh(new THREE.RingGeometry(.32, .354, 6), brass);
    crest.position.set(x, 4.65, 14.977);
    crest.rotation.z = Math.PI / 6;
    hall.add(crest);
  }
  for (const z of [17.5, 23, 28.7, 34]) {
    cube([.11, .01, 5.2], [-1.55, .006, z], brass);
    cube([.11, .01, 5.2], [1.55, .006, z], brass);
  }
  cube([3.15, .015, 20.4], [0, .012, 25.4],
    new THREE.MeshStandardMaterial({ color: 0x483449, roughness: .94 }));
  for (const x of [-3.55, 3.55]) {
    cube([.39, 1.03, 12.8], [x, .49, 42.21], shadowStone);
    for (const z of [36.8, 42.4, 47.7]) {
      cube([.65, 1.41, .72], [x, .7, z], warmStone);
      cube([.81, .15, .81], [x, 1.46, z], shadowStone);
      lamp(hall, x, 1.5, z, 0);
    }
    const tower = cube([3.18, 12.6, 3.95], [x * 1.49, 6.3, 36], warmStone);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.43, 4.65, 4), shadowStone);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(tower.position.x, 14.8, tower.position.z);
    hall.add(roof);
  }

  function sideRoom(side) {
    const x = 20 * side;
    partition(x, 31.94, 0, 13.0, 8.1);
    if (side < 0) partition(x, 17.29, 0, 13.0, 8.1);
    partition(side * 26.65, 24.62, Math.PI / 2, 14.85, 8.1);
    partition(side * 14.04, 24.0, Math.PI / 2, 14.93, 8.05, 1.53);
    for (const z of [17.58, 21.25, 27.42, 31.72]) {
      cube([.62, 5.65, .62], [side * 26.28, 2.83, z], shadowStone);
      cube([.62, 5.65, .62], [side * 14.18, 2.83, z], shadowStone);
    }
    const ribs = new THREE.Group();
    ribs.position.x = x;
    hall.add(ribs);
    for (const z of [18, 22, 26.9, 31.56]) arch(ribs, z, 6.16, 5.77, shadowStone);
    cube([13.2, .28, 14.91], [x, 9.31, 24.67], shadowStone);
    const windows = new THREE.Group();
    windows.rotation.y = side * -Math.PI / 2;
    windows.position.set(side * 26.41, 0, 24.78);
    hall.add(windows);
    for (const offset of [-4.35, -.52, 3.2]) lancet(windows, offset, 4.49, 0, 1.21, 3.3, glass);
    lamp(hall, side * 25.3, .99, 27.7, 0);
  }
  sideRoom(-1);
  sideRoom(1);

  cube([3.4, .39, 2.45], [-20, .195, 24], shadowStone);
  const mechanism = new THREE.Group();
  mechanism.position.set(-20, 2.15, 24);
  hall.add(mechanism);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(.72, 36, 24), new THREE.MeshStandardMaterial({
    color: 0x5b90bc, emissive: 0x234d71, emissiveIntensity: .34, metalness: .6, roughness: .23,
  }));
  mechanism.add(globe);
  for (let i = 0; i < 3; i++) {
    const circle = new THREE.Mesh(new THREE.TorusGeometry(1.05 + i * .21, .038, 12, 63), brass);
    circle.rotation.set(.38 + i * .77, i * .83, .21);
    mechanism.add(circle);
  }
  const instrument = cube([1.15, 1.04, .62], [-18.45, .52, 26.0], oak);
  instrument.userData.activity = 'orrery';
  targets.push(instrument);

  const leafClock = () => ((seed.value = (1664525 * seed.value + 1013904223) >>> 0) / 4294967296);
  const leafGeometry = new THREE.SphereGeometry(1, 7, 4);
  const plants = new THREE.InstancedMesh(leafGeometry, shrub, 128);
  const leaf = new THREE.Object3D();
  const planters = [[16.66, 26.34], [23.87, 22.23], [25.18, 27.61], [15.68, 20.52]];
  planters.forEach(([x, z], index) => {
    cube([1.24, .59, 1.45], [x, .3, z], shadowStone);
    for (let i = 0; i < 32; i++) {
      const angle = leafClock() * Math.PI * 2;
      const radius = .22 + leafClock() * .47;
      leaf.position.set(x + Math.cos(angle) * radius, .61 + leafClock() * .69, z + Math.sin(angle) * radius);
      leaf.rotation.set(leafClock(), angle, leafClock());
      leaf.scale.set(.09, .04, .2 + leafClock() * .30);
      leaf.updateMatrix();
      plants.setMatrixAt(index * 32 + i, leaf.matrix);
    }
  });
  hall.add(plants);
  const bench = cube([1.25, .93, .64], [16.67, .47, 26.35], oak);
  bench.userData.activity = 'conservatory';
  targets.push(bench);

  const hallLight = new THREE.PointLight(0xffd8a4, 36, 20, 1.43);
  hallLight.position.set(0, 6.5, 26);
  scene.add(hallLight);
  const towerLight = new THREE.PointLight(0x9ebefc, 31, 15, 1.42);
  towerLight.position.set(-20, 4.45, 24);
  scene.add(towerLight);
  const plantLight = new THREE.PointLight(0xefc78c, 31, 15, 1.44);
  plantLight.position.set(20, 4.45, 24);
  scene.add(plantLight);

  return {
    targets,
    doors,
    update(player, time, delta, reduced) {
      mechanism.rotation.y = reduced ? 0 : time * .00019;
      for (const door of doors) {
        const open = time < door.openUntil || Math.hypot(player.x - door.x, player.z - door.z) < (door.grille ? 4.8 : 2.85);
        const goal = open ? 1.43 : 0;
        door.angle = reduced ? goal : THREE.MathUtils.lerp(door.angle, goal, 1 - Math.exp(-8 * delta));
        if (door.grille) door.grille.position.y = door.angle * 2.6;
        else for (const { pivot, side } of door.hinges) pivot.rotation.y = door.angle * side;
      }
    },
  };
}
