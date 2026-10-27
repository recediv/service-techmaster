// PikaPika's motion bounds follow the viewport, not the page's content gutters.
export function measureTimTerritory(stage, size, compact, carrying = false) {
  const stageBox = stage.getBoundingClientRect();
  const rootBox = document.documentElement.getBoundingClientRect();
  const width = Math.min(stageBox.width, rootBox.right - stageBox.left);
  const half = size / 2;
  const dock = document.querySelector('.parts-shop-dock');
  const dockBox = dock?.getBoundingClientRect();
  const reserved = dockBox?.height && getComputedStyle(dock).position === 'fixed' ? Math.max(0, stageBox.bottom - dockBox.top) : 0;
  // Match PikaPika's 4px motion inset and 24px / 12px initial placement.
  // Tim's x is the centre of his nominal square, not a sprite's left edge.
  const gap = 4;
  const halfAvailable = Math.max(0, width / 2 - gap);
  const left = Math.min(half, halfAvailable) + gap;
  const right = Math.max(left, width - left);
  const boardWidth = Math.min(164, Math.max(72, width - gap * 2));
  const inset = Math.min(halfAvailable, carrying && !compact ? Math.max(half, boardWidth / 2) : half);
  const min = inset + gap;
  const max = Math.max(min, width - inset - gap);
  return {
    left, right, reserved,
    home: Math.max(min, Math.min(max, width - half - (compact ? 12 : 24))),
    walk: { min, max, dock: max - min < 12, room: width, boardWidth },
  };
}
