import { resolveLayoutAlgorithm } from '../theme.js';
import { intersects, segmentLength } from '../utils/geometry.js';
import { nodeShapeProfile } from './node-shapes.js';

const STABLE_ROUTING_ALGORITHMS = new Set(['layered', 'mrtree']);
const SHAPE_AWARE_ENDPOINTS = new Set([
  'actor',
  'ellipse',
  'interface',
  'control',
  'cloud',
  'filledCircle',
  'bullseye',
  'diamond',
  'hexagon',
]);
const MIN_EDGE_LENGTH = 4;
const NODE_EDGE_CLEARANCE = 4;

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function center(node) {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function visualBounds(node) {
  const shape = nodeShapeProfile(node.data).kind;

  if (shape === 'actor') {
    const cx = node.x + node.width / 2;
    const bodyBottom = Math.min(48, node.height - 26);
    const glyphTop = node.y + 4;
    const glyphBottom = node.y + Math.max(24, bodyBottom + 20);
    return {
      x: cx - 20,
      y: glyphTop,
      width: 40,
      height: Math.max(28, glyphBottom - glyphTop),
    };
  }

  return node;
}

function visualCenter(node) {
  return center(visualBounds(node));
}

function edgeClearance(node) {
  return nodeShapeProfile(node.data).kind === 'actor' ? 1 : NODE_EDGE_CLEARANCE;
}

function needsEndpointAdjustment(node) {
  return SHAPE_AWARE_ENDPOINTS.has(nodeShapeProfile(node.data).kind);
}

function hasValidPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function sectionPoints(edge) {
  const section = edge.sections?.[0];

  if (!section) {
    return [];
  }

  return [section.startPoint, ...(section.bendPoints || []), section.endPoint];
}

function hasValidSection(edge) {
  const points = sectionPoints(edge);

  if (points.length < 2 || points.some((point) => !hasValidPoint(point))) {
    return false;
  }

  return segmentLength(points[0], points[points.length - 1]) >= MIN_EDGE_LENGTH;
}

function normalizeNodeCoordinates(nodes) {
  nodes.forEach((node) => {
    node.x = numberOr(node.x, 0);
    node.y = numberOr(node.y, 0);
    node.width = numberOr(node.width, 1);
    node.height = numberOr(node.height, 1);
  });
}

function separateOverlappingNodes(nodes, gap) {
  const placed = [];
  const ordered = [...nodes].sort((left, right) => (left.y - right.y) || (left.x - right.x));
  let moved = false;

  ordered.forEach((node) => {
    let guard = 0;
    let blocked = true;

    while (blocked && guard < 100) {
      blocked = false;

      for (let index = 0; index < placed.length; index += 1) {
        const obstacle = placed[index];
        if (intersects(node, obstacle, gap)) {
          node.y = obstacle.y + obstacle.height + gap;
          moved = true;
          blocked = true;
        }
      }

      guard += 1;
    }

    placed.push(node);
  });

  return moved;
}

function pairKey(edge) {
  const source = edge.data?.source || edge.sources?.[0];
  const target = edge.data?.target || edge.targets?.[0];

  if (source <= target) {
    return `${source}--${target}`;
  }

  return `${target}--${source}`;
}

function parallelEdgeSlots(edges) {
  const totals = new Map();
  const seen = new Map();
  const slots = new Map();

  edges.forEach((edge) => {
    totals.set(pairKey(edge), (totals.get(pairKey(edge)) || 0) + 1);
  });

  edges.forEach((edge) => {
    const key = pairKey(edge);
    const index = seen.get(key) || 0;
    seen.set(key, index + 1);
    slots.set(edge.id, {
      index,
      total: totals.get(key) || 1,
    });
  });

  return slots;
}

function boundaryPoint(node, toward) {
  const bounds = visualBounds(node);
  const nodeCenter = center(bounds);
  const dx = toward.x - nodeCenter.x;
  const dy = toward.y - nodeCenter.y;
  const shape = nodeShapeProfile(node.data).kind;

  if (dx === 0 && dy === 0) {
    return {
      x: bounds.x + bounds.width,
      y: nodeCenter.y,
    };
  }

  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;

  if (['ellipse', 'interface', 'control', 'cloud', 'filledCircle', 'bullseye'].includes(shape)) {
    const denominator = Math.sqrt((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight)) || 1;
    return {
      x: nodeCenter.x + dx / denominator,
      y: nodeCenter.y + dy / denominator,
    };
  }

  if (shape === 'diamond') {
    const scale = 1 / ((Math.abs(dx) / halfWidth) + (Math.abs(dy) / halfHeight) || 1);

    return {
      x: nodeCenter.x + dx * scale,
      y: nodeCenter.y + dy * scale,
    };
  }

  if (shape === 'hexagon') {
    const horizontalInset = Math.min(bounds.width * 0.18, 24);
    const scaleX = dx === 0 ? Infinity : (halfWidth - horizontalInset / 2) / Math.abs(dx);
    const scaleY = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
    const scale = Math.min(scaleX, scaleY);

    return {
      x: nodeCenter.x + dx * scale,
      y: nodeCenter.y + dy * scale,
    };
  }

  const scaleX = dx === 0 ? Infinity : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: nodeCenter.x + dx * scale,
    y: nodeCenter.y + dy * scale,
  };
}

function clamp(value, min, max) {
  if (min > max) {
    return (min + max) / 2;
  }

  return Math.max(min, Math.min(max, value));
}

function shiftBoundaryPoint(node, point, normal, offset) {
  const bounds = visualBounds(node);
  const shifted = {
    x: point.x + normal.x * offset,
    y: point.y + normal.y * offset,
  };
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;
  const inset = Math.min(8, bounds.width / 4, bounds.height / 4);

  if (Math.abs(point.x - left) < 0.001) {
    return { x: left, y: clamp(shifted.y, top + inset, bottom - inset) };
  }
  if (Math.abs(point.x - right) < 0.001) {
    return { x: right, y: clamp(shifted.y, top + inset, bottom - inset) };
  }
  if (Math.abs(point.y - top) < 0.001) {
    return { x: clamp(shifted.x, left + inset, right - inset), y: top };
  }

  return { x: clamp(shifted.x, left + inset, right - inset), y: bottom };
}

function moveOutsideNode(node, point, distance = edgeClearance(node)) {
  const nodeCenter = visualCenter(node);
  const dx = point.x - nodeCenter.x;
  const dy = point.y - nodeCenter.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;

  return {
    x: point.x + (dx / length) * distance,
    y: point.y + (dy / length) * distance,
  };
}

function compactPoints(points) {
  return points.filter((point, index) => {
    if (index === 0) {
      return true;
    }

    return segmentLength(points[index - 1], point) > 0.5;
  });
}

function pointInsideBox(point, box, gap = 0) {
  return point.x >= box.x - gap &&
    point.x <= box.x + box.width + gap &&
    point.y >= box.y - gap &&
    point.y <= box.y + box.height + gap;
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);

  if (Math.abs(value) < 0.001) {
    return 0;
  }

  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) &&
    b.y >= Math.min(a.y, c.y);
}

function segmentsIntersect(a, b, c, d) {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);

  if (first !== second && third !== fourth) {
    return true;
  }

  return (first === 0 && onSegment(a, c, b)) ||
    (second === 0 && onSegment(a, d, b)) ||
    (third === 0 && onSegment(c, a, d)) ||
    (fourth === 0 && onSegment(c, b, d));
}

function segmentIntersectsBox(start, end, box, gap = 0) {
  const expanded = {
    x: box.x - gap,
    y: box.y - gap,
    width: box.width + gap * 2,
    height: box.height + gap * 2,
  };
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  if (
    maxX < expanded.x ||
    minX > expanded.x + expanded.width ||
    maxY < expanded.y ||
    minY > expanded.y + expanded.height
  ) {
    return false;
  }

  if (pointInsideBox(start, expanded) || pointInsideBox(end, expanded)) {
    return true;
  }

  const topLeft = { x: expanded.x, y: expanded.y };
  const topRight = { x: expanded.x + expanded.width, y: expanded.y };
  const bottomRight = { x: expanded.x + expanded.width, y: expanded.y + expanded.height };
  const bottomLeft = { x: expanded.x, y: expanded.y + expanded.height };

  return segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft);
}

function pathIntersectsObstacles(points, obstacles, gap) {
  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
    for (let obstacleIndex = 0; obstacleIndex < obstacles.length; obstacleIndex += 1) {
      if (segmentIntersectsBox(points[pointIndex], points[pointIndex + 1], obstacles[obstacleIndex], gap)) {
        return true;
      }
    }
  }

  return false;
}

function intersectingObstacles(points, obstacles, gap) {
  return obstacles.filter((obstacle) => {
    for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
      if (segmentIntersectsBox(points[pointIndex], points[pointIndex + 1], obstacle, gap)) {
        return true;
      }
    }

    return false;
  });
}

function pathLength(points) {
  let length = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    length += segmentLength(points[index], points[index + 1]);
  }

  return length;
}

function endpointHiddenInsideNode(point, node) {
  return pointInsideBox(point, node, -1);
}

function hasVisibleSection(edge, source, target, obstacles, gap) {
  if (!hasValidSection(edge)) {
    return false;
  }

  const points = sectionPoints(edge);
  const start = points[0];
  const end = points[points.length - 1];

  if (endpointHiddenInsideNode(start, source) || endpointHiddenInsideNode(end, target)) {
    return false;
  }

  return !pathIntersectsObstacles(points, obstacles, gap);
}

function detourAroundObstacles(start, end, blockers, allObstacles, offset, gap) {
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  const padding = gap + Math.abs(offset);
  const candidates = [];

  if (horizontal) {
    const top = blockers.reduce((value, obstacle) => Math.min(value, obstacle.y), Math.min(start.y, end.y));
    const bottom = blockers.reduce((value, obstacle) => Math.max(value, obstacle.y + obstacle.height), Math.max(start.y, end.y));

    [top - padding, bottom + padding].forEach((detourY) => {
      candidates.push(compactPoints([
        start,
        { x: start.x, y: detourY },
        { x: end.x, y: detourY },
        end,
      ]));
    });
  } else {
    const left = blockers.reduce((value, obstacle) => Math.min(value, obstacle.x), Math.min(start.x, end.x));
    const right = blockers.reduce((value, obstacle) => Math.max(value, obstacle.x + obstacle.width), Math.max(start.x, end.x));

    [left - padding, right + padding].forEach((detourX) => {
      candidates.push(compactPoints([
        start,
        { x: detourX, y: start.y },
        { x: detourX, y: end.y },
        end,
      ]));
    });
  }

  return candidates
    .sort((left, right) => pathLength(left) - pathLength(right))
    .find((candidate) => !pathIntersectsObstacles(candidate, allObstacles, 1)) || candidates[0];
}

function routeSelfLoop(edge, node, offset) {
  const bounds = visualBounds(node);
  const clearance = edgeClearance(node);
  const size = 30 + Math.abs(offset);
  const start = {
    x: bounds.x + bounds.width + clearance,
    y: bounds.y + bounds.height / 2,
  };

  return {
    id: `${edge.id}_s0`,
    startPoint: start,
    bendPoints: [
      { x: start.x + size, y: start.y },
      { x: start.x + size, y: bounds.y - size },
      { x: bounds.x + bounds.width / 2, y: bounds.y - size },
    ],
    endPoint: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y - clearance,
    },
  };
}

function sectionWithAdjustedEndpoints(edge, source, target) {
  const section = edge.sections?.[0];
  const points = sectionPoints(edge);

  if (!section || points.length < 2) {
    return edge;
  }

  const startPoint = needsEndpointAdjustment(source)
    ? moveOutsideNode(source, boundaryPoint(source, points[1]))
    : points[0];
  const endPoint = needsEndpointAdjustment(target)
    ? moveOutsideNode(target, boundaryPoint(target, points[points.length - 2]))
    : points[points.length - 1];

  return {
    ...edge,
    sections: [{
      ...section,
      startPoint,
      bendPoints: points.slice(1, -1),
      endPoint,
    }],
  };
}

function routeBetweenNodes(edge, source, target, slot, options) {
  const sourceCenter = visualCenter(source);
  const targetCenter = visualCenter(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const normal = {
    x: -dy / length,
    y: dx / length,
  };
  const offset = (slot.index - (slot.total - 1) / 2) * options.parallelEdgeGap;
  const startBase = boundaryPoint(source, {
    x: targetCenter.x + normal.x * offset,
    y: targetCenter.y + normal.y * offset,
  });
  const endBase = boundaryPoint(target, {
    x: sourceCenter.x + normal.x * offset,
    y: sourceCenter.y + normal.y * offset,
  });
  const start = moveOutsideNode(source, shiftBoundaryPoint(source, startBase, normal, offset));
  const end = moveOutsideNode(target, shiftBoundaryPoint(target, endBase, normal, offset));
  const points = [start];
  const useOrthogonal = options.edgeRouting === 'ORTHOGONAL';

  if (useOrthogonal) {
    if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
      const midX = (start.x + end.x) / 2;
      points.push({ x: midX, y: start.y }, { x: midX, y: end.y });
    } else {
      const midY = (start.y + end.y) / 2;
      points.push({ x: start.x, y: midY }, { x: end.x, y: midY });
    }
  } else if (Math.abs(offset) > 0.5) {
    points.push({
      x: (start.x + end.x) / 2 + normal.x * Math.abs(offset),
      y: (start.y + end.y) / 2 + normal.y * Math.abs(offset),
    });
  }

  points.push(end);

  const obstacles = options.nodes.filter((node) => node.id !== source.id && node.id !== target.id);
  const blockers = intersectingObstacles(points, obstacles, 1);
  const compacted = blockers.length > 0
    ? detourAroundObstacles(start, end, blockers, obstacles, offset, options.nodeRoutingGap)
    : compactPoints(points);

  return {
    id: `${edge.id}_s0`,
    startPoint: compacted[0],
    bendPoints: compacted.slice(1, -1),
    endPoint: compacted[compacted.length - 1],
  };
}

function routeEdge(edge, nodeById, slot, options) {
  const source = nodeById.get(edge.data?.source || edge.sources?.[0]);
  const target = nodeById.get(edge.data?.target || edge.targets?.[0]);

  if (!source || !target) {
    return edge;
  }

  const offset = (slot.index - (slot.total - 1) / 2) * options.parallelEdgeGap;
  const section = source.id === target.id
    ? routeSelfLoop(edge, source, offset)
    : routeBetweenNodes(edge, source, target, slot, options);

  return {
    ...edge,
    sections: [section],
  };
}

function normalizeEdges(layoutEdges, diagramEdges, nodeById, options) {
  const layoutEdgeById = new Map();
  layoutEdges.forEach((edge) => {
    layoutEdgeById.set(edge.id, edge);
  });

  const normalizedEdges = diagramEdges.map((modelEdge) => ({
    ...(layoutEdgeById.get(modelEdge.id) || {}),
    id: modelEdge.id,
    data: modelEdge,
    sources: [modelEdge.source],
    targets: [modelEdge.target],
  }));
  const slots = parallelEdgeSlots(normalizedEdges);

  return normalizedEdges.map((edge) => {
    const source = nodeById.get(edge.data?.source || edge.sources?.[0]);
    const target = nodeById.get(edge.data?.target || edge.targets?.[0]);
    const obstacles = options.nodes.filter((node) => node.id !== source?.id && node.id !== target?.id);

    if (
      !options.rerouteAll &&
      source &&
      target &&
      hasVisibleSection(edge, source, target, obstacles, options.visibilityGap)
    ) {
      return sectionWithAdjustedEndpoints(edge, source, target);
    }

    return routeEdge(edge, nodeById, slots.get(edge.id), options);
  });
}

export function normalizeLayout(layout, diagram, options = {}) {
  const layoutAlgorithm = resolveLayoutAlgorithm(options.layoutAlgorithm);
  const children = layout.children || [];
  const nodeOverlapGap = numberOr(options.nodeOverlapGap, 28);
  const preventNodeOverlap = options.preventNodeOverlap !== false;
  const edgeRouting = diagram.meta.skinparams?.linetype === 'ortho' ? 'ORTHOGONAL' : 'POLYLINE';
  const rerouteSetting = options.rerouteEdges ?? 'auto';
  const rerouteAll = rerouteSetting === true ||
    (rerouteSetting === 'auto' && !STABLE_ROUTING_ALGORITHMS.has(layoutAlgorithm.elkAlgorithm));

  normalizeNodeCoordinates(children);
  const movedNodes = preventNodeOverlap ? separateOverlappingNodes(children, nodeOverlapGap) : false;
  const nodeById = new Map(children.map((node) => [node.id, node]));

  return {
    ...layout,
    children,
    edges: normalizeEdges(layout.edges || [], diagram.edges || [], nodeById, {
      edgeRouting,
      rerouteAll: rerouteAll || movedNodes,
      nodes: children,
      visibilityGap: 1,
      nodeRoutingGap: Math.max(12, nodeOverlapGap / 2),
      parallelEdgeGap: numberOr(options.parallelEdgeGap, 14),
    }),
  };
}
