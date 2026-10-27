// The artwork has a fixed maximum display size; a wider page adds no detail.
export const REPAIR_STAGE_WIDTH = 1440;
export const REPAIR_RENDER_WIDTH = 800;
export const REPAIR_RENDER_HEIGHT = 560;

export function repairLabWindow(hostWidth, hostHeight) {
  const width = Math.max(0, Math.min(REPAIR_STAGE_WIDTH, Math.round(hostWidth)));
  const height = Math.max(0, Math.min(hostWidth <= 730 ? 740 : 680, Math.round(hostHeight)));
  const renderWidth = Math.min(width, REPAIR_RENDER_WIDTH);
  const renderHeight = Math.min(height, REPAIR_RENDER_HEIGHT);
  return {
    width, height, renderWidth, renderHeight,
    left: Math.max(0, Math.round((hostWidth - width) / 2)) + width - renderWidth,
    top: 0,
  };
}

export function positionRepairCanvas(canvas, window) {
  if (!canvas?.style) return;
  canvas.style.position = 'absolute';
  canvas.style.left = `${window.left}px`;
  canvas.style.top = `${window.top}px`;
  canvas.style.width = `${window.renderWidth}px`;
  canvas.style.height = `${window.renderHeight}px`;
}
