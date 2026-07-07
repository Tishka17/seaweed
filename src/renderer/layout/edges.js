import { longestSegmentLabelAnchor, placeLabel } from '../utils/geometry.js';
import { labelBox, safeText } from '../utils/text.js';

export function edgePoints(edge) {
  const section = edge.sections?.[0];
  if (!section) {
    return [];
  }

  return [section.startPoint, ...(section.bendPoints || []), section.endPoint];
}

export function edgePath(edge) {
  const points = edgePoints(edge);
  if (points.length === 0) {
    return '';
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    path += ` L ${points[index].x} ${points[index].y}`;
  }

  return path;
}

export function lineStyle(edge) {
  if (edge.data?.lineStyle === 'dashed') {
    return '5 4';
  }

  if (edge.data?.lineStyle === 'bold') {
    return null;
  }

  return null;
}

export function strokeWidth(edge) {
  return edge.data?.lineStyle === 'bold' ? 2.6 : 1.5;
}

function hasStartArrow(arrow) {
  return safeText(arrow).startsWith('<');
}

function hasEndArrow(arrow) {
  return safeText(arrow).endsWith('>');
}

function hasStartCircle(arrow) {
  return safeText(arrow).startsWith('o');
}

function hasEndCircle(arrow) {
  return safeText(arrow).endsWith('o');
}

function hasStartDiamond(arrow) {
  return safeText(arrow).startsWith('*');
}

function hasEndDiamond(arrow) {
  return safeText(arrow).endsWith('*');
}

function hasStartCross(arrow) {
  return safeText(arrow).startsWith('x');
}

function hasEndCross(arrow) {
  return safeText(arrow).endsWith('x');
}

export function markerStart(edge) {
  const arrow = edge.data?.arrow;
  if (hasStartArrow(arrow)) {
    return 'url(#seaweed-arrow-start)';
  }
  if (hasStartCircle(arrow)) {
    return 'url(#seaweed-circle-start)';
  }
  if (hasStartDiamond(arrow)) {
    return 'url(#seaweed-diamond-start)';
  }
  if (hasStartCross(arrow)) {
    return 'url(#seaweed-cross-start)';
  }

  return null;
}

export function markerEnd(edge) {
  const arrow = edge.data?.arrow;
  if (hasEndArrow(arrow)) {
    return 'url(#seaweed-arrow-end)';
  }
  if (hasEndCircle(arrow)) {
    return 'url(#seaweed-circle-end)';
  }
  if (hasEndDiamond(arrow)) {
    return 'url(#seaweed-diamond-end)';
  }
  if (hasEndCross(arrow)) {
    return 'url(#seaweed-cross-end)';
  }

  return null;
}

export function layoutEdgeLabels(layoutEdges, obstacles = []) {
  const placed = [];

  layoutEdges
    .filter((edge) => edge.data?.label)
    .forEach((edge) => {
      const anchor = longestSegmentLabelAnchor(edgePoints(edge));
      const box = labelBox(edge.data.label, 12);
      const candidate = {
        edge,
        text: edge.data.label,
        width: box.width,
        height: box.height,
        baseX: anchor.x + anchor.normalX * 8,
        baseY: anchor.y + anchor.normalY * 8,
        tangentX: anchor.tangentX,
        tangentY: anchor.tangentY,
        normalX: anchor.normalX,
        normalY: anchor.normalY,
      };

      placed.push(placeLabel(candidate, placed, obstacles, 8));
    });

  return placed;
}

function segmentVectors(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const tangentX = dx / length;
  const tangentY = dy / length;
  let normalX = -dy / length;
  let normalY = dx / length;

  if (normalY > 0) {
    normalX *= -1;
    normalY *= -1;
  }

  return {
    tangentX,
    tangentY,
    normalX,
    normalY,
  };
}

export function layoutCardinalityLabels(layoutEdges, obstacles = []) {
  const placed = [];

  layoutEdges.forEach((edge) => {
    const points = edgePoints(edge);
    if (points.length === 0) {
      return;
    }

    if (edge.data?.sourceCardinality) {
      const box = labelBox(edge.data.sourceCardinality, 11);
      const vectors = segmentVectors(points[0], points[1] || points[0]);
      const candidate = {
        edge,
        text: edge.data.sourceCardinality,
        anchor: 'start',
        width: box.width,
        height: box.height,
        baseX: points[0].x + vectors.tangentX * 16 + vectors.normalX * 9,
        baseY: points[0].y + vectors.tangentY * 16 + vectors.normalY * 9,
        tangentX: vectors.tangentX,
        tangentY: vectors.tangentY,
        normalX: vectors.normalX,
        normalY: vectors.normalY,
      };
      placed.push(placeLabel(candidate, placed, obstacles, 6));
    }

    if (edge.data?.targetCardinality) {
      const target = points[points.length - 1];
      const previous = points[points.length - 2] || target;
      const vectors = segmentVectors(previous, target);
      const box = labelBox(edge.data.targetCardinality, 11);
      const candidate = {
        edge,
        text: edge.data.targetCardinality,
        anchor: 'end',
        width: box.width,
        height: box.height,
        baseX: target.x - vectors.tangentX * 16 + vectors.normalX * 9,
        baseY: target.y - vectors.tangentY * 16 + vectors.normalY * 9,
        tangentX: vectors.tangentX,
        tangentY: vectors.tangentY,
        normalX: vectors.normalX,
        normalY: vectors.normalY,
      };
      placed.push(placeLabel(candidate, placed, obstacles, 6));
    }
  });

  return placed;
}

export function collectEdgeLabelBounds(layoutEdges) {
  return layoutEdgeLabels(layoutEdges).map((label) => ({
    x: label.x,
    y: label.y,
    width: label.width,
    height: label.height,
  }));
}

export function collectCardinalityBounds(layoutEdges) {
  return layoutCardinalityLabels(layoutEdges).map((label) => ({
    x: label.x,
    y: label.y,
    width: label.width,
    height: label.height,
  }));
}

export function collectLineBounds(edges) {
  const boxes = [];

  for (let index = 0; index < edges.length; index += 1) {
    const points = edgePoints(edges[index]);
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      boxes.push({
        x: points[pointIndex].x,
        y: points[pointIndex].y,
        width: 1,
        height: 1,
      });
    }
  }

  return boxes;
}
