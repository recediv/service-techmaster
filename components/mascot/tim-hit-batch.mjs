import { Scene, Mesh, BufferGeometry, BufferAttribute, DynamicDrawUsage } from 'three';

// One mask draw with the original visible triangles. The character's exact
// geometry, including moving hands, helmet and car, remains the input surface.
export function createTimHitBatch(root, material, excludedRoots = []) {
  const excluded = new Set(excludedRoots), records = [];
  let vertexCount = 0, indexCount = 0, updates = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (let node = mesh; node; node = node.parent) if (excluded.has(node)) return;
    const position = mesh.geometry.attributes.position, sourceIndex = mesh.geometry.index;
    const count = sourceIndex?.count || position.count;
    records.push({ mesh, position, sourceIndex, offset: vertexCount, count });
    vertexCount += position.count; indexCount += count;
  });
  const positions = new Float32Array(vertexCount * 3), indices = new Uint32Array(indexCount);
  const position = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
  const index = new BufferAttribute(indices, 1).setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', position); geometry.setIndex(index); geometry.setDrawRange(0, 0);
  const mesh = new Mesh(geometry, material), scene = new Scene();
  mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; scene.add(mesh);
  let lastKey = '', visibleVertices = 0, visibleTriangles = 0;
  return {
    scene,
    update(hiddenRoots = []) {
      root.updateMatrixWorld(true);
      const active = [];
      let first = 2166136261, second = 5381;
      const hash = value => { first = Math.imul(first ^ value, 16777619); second = Math.imul(second, 33) ^ value; };
      for (let i = 0; i < records.length; i++) {
        const record = records[i]; let visible = true;
        for (let node = record.mesh; node; node = node.parent) if (!node.visible || hiddenRoots.includes(node)) { visible = false; break; }
        if (!visible) continue;
        hash(i + 1);
        const matrix = record.mesh.matrixWorld.elements;
        for (const j of [0,1,2,4,5,6,8,9,10,12,13,14]) hash(Math.round(matrix[j] / (j >= 12 ? 4 : .005)));
        active.push(record);
      }
      const key = (first >>> 0) + ':' + (second >>> 0);
      if (key === lastKey) return { key, changed: false };
      lastKey = key; updates++; visibleVertices = 0;
      position.clearUpdateRanges();
      let cursor = 0;
      for (const record of active) {
        const p = record.position, e = record.mesh.matrixWorld.elements, offset = record.offset;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), j = (offset + i) * 3;
          positions[j] = e[0]*x + e[4]*y + e[8]*z + e[12];
          positions[j+1] = e[1]*x + e[5]*y + e[9]*z + e[13];
          positions[j+2] = e[2]*x + e[6]*y + e[10]*z + e[14];
        }
        position.addUpdateRange(offset * 3, p.count * 3); visibleVertices += p.count;
        const source = record.sourceIndex, flip = record.mesh.matrixWorld.determinant() < 0;
        for (let i = 0; i < record.count; i += 3) {
          const a = source ? source.getX(i) : i, b = source ? source.getX(i+1) : i+1, c = source ? source.getX(i+2) : i+2;
          indices[cursor++] = offset + a; indices[cursor++] = offset + (flip ? c : b); indices[cursor++] = offset + (flip ? b : c);
        }
      }
      position.needsUpdate = true; index.clearUpdateRanges(); index.addUpdateRange(0, cursor); index.needsUpdate = true;
      geometry.setDrawRange(0, cursor); visibleTriangles = cursor / 3;
      return { key, changed: true };
    },
    getStats() { return { updates, visibleVertices, visibleTriangles, drawCalls: 1 }; },
    dispose() { geometry.dispose(); scene.clear(); records.length = 0; },
  };
}
