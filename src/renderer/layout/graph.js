import { GEOMETRY, resolveLayoutAlgorithm } from '../theme.js';
import { nodeTextRows, textWidth } from '../utils/text.js';
import { analyzeEdgeDensity, graphSpacing, nodePortPadding } from './density.js';
import { nodeMinimumSize, nodeTextInsets, nodeTextVisible } from './node-shapes.js';

function estimateNodeSize(node, density) {
  const rows = nodeTextVisible(node) ? nodeTextRows(node) : [];
  let longest = 0;

  for (let index = 0; index < rows.length; index += 1) {
    longest = Math.max(longest, textWidth(rows[index].text, rows[index].type === 'title' ? 14 : 12));
  }

  const hasMembers = node.members && node.members.length > 0;
  const memberRows = rows.filter((row) => row.type !== 'title' && row.type !== 'stereotype').length;
  const headerRows = rows.length - memberRows;
  const separatorRows = rows.filter((row) => row.type === 'separator').length;
  const textMemberRows = memberRows - separatorRows;
  const portPadding = nodePortPadding(node.id, density);
  const minimumSize = nodeMinimumSize(node);
  const insets = nodeTextInsets(node);
  const horizontalInsets = insets.left + insets.right;
  const verticalInsets = insets.top + insets.bottom;

  return {
    width: Math.max(
      minimumSize.width + portPadding.width,
      Math.ceil(longest + horizontalInsets + portPadding.width),
    ),
    height: Math.max(
      minimumSize.height + portPadding.height,
      verticalInsets +
        headerRows * GEOMETRY.titleLineHeight +
        (hasMembers ? 6 + textMemberRows * GEOMETRY.textLineHeight + separatorRows * 10 : 0) +
        portPadding.height,
    ),
  };
}

function mapDirection(direction) {
  return direction === 'left to right' ? 'RIGHT' : 'DOWN';
}

function edgeRouting(meta) {
  return meta.skinparams?.linetype === 'ortho' ? 'ORTHOGONAL' : 'POLYLINE';
}

export function buildGraph(diagram, options = {}) {
  const density = analyzeEdgeDensity(diagram);
  const spacing = graphSpacing(density);
  const layoutAlgorithm = resolveLayoutAlgorithm(options.layoutAlgorithm);
  const layoutOptions = {
    'elk.algorithm': layoutAlgorithm.elkAlgorithm,
    'elk.direction': mapDirection(diagram.meta.direction),
    'elk.edgeRouting': edgeRouting(diagram.meta),
    'elk.spacing.nodeNode': String(spacing.nodeNode),
    'elk.spacing.edgeNode': String(spacing.edgeNode),
    'elk.spacing.edgeEdge': String(spacing.edgeEdge),
  };

  if (layoutAlgorithm.elkAlgorithm === 'layered') {
    layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = String(spacing.nodeNodeBetweenLayers);
    layoutOptions['elk.layered.spacing.edgeNodeBetweenLayers'] = String(spacing.edgeNodeBetweenLayers);
    layoutOptions['elk.layered.spacing.edgeEdgeBetweenLayers'] = String(spacing.edgeEdgeBetweenLayers);
  }

  Object.assign(layoutOptions, layoutAlgorithm.layoutOptions || {}, options.layoutOptions || {});

  return {
    id: 'root',
    layoutOptions,
    children: diagram.nodes.map((node) => {
      const size = estimateNodeSize(node, density);
      return {
        id: node.id,
        width: size.width,
        height: size.height,
        data: node,
        labels: nodeTextVisible(node) ? [{ text: node.label || node.id }] : [],
      };
    }),
    edges: diagram.edges.map((edge) => ({
      id: edge.id,
      data: edge,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };
}
