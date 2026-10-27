let support;

export function inspectGraphicsContext(gl) {
  if (!gl || gl.isContextLost()) return { mode: 'static', reason: 'webgl2-unavailable' };
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  // A software driver can accept failIfMajorPerformanceCaveat (e.g. SwANGLE).
  // Do not start either continuous 3D scene on a CPU renderer.
  const software = /swiftshader|llvmpipe|softpipe|lavapipe|software (?:renderer|rasterizer)|microsoft basic render|mesa offscreen/i.test(renderer);
  return software ? { mode: 'static', reason: 'software-renderer' } : { mode: 'webgl', reason: 'webgl2-available' };
}

// One short-lived probe per document, before importing either Three.js scene.
export function readGraphicsSupport() {
  if (support) return support;
  if (typeof document === 'undefined') return { mode: 'static', reason: 'no-document' };
  let gl;
  try {
    gl = document.createElement('canvas').getContext('webgl2', {
      failIfMajorPerformanceCaveat: true, powerPreference: 'low-power', antialias: false, depth: false,
    });
    support = inspectGraphicsContext(gl);
  } catch {
    support = { mode: 'static', reason: 'webgl2-unavailable' };
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return support;
}
