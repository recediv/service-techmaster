// ExtrudeGeometry is non-indexed: its default normals stop at every triangle.
// Smooth only compatible faces at the same position, retaining UV seams and
// genuinely sharp corners. Horizontal cap triangles remain exactly planar.
export function smoothPhoneSurfaceNormals(geometry, {
  creaseAngle = 40 * Math.PI / 180,
  positionTolerance = 1e-6,
} = {}) {
  const position = geometry.getAttribute('position');
  if (!position || geometry.index || position.count % 3 !== 0) return geometry;
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const normal = geometry.getAttribute('normal');
  const faceCount = position.count / 3;
  const crosses = new Float64Array(faceCount * 3);
  const inverseLengths = new Float64Array(faceCount);
  const groups = new Map();
  const tolerance = Number.isFinite(positionTolerance) && positionTolerance > 0 ? positionTolerance : 1e-6;
  const quantize = 1 / tolerance;
  const cosine = Math.cos(Math.max(0, Math.min(Math.PI, creaseAngle)));

  for (let face = 0; face < faceCount; face++) {
    const i = face * 3;
    const ax = position.getX(i), ay = position.getY(i), az = position.getZ(i);
    const ux = position.getX(i + 1) - ax, uy = position.getY(i + 1) - ay, uz = position.getZ(i + 1) - az;
    const vx = position.getX(i + 2) - ax, vy = position.getY(i + 2) - ay, vz = position.getZ(i + 2) - az;
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    crosses[i] = x; crosses[i + 1] = y; crosses[i + 2] = z;
    const length = Math.hypot(x, y, z);
    inverseLengths[face] = length > 1e-16 ? 1 / length : 0;
    for (let corner = 0; corner < 3; corner++) {
      const index = i + corner;
      const key = `${Math.round(position.getX(index) * quantize)},${Math.round(position.getY(index) * quantize)},${Math.round(position.getZ(index) * quantize)}`;
      let group = groups.get(key);
      if (!group) groups.set(key, group = []);
      group.push(index);
    }
  }

  for (const group of groups.values()) {
    for (const index of group) {
      const face = Math.floor(index / 3), offset = face * 3, inverseLength = inverseLengths[face];
      if (!inverseLength) continue;
      const nx = crosses[offset] * inverseLength, ny = crosses[offset + 1] * inverseLength, nz = crosses[offset + 2] * inverseLength;
      // Never interpolate the large flat top/bottom caps toward their bevel.
      if (Math.abs(nx) < 1e-6 && Math.abs(ny) < 1e-6 && Math.abs(Math.abs(nz) - 1) < 1e-6) {
        normal.setXYZ(index, 0, 0, nz < 0 ? -1 : 1);
        continue;
      }
      let x = 0, y = 0, z = 0;
      for (const otherIndex of group) {
        const otherFace = Math.floor(otherIndex / 3), other = otherFace * 3, inv = inverseLengths[otherFace];
        if (!inv) continue;
        const dot = (nx * crosses[other] + ny * crosses[other + 1] + nz * crosses[other + 2]) * inv;
        if (dot + 1e-8 < cosine) continue;
        // The cross product supplies triangle-area weighting without another
        // normalization, so tiny corner triangles cannot dominate long faces.
        x += crosses[other]; y += crosses[other + 1]; z += crosses[other + 2];
      }
      const length = Math.hypot(x, y, z);
      if (length > 1e-16) normal.setXYZ(index, x / length, y / length, z / length);
    }
  }
  normal.needsUpdate = true;
  return geometry;
}
