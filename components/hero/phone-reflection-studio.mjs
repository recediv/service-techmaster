// A small reflection studio, rendered once into PMREM. It never enters the hero.
export function createPhoneReflectionStudio(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9aaab8);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials = [];
  const origin = new THREE.Vector3();
  function panel(width, height, position, rgb, turn = 0) {
    const surface = new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide, toneMapped: false });
    materials.push(surface);
    const plane = new THREE.Mesh(geometry, surface);
    plane.position.set(...position);
    plane.scale.set(width, height, 1);
    plane.lookAt(origin);
    plane.rotateZ(turn);
    scene.add(plane);
  }
  panel(18, 12, [-6, 7, 12], [1.12, 1.16, 1.20]);
  panel(16, 16, [8, -5, 9], [.62, .74, .88]);
  panel(16, 12, [0, -12, 4], [.18, .22, .28]);
  // Broad coloured bounce gives metal a cool edge without pin-sized hot spots.
  panel(14, 8, [7, 9, 3], [.045, .34, .56]);
  panel(12, 8, [-9, -5, 4], [.34, .12, .075]);
  return { scene, dispose() { geometry.dispose(); for (const material of materials) material.dispose(); scene.clear(); } };
}
