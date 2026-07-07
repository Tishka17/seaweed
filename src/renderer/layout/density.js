function pairKey(edge) {
  const source = edge.source;
  const target = edge.target;

  if (source <= target) {
    return `${source}--${target}`;
  }

  return `${target}--${source}`;
}

function incrementMapValue(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

export function analyzeEdgeDensity(diagram) {
  const degreeByNode = new Map();
  const pairCount = new Map();

  for (let index = 0; index < diagram.edges.length; index += 1) {
    const edge = diagram.edges[index];
    incrementMapValue(degreeByNode, edge.source);
    incrementMapValue(degreeByNode, edge.target);
    incrementMapValue(pairCount, pairKey(edge));
  }

  let maxDegree = 0;
  degreeByNode.forEach((degree) => {
    maxDegree = Math.max(maxDegree, degree);
  });

  let maxParallelEdges = 0;
  pairCount.forEach((count) => {
    maxParallelEdges = Math.max(maxParallelEdges, count);
  });

  const nodeCount = Math.max(1, diagram.nodes.length);
  const edgeCount = diagram.edges.length;
  const averageDegree = edgeCount === 0 ? 0 : (edgeCount * 2) / nodeCount;

  return {
    degreeByNode,
    pairCount,
    maxDegree,
    maxParallelEdges,
    edgeCount,
    averageDegree,
  };
}

export function nodePortPadding(nodeId, density) {
  const degree = density.degreeByNode.get(nodeId) || 0;

  if (degree <= 2) {
    return {
      width: 0,
      height: 0,
    };
  }

  const extra = Math.min(48, (degree - 2) * 8);
  return {
    width: extra,
    height: Math.ceil(extra * 0.35),
  };
}

export function graphSpacing(density) {
  const densityFactor = Math.max(0, Math.ceil(density.averageDegree - 2));
  const parallelFactor = Math.max(0, density.maxParallelEdges - 1);
  const degreeFactor = Math.max(0, density.maxDegree - 3);

  return {
    nodeNode: 48 + densityFactor * 10 + parallelFactor * 16,
    nodeNodeBetweenLayers: 72 + densityFactor * 14 + parallelFactor * 24,
    edgeNode: 28 + degreeFactor * 4 + parallelFactor * 10,
    edgeEdge: 18 + densityFactor * 4 + parallelFactor * 14,
    edgeNodeBetweenLayers: 24 + degreeFactor * 3 + parallelFactor * 10,
    edgeEdgeBetweenLayers: 18 + densityFactor * 4 + parallelFactor * 14,
  };
}
