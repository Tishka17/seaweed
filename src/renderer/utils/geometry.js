export function segmentLength(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function longestSegmentLabelAnchor(points) {
  if (points.length < 2) {
    return {
      x: 0,
      y: 0,
      tangentX: 1,
      tangentY: 0,
      normalX: 0,
      normalY: -1,
    };
  }

  let bestIndex = 0;
  let bestLength = -1;

  for (let index = 0; index < points.length - 1; index += 1) {
    const length = segmentLength(points[index], points[index + 1]);
    if (length > bestLength) {
      bestLength = length;
      bestIndex = index;
    }
  }

  const start = points[bestIndex];
  const end = points[bestIndex + 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = bestLength || 1;
  const tangentX = dx / length;
  const tangentY = dy / length;
  let normalX = -dy / length;
  let normalY = dx / length;

  if (normalY > 0) {
    normalX *= -1;
    normalY *= -1;
  }

  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    tangentX,
    tangentY,
    normalX,
    normalY,
  };
}

export function boundsFromItems(items) {
  if (items.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 1,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    minX,
    minY,
    maxX,
    maxY,
  };
}

export function expandBounds(bounds, padding) {
  return {
    x: bounds.x - padding.left,
    y: bounds.y - padding.top,
    width: bounds.width + padding.left + padding.right,
    height: bounds.height + padding.top + padding.bottom,
    minX: bounds.x - padding.left,
    minY: bounds.y - padding.top,
    maxX: bounds.x + bounds.width + padding.right,
    maxY: bounds.y + bounds.height + padding.bottom,
  };
}

export function intersects(a, b, gap = 0) {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

function moveBelow(block, obstacle, gap) {
  return {
    ...block,
    y: obstacle.y + obstacle.height + gap,
  };
}

export function avoidCollisions(items, obstacles, gap = 10) {
  const placed = [];

  for (let index = 0; index < items.length; index += 1) {
    let current = { ...items[index] };
    let moved = true;
    let guard = 0;

    while (moved && guard < 80) {
      moved = false;
      const blockers = [...obstacles, ...placed];

      for (let blockerIndex = 0; blockerIndex < blockers.length; blockerIndex += 1) {
        const blocker = blockers[blockerIndex];
        if (intersects(current, blocker, gap)) {
          current = moveBelow(current, blocker, gap);
          moved = true;
        }
      }

      guard += 1;
    }

    placed.push(current);
  }

  return placed;
}

export function placeLabel(candidate, placed, obstacles, gap = 6) {
  const offsets = [
    [0, 0],
    [18, 0],
    [-18, 0],
    [36, 0],
    [-36, 0],
    [0, 8],
    [18, 8],
    [-18, 8],
    [0, -8],
    [18, -8],
    [-18, -8],
  ];

  for (let index = 0; index < offsets.length; index += 1) {
    const tangentShift = offsets[index][0];
    const normalShift = offsets[index][1];
    const positioned = {
      ...candidate,
      x:
        candidate.baseX +
        candidate.tangentX * tangentShift +
        candidate.normalX * normalShift -
        candidate.width / 2,
      y:
        candidate.baseY +
        candidate.tangentY * tangentShift +
        candidate.normalY * normalShift -
        candidate.height / 2,
    };
    const blockers = [...placed, ...obstacles];
    let blocked = false;

    for (let blockerIndex = 0; blockerIndex < blockers.length; blockerIndex += 1) {
      if (intersects(positioned, blockers[blockerIndex], gap)) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      return positioned;
    }
  }

  return {
    ...candidate,
    x: candidate.baseX - candidate.width / 2,
    y: candidate.baseY - candidate.height / 2,
  };
}
