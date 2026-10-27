import { smoothPhoneSurfaceNormals } from './phone-surface-normals.mjs';

// Geometry-only, Z-up electronics architecture. The central phone bay is open.
// The rear core stays left of the framed phone's X bound -2.06.
export function createPhoneLabStage({ THREE, scene, ownGeometry, materials, textures }) {
  const root = new THREE.Group();
  root.name = 'Layered electronics architecture';
  scene.add(root);
  const floorZ = -.94, foundationTop = -.80;
  const material = options => {
    const value = new THREE.MeshStandardMaterial(options);
    materials.add(value);
    return value;
  };
  const floor = material({ color: 0xf5f9ff, roughness: .70, metalness: .02, emissive: 0xc9e2f1, emissiveIntensity: .10 });
  const porcelain = material({ color: 0xf8fbff, roughness: .43, metalness: .12 });
  const ceramicWhite = material({ color: 0xf3f8ff, roughness: .48, metalness: .05 });
  const silver = material({ color: 0xd3dfe8, roughness: .34, metalness: 1 });
  const darkSilver = material({ color: 0x7593aa, roughness: .39, metalness: .85 });
  const graphite = material({ color: 0x101d2b, roughness: .44, metalness: .16 });
  const chipTop = material({ color: 0x1b2c3d, roughness: .53, metalness: .12 });
  const gold = material({ color: 0xc5a267, roughness: .30, metalness: 1 });
  const capacitor = material({ color: 0x8c8573, roughness: .58, metalness: .08 });
  const navy = material({ color: 0x06375e, roughness: .37, metalness: .44 });
  const blue = material({ color: 0x034aaf, roughness: .31, metalness: .35, emissive: 0x0075ff, emissiveIntensity: 1.85 });
  const cyan = material({ color: 0x008fb4, roughness: .29, metalness: .28, emissive: 0x00b9ed, emissiveIntensity: 2.35 });
  const pulseMaterial = material({ color: 0x008fb8, roughness: .30, metalness: .14, emissive: 0x00d1ff, emissiveIntensity: 3.0 });
  const batches = new Map();
  const unitBox = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const unitCylinder = ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 16).rotateX(Math.PI / 2));
  const unitRing = ownGeometry(new THREE.TorusGeometry(1, .16, 5, 18));
  const shape = new THREE.Shape();
  const r = .035, side = .98, a = -side / 2, b = side / 2;
  shape.moveTo(a + r, a); shape.lineTo(b - r, a);
  shape.quadraticCurveTo(b, a, b, a + r); shape.lineTo(b, b - r);
  shape.quadraticCurveTo(b, b, b - r, b); shape.lineTo(a + r, b);
  shape.quadraticCurveTo(a, b, a, b - r); shape.lineTo(a, a + r);
  shape.quadraticCurveTo(a, a, a + r, a);
  const roundedGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: .98, steps: 1, curveSegments: 6, bevelEnabled: true,
    bevelSize: .01, bevelThickness: .01, bevelSegments: 3,
  });
  roundedGeometry.translate(0, 0, -.49);
  const unitRounded = ownGeometry(smoothPhoneSurfaceNormals(roundedGeometry));
  const geometries = { box: unitBox, rounded: unitRounded, cylinder: unitCylinder, ring: unitRing };
  const transform = new THREE.Object3D();

  function item(kind, surface, x, y, z, sx, sy, sz, rotation = 0) {
    const key = kind + ':' + surface.uuid;
    let batch = batches.get(key);
    if (!batch) batches.set(key, batch = { geometry: geometries[kind], surface, items: [] });
    batch.items.push({ x, y, z, sx, sy, sz, rotation });
  }
  function box(surface, x, y, bottom, w, h, d, rounded = false, rotation = 0) {
    item(rounded ? 'rounded' : 'box', surface, x, y, bottom + d / 2, w, h, d, rotation);
  }
  function post(surface, x, y, bottom, radius, h) {
    item('cylinder', surface, x, y, bottom + h / 2, radius, radius, h);
  }
  function via(x, y, z, radius = .037) {
    item('ring', gold, x, y, z, radius, radius, .020);
  }
  function trace(surface, x1, y1, x2, y2, z, width = .024) {
    box(surface, (x1 + x2) / 2, (y1 + y2) / 2, z, Math.hypot(x2 - x1, y2 - y1), width, .009, false, Math.atan2(y2 - y1, x2 - x1));
  }
  const ground = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(200, 200)), floor);
  ground.position.z = floorZ; ground.receiveShadow = true; root.add(ground);

  // One connected foundation, with the central phone bay kept completely open.
  box(porcelain, 5.7, 0, floorZ + .02, 6.2, 14.0, .12, true);
  box(porcelain, 0, 5.55, floorZ + .02, 5.6, 2.9, .12, true);
  box(porcelain, 1.0, -5.85, floorZ + .02, 7.6, 2.15, .12, true);
  box(porcelain, -4.7, 5.3, floorZ + .02, 3.85, 3.45, .12, true);

  function board(x, y, w, h, bottom = foundationTop + .035) {
    box(porcelain, x, y, bottom, w, h, .11, true);
    box(navy, x, y, bottom + .110, w * .985, h * .985, .035, true);
    box(cyan, x, y, bottom + .145, w * .978, h * .978, .027, true);
    box(ceramicWhite, x, y, bottom + .172, w * .972, h * .972, .08, true);
    const top = bottom + .252;
    for (const sign of [-1, 1]) {
      for (let i = 0; i < Math.floor(w / .23); i++) via(x - w / 2 + .18 + i * .23, y + sign * (h / 2 - .13), top + .012, .028);
      for (let i = 0; i < Math.floor(h / .25); i++) via(x + sign * (w / 2 - .13), y - h / 2 + .18 + i * .25, top + .012, .028);
      post(silver, x + sign * (w / 2 - .18), y - h / 2 + .18, top, .052, .025);
      post(silver, x + sign * (w / 2 - .18), y + h / 2 - .18, top, .052, .025);
    }
    return top;
  }
  function qfp(x, y, z, w, h, depth = .14, count = 8) {
    box(navy, x, y, z + .002, w + .16, h + .16, .026, true);
    box(graphite, x, y, z + .026, w, h, depth, true);
    box(chipTop, x, y, z + .026 + depth, w * .86, h * .86, .012, true);
    for (const sign of [-1, 1]) for (let i = 0; i < count; i++) {
      const yy = y + (i - (count - 1) / 2) * (h - .08) / count;
      const xx = x + (i - (count - 1) / 2) * (w - .08) / count;
      box(gold, x + sign * (w / 2 + .035), yy, z + .010, .11, .028, .035);
      box(gold, xx, y + sign * (h / 2 + .035), z + .010, .028, .11, .035);
    }
  }
  function fins(x, y, z, w, h, n = 14) {
    box(silver, x, y, z + .006, w, h, .045, true);
    for (let i = 0; i < n; i++) box(i % 4 ? silver : darkSilver, x - w * .44 + i * w * .88 / (n - 1), y, z + .051, w * .025, h * .94, .28);
  }
  function rf(x, y, z, w, h, depth = .18) {
    box(darkSilver, x, y, z + .004, w + .045, h + .045, .035, true);
    box(silver, x, y, z + .039, w, h, depth, true);
    box(porcelain, x, y, z + .039 + depth, w * .92, h * .92, .012, true);
    for (let i = 0; i < 5; i++) box(graphite, x - w * .31 + i * w * .155, y + h * .25, z + .053 + depth, .018, .055, .004);
  }
  function passives(x, y, z, count, dx = .16, dy = 0) {
    for (let i = 0; i < count; i++) {
      const xx = x + i * dx, yy = y + i * dy;
      box(capacitor, xx, yy, z + .009, .085, .11, .060, true);
      box(silver, xx, yy - .052, z + .005, .092, .027, .065);
      box(silver, xx, yy + .052, z + .005, .092, .027, .065);
    }
  }

  const rightTop = board(5.65, .35, 5.1, 3.3);
  fins(4.2, .60, rightTop, 1.3, 1.65, 15);
  qfp(6.35, .62, rightTop, 1.02, 1.06, .16, 10);
  qfp(7.45, -.48, rightTop, .50, .46, .11, 5);
  rf(7.45, 1.23, rightTop, .60, .64);
  passives(3.42, -.80, rightTop, 12, .28);
  passives(7.78, -.52, rightTop, 8, 0, .27);
  trace(gold, 5.15, 1.65, 6.7, 1.65, rightTop + .005);
  trace(navy, 5.2, -.65, 5.75, -.65, rightTop + .005, .035);

  const rearTop = board(.10, 5.55, 4.4, 2.5);
  qfp(-.37, 5.65, rearTop, 1.00, 1.00, .15, 9);
  qfp(-1.45, 5.55, rearTop, .45, .70, .10, 6);
  fins(1.20, 5.58, rearTop, .83, 1.20, 10);
  rf(.30, 6.37, rearTop, .55, .35, .12);
  passives(-1.60, 4.65, rearTop, 15, .26);
  trace(gold, -1.55, 6.15, -1.15, 6.15, rearTop + .004);

  const frontTop = board(1.75, -5.85, 4.7, 2.1);
  fins(.15, -5.77, frontTop, 1.05, 1.15, 12);
  qfp(1.78, -5.74, frontTop, .85, .82, .14, 8);
  rf(3.33, -5.67, frontTop, .76, .65, .15);
  passives(-.12, -6.57, frontTop, 15, .26);

  const frontRightTop = board(7.30, -4.65, 2.75, 3.8);
  qfp(7.25, -3.55, frontRightTop, 1.02, .96, .16, 9);
  fins(7.35, -5.45, frontRightTop, 1.60, 1.08, 17);
  passives(6.28, -5.98, frontRightTop, 11, 0, .28);
  const farTop = board(8.0, 4.9, 1.60, 2.8);
  qfp(8.0, 4.43, farTop, .62, .76, .13, 6);
  fins(8.0, 5.64, farTop, .80, .76, 9);

  // A supported three-level processor structure behind and to the right.
  const coreX = -4.70, coreY = 5.30, coreBase = board(coreX, coreY, 3.60, 3.2);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) post(silver, coreX + sx * 1.35, coreY + sy * 1.15, coreBase, .09, .25);
  const middle = board(coreX, coreY, 2.95, 2.65, coreBase + .25);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) post(silver, coreX + sx * .94, coreY + sy * .94, middle, .075, .22);
  const upper = board(coreX, coreY, 2.22, 2.22, middle + .22);
  qfp(coreX, coreY, upper, 1.23, 1.23, .20, 12);
  box(silver, coreX, coreY, upper + .238, 1.14, 1.14, .055, true);
  box(cyan, coreX, coreY, upper + .293, .91, .91, .026, true);
  box(blue, coreX, coreY, upper + .319, .77, .77, .035, true);
  box(cyan, coreX, coreY, upper + .354, .52, .52, .014, true);
  const latticeZ = upper + .52;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) post(silver, coreX + sx * .93, coreY + sy * .93, upper, .045, .50);
  for (const sign of [-1, 1]) {
    box(silver, coreX, coreY + sign, latticeZ, 2.10, .075, .055, true);
    box(silver, coreX + sign, coreY, latticeZ, .075, 2.10, .055, true);
  }
  for (let i = -3; i <= 3; i++) {
    const offset = i * .29, low = Math.max(-.95, -.95 - offset), high = Math.min(.95, .95 - offset);
    trace(silver, coreX + low, coreY + low + offset, coreX + high, coreY + high + offset, latticeZ + .015, .025);
    trace(silver, coreX + low, coreY - low - offset, coreX + high, coreY - high - offset, latticeZ + .015, .025);
  }
  fins(coreX - 1.27, coreY, coreBase, .53, 1.20, 8);
  passives(coreX - .70, coreY - 1.34, coreBase, 7, .22);
  passives(coreX + 1.31, coreY - .55, coreBase, 6, 0, .22);

  function routeCurve(points, radius = .32) {
    const curve = new THREE.CurvePath();
    const vertices = points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    let previousPoint = vertices[0];
    for (let i = 1; i < vertices.length - 1; i++) {
      const corner = vertices[i], before = vertices[i - 1], after = vertices[i + 1];
      const trim = Math.min(radius, corner.distanceTo(before) * .35, corner.distanceTo(after) * .35);
      const entry = corner.clone().add(before.clone().sub(corner).normalize().multiplyScalar(trim));
      const exit = corner.clone().add(after.clone().sub(corner).normalize().multiplyScalar(trim));
      curve.add(new THREE.LineCurve3(previousPoint, entry));
      curve.add(new THREE.QuadraticBezierCurve3(entry, corner, exit)); previousPoint = exit;
    }
    curve.add(new THREE.LineCurve3(previousPoint, vertices[vertices.length - 1]));
    return curve;
  }
  function offsetPoints(points, offset) {
    return points.map((p, index) => {
      let before = index - 1, after = index + 1;
      while (before >= 0 && Math.hypot(p[0] - points[before][0], p[1] - points[before][1]) < 1e-6) before--;
      while (after < points.length && Math.hypot(points[after][0] - p[0], points[after][1] - p[1]) < 1e-6) after++;
      const prev = before >= 0 ? points[before] : p, nextPoint = after < points.length ? points[after] : p;
      let ax = p[0] - prev[0], ay = p[1] - prev[1], bx = nextPoint[0] - p[0], by = nextPoint[1] - p[1];
      const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);
      if (al) { ax /= al; ay /= al; } else if (bl) { ax = bx / bl; ay = by / bl; } else { ax = 1; ay = 0; }
      if (bl) { bx /= bl; by /= bl; } else { bx = ax; by = ay; }
      let nx = -ay - by, ny = ax + bx, length = Math.hypot(nx, ny);
      if (length < 1e-6) { nx = -ay; ny = ax; length = 1; }
      nx /= length; ny /= length;
      const miter = offset / Math.max(.55, nx * -ay + ny * ax);
      return [p[0] + nx * miter, p[1] + ny * miter, p[2]];
    });
  }
  function mergeGeometry(parts) {
    let vertexCount = 0, indexCount = 0;
    for (const part of parts) { vertexCount += part.attributes.position.count; indexCount += part.index.count; }
    const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
    const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let vertex = 0, index = 0;
    for (const part of parts) {
      positions.set(part.attributes.position.array, vertex * 3); normals.set(part.attributes.normal.array, vertex * 3); uvs.set(part.attributes.uv.array, vertex * 2);
      for (let i = 0; i < part.index.count; i++) indices[index++] = part.index.array[i] + vertex;
      vertex += part.attributes.position.count; part.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere(); return ownGeometry(geometry);
  }
  const routes = [
    { lanes: 8, p: [[coreX+1.80,5.65,-.60],[-2.65,5.65,-.64],[-2.35,5.65,-.64],[-2.10,5.65,-.60]] },
    { lanes: 12, p: [[2.30,4.85,-.60],[2.80,4.85,-.60],[3.45,4.85,-.60],[4.35,3.50,-.60],[5.10,2.00,-.60]] },
    { lanes: 10, p: [[6.85,-1.29,-.60],[6.85,-1.65,-.64],[7.75,-2.32,-.64],[7.75,-2.75,-.60]] },
    { lanes: 10, p: [[5.94,-5.45,-.60],[5.42,-5.45,-.64],[4.75,-5.80,-.64],[4.10,-5.80,-.60]] },
    { lanes: 8, p: [[8.50,-6.75,-.68],[7.65,-6.75,-.68],[7.20,-6.50,-.60]] },
    { lanes: 10, p: [[8.79,-.20,-.64],[8.45,-.20,-.64],[8.10,.05,-.60]] },
    { lanes: 6, p: [[2.30,6.10,-.60],[3.35,6.75,-.60],[6.20,6.75,-.60],[7.22,5.15,-.60]] },
    { lanes: 10, p: [[-2.75,-6.15,-.68],[-1.85,-6.15,-.68],[-1.35,-5.80,-.68],[-.60,-5.80,-.60]] },
    { lanes: 8, p: [[-2.55,7.52,-.68],[-1.20,7.52,-.68],[-.60,7.0,-.68],[-.60,6.80,-.60]] },
  ];
  const pulseLanes = [];
  routes.forEach((route, routeIndex) => {
    const insulation = [], blueLines = [], cyanLines = [], pitch = .095;
    for (let lane = 0; lane < route.lanes; lane++) {
      const points = offsetPoints(route.p, (lane - (route.lanes - 1) / 2) * pitch);
      const curve = routeCurve(points);
      const segments = Math.max(32, Math.min(80, Math.ceil(curve.getLength() * 12)));
      insulation.push(new THREE.TubeGeometry(curve, segments, .048, 5, false));
      const brightPoints = points.map(p => [p[0], p[1], p[2] + .024]);
      const brightCurve = routeCurve(brightPoints);
      (lane % 2 === 0 ? blueLines : cyanLines).push(new THREE.TubeGeometry(brightCurve, segments, .030, 5, false));
      if (lane % 2 === 0) {
        const samples = brightCurve.getSpacedPoints(80), lengths = [0];
        for (let i = 1; i < samples.length; i++) lengths.push(lengths[i - 1] + samples[i].distanceTo(samples[i - 1]));
        pulseLanes.push({ samples, lengths, length: lengths[lengths.length - 1], routeIndex, lane });
      }
    }
    for (const [parts, surface] of [[insulation, navy], [blueLines, blue], [cyanLines, cyan]]) if (parts.length) {
      const object = new THREE.Mesh(mergeGeometry(parts), surface); object.receiveShadow = true; object.castShadow = true; root.add(object);
    }
    for (const end of [0, route.p.length - 1]) {
      const point = route.p[end], neighbour = route.p[end === 0 ? 1 : end - 1];
      const angle = Math.atan2(point[1] - neighbour[1], point[0] - neighbour[0]);
      box(graphite, point[0], point[1], point[2] - .075, .17, route.lanes * pitch + .10, .15, true, angle);
      for (let lane = 0; lane < route.lanes; lane++) {
        const offset = (lane - (route.lanes - 1) / 2) * pitch;
        box(gold, point[0] - Math.sin(angle) * offset, point[1] + Math.cos(angle) * offset, point[2] + .073, .19, .036, .009, false, angle);
      }
    }
  });

  for (const batch of batches.values()) {
    const object = new THREE.InstancedMesh(batch.geometry, batch.surface, batch.items.length);
    for (let i = 0; i < batch.items.length; i++) {
      const v = batch.items[i]; transform.position.set(v.x, v.y, v.z); transform.rotation.set(0, 0, v.rotation); transform.scale.set(v.sx, v.sy, v.sz); transform.updateMatrix(); object.setMatrixAt(i, transform.matrix);
    }
    object.instanceMatrix.needsUpdate = true; object.castShadow = true; object.receiveShadow = true; root.add(object);
  }
  const pulseGeometry = ownGeometry(new THREE.SphereGeometry(1, 8, 6));
  const pulses = new THREE.InstancedMesh(pulseGeometry, pulseMaterial, pulseLanes.length * 3);
  pulses.frustumCulled = false; root.add(pulses);
  const point = new THREE.Vector3(), tangent = new THREE.Vector3(), along = new THREE.Vector3(1, 0, 0);
  function update(time = 0) {
    const now = Number.isFinite(time) ? time : 0;
    let index = 0;
    for (const lane of pulseLanes) for (let tail = 0; tail < 3; tail++) {
      const distance = ((now * (1.05 + lane.routeIndex * .045) - tail * .23 + lane.routeIndex * .81) % lane.length + lane.length) % lane.length;
      let segment = 1;
      while (segment < lane.lengths.length - 1 && lane.lengths[segment] < distance) segment++;
      const start = lane.samples[segment - 1], end = lane.samples[segment];
      point.copy(start).lerp(end, (distance - lane.lengths[segment - 1]) / Math.max(.000001, lane.lengths[segment] - lane.lengths[segment - 1])); point.z += .022;
      tangent.copy(end).sub(start).normalize(); transform.position.copy(point); transform.quaternion.setFromUnitVectors(along, tangent);
      const fade = 1 - tail * .25; transform.scale.set(.16 * fade, .037 * fade, .024 * fade); transform.updateMatrix(); pulses.setMatrixAt(index++, transform.matrix);
    }
    pulses.instanceMatrix.needsUpdate = true;
  }
  root.userData.electronicsStage = { boards: 8, bundles: routes.length, lanes: routes.reduce((n, route) => n + route.lanes, 0), coreX, coreY };
  update(0);
  return { root, update };
}
