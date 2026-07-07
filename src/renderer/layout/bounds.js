import { GEOMETRY } from '../theme.js';
import { boundsFromItems, expandBounds } from '../utils/geometry.js';
import { collectCardinalityBounds, collectEdgeLabelBounds, collectLineBounds } from './edges.js';

export function diagramBounds(layout, containers, fragments, notes, events) {
  const children = layout.children || [];
  const edges = layout.edges || [];
  const items = [
    ...children,
    ...collectLineBounds(edges),
    ...collectEdgeLabelBounds(edges),
    ...collectCardinalityBounds(edges),
    ...containers,
    ...fragments,
    ...notes,
    ...events,
  ];

  return expandBounds(boundsFromItems(items), {
    left: GEOMETRY.margin,
    top: GEOMETRY.margin,
    right: GEOMETRY.margin,
    bottom: GEOMETRY.margin,
  });
}

export function reserveTitleSpace(bounds, diagram) {
  if (!diagram.meta.title) {
    return bounds;
  }

  return expandBounds(bounds, {
    left: 0,
    top: 26,
    right: 0,
    bottom: 0,
  });
}
