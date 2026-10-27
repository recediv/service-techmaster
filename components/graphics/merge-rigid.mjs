import { Matrix4, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merge only opaque, immutable siblings. Moving parent rigs stay independent.
// Small fixed instances can be baked into the same material batch; this does
// not require WEBGL_multi_draw on older hardware.
export function mergeRigidMeshes(root, ownGeometry) {
  let sources = 0, batches = 0;
  const instance = new Matrix4(), transform = new Matrix4();
  const groups = [];
  root.traverse(parent => { if (parent.children.length > 1) groups.push(parent); });
  for (const parent of groups) {
    const byMaterial = new Map();
    for (const mesh of parent.children) {
      const material = mesh.material, geometry = mesh.geometry;
      if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.children.length || !mesh.visible ||
          mesh.userData.dynamicTransform || mesh.userData.dynamicGeometry || mesh.userData.dynamicVisibility ||
          Array.isArray(material) || !material || material.transparent ||
          mesh.instanceColor || Object.keys(geometry.morphAttributes).length ||
          geometry.drawRange.start || geometry.drawRange.count !== Infinity) continue;
      // All attributes must match. Keep indexed/non-indexed source shapes as-is
      // until baking so no material groups are introduced into the final draw.
      const attributes = Object.entries(geometry.attributes).map(([name, a]) => `${name}:${a.itemSize}:${a.normalized}`).sort().join('|');
      const key = [material.id, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, mesh.layers.mask, attributes].join(':');
      if (!byMaterial.has(key)) byMaterial.set(key, []);
      byMaterial.get(key).push(mesh);
    }
    for (const list of byMaterial.values()) {
      if (list.length < 2) continue;
      const pieces = [];
      for (const mesh of list) {
        mesh.updateMatrix();
        const count = mesh.isInstancedMesh ? mesh.count : 1;
        for (let i = 0; i < count; i++) {
          if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, instance); transform.multiplyMatrices(mesh.matrix, instance); }
          else transform.copy(mesh.matrix);
          const piece = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
          piece.applyMatrix4(transform);
          pieces.push(piece);
        }
      }
      const geometry = mergeGeometries(pieces, false);
      pieces.forEach(piece => piece.dispose());
      if (!geometry) continue;
      ownGeometry(geometry);
      geometry.computeBoundingSphere();
      const first = list[0], merged = new Mesh(geometry, first.material);
      merged.name = `Rigid ${first.material.name || first.material.type} batch`;
      merged.castShadow = first.castShadow; merged.receiveShadow = first.receiveShadow;
      merged.renderOrder = first.renderOrder; merged.layers.mask = first.layers.mask;
      merged.userData.sourceNames = list.map(mesh => mesh.name);
      merged.updateMatrix(); merged.matrixAutoUpdate = false;
      list.forEach(mesh => parent.remove(mesh)); parent.add(merged);
      sources += list.length; batches++;
    }
  }
  return { sources, batches };
}
