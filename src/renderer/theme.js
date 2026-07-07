export const THEMES = {
  default: {
    background: '#ffffff',
    text: '#333333',
    mutedText: '#666666',
    nodeFill: '#ececff',
    nodeStroke: '#9370db',
    edgeStroke: '#333333',
    groupFill: '#f8f8fb',
    groupStroke: '#aaaaaa',
    noteFill: '#fff5ad',
    noteStroke: '#aaaa33',
    eventFill: '#f6f6f6',
    eventStroke: '#999999',
  },
  neutral: {
    background: '#ffffff',
    text: '#1f2933',
    mutedText: '#5b6472',
    nodeFill: '#f7f7f7',
    nodeStroke: '#6b7280',
    edgeStroke: '#2f343b',
    groupFill: '#fbfbfb',
    groupStroke: '#9ca3af',
    noteFill: '#fff8cc',
    noteStroke: '#b8a852',
    eventFill: '#f2f4f7',
    eventStroke: '#8a94a6',
  },
  forest: {
    background: '#fbfdf8',
    text: '#1f3326',
    mutedText: '#596b5f',
    nodeFill: '#eaf5e8',
    nodeStroke: '#4f8a5f',
    edgeStroke: '#2f4f39',
    groupFill: '#f3f8f1',
    groupStroke: '#8aa78f',
    noteFill: '#fff4bf',
    noteStroke: '#b99a35',
    eventFill: '#eef3eb',
    eventStroke: '#80927f',
  },
  dark: {
    background: '#111827',
    text: '#f3f4f6',
    mutedText: '#cbd5e1',
    nodeFill: '#1f2937',
    nodeStroke: '#93c5fd',
    edgeStroke: '#e5e7eb',
    groupFill: '#172033',
    groupStroke: '#64748b',
    noteFill: '#3f3414',
    noteStroke: '#d6b84d',
    eventFill: '#243041',
    eventStroke: '#94a3b8',
  },
};

export const THEME = THEMES.default;

export function resolveTheme(theme) {
  if (!theme) {
    return THEMES.default;
  }

  if (typeof theme === 'string') {
    return THEMES[theme] || THEMES.default;
  }

  return {
    ...THEMES.default,
    ...theme,
  };
}

export const RENDERER_DEFAULTS = {
  minWidth: 640,
  minHeight: 420,
  fit: true,
  theme: 'default',
  layoutAlgorithm: 'layered',
  layoutOptions: {},
  preventNodeOverlap: true,
  rerouteEdges: 'auto',
  nodeOverlapGap: 28,
  parallelEdgeGap: 14,
};

export const LAYOUT_ALGORITHMS = {
  layered: {
    label: 'Layered',
    elkAlgorithm: 'layered',
    layoutOptions: {},
  },
  mrtree: {
    label: 'Tree',
    elkAlgorithm: 'mrtree',
    layoutOptions: {},
  },
  stress: {
    label: 'Stress',
    elkAlgorithm: 'stress',
    layoutOptions: {},
  },
  force: {
    label: 'Force',
    elkAlgorithm: 'force',
    layoutOptions: {},
  },
  radial: {
    label: 'Radial',
    elkAlgorithm: 'radial',
    layoutOptions: {},
  },
  disco: {
    label: 'Components',
    elkAlgorithm: 'disco',
    layoutOptions: {},
  },
  sporeOverlap: {
    label: 'Overlap removal',
    elkAlgorithm: 'sporeOverlap',
    layoutOptions: {},
  },
  sporeCompaction: {
    label: 'Compaction',
    elkAlgorithm: 'sporeCompaction',
    layoutOptions: {},
  },
  rectpacking: {
    label: 'Rectangle packing',
    elkAlgorithm: 'rectpacking',
    layoutOptions: {},
  },
};

export function resolveLayoutAlgorithm(layoutAlgorithm) {
  if (!layoutAlgorithm) {
    return LAYOUT_ALGORITHMS.layered;
  }

  if (typeof layoutAlgorithm === 'string') {
    return LAYOUT_ALGORITHMS[layoutAlgorithm] || {
      label: layoutAlgorithm,
      elkAlgorithm: layoutAlgorithm,
      layoutOptions: {},
    };
  }

  const preset = LAYOUT_ALGORITHMS[layoutAlgorithm.name] || LAYOUT_ALGORITHMS[layoutAlgorithm.id] || {};

  return {
    ...LAYOUT_ALGORITHMS.layered,
    ...preset,
    ...layoutAlgorithm,
    layoutOptions: {
      ...(LAYOUT_ALGORITHMS.layered.layoutOptions || {}),
      ...(preset.layoutOptions || {}),
      ...(layoutAlgorithm.layoutOptions || {}),
    },
  };
}

export const GEOMETRY = {
  margin: 14,
  nodePaddingX: 14,
  nodePaddingY: 10,
  titleLineHeight: 20,
  textLineHeight: 17,
};
