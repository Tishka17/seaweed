const CLASSIFIER_TYPES = new Set([
  'class',
  'enum',
  'annotation',
  'protocol',
  'struct',
  'exception',
  'metaclass',
]);

const DOCUMENT_TYPES = new Set(['file', 'artifact']);
const CYLINDER_TYPES = new Set(['database', 'storage', 'queue']);

const DEFAULT_INSETS = {
  top: 8,
  right: 10,
  bottom: 8,
  left: 10,
};

const SHAPE_PROFILES = {
  actor: {
    kind: 'actor',
    minWidth: 82,
    minHeight: 104,
    insets: { top: 72, right: 8, bottom: 8, left: 8 },
  },
  usecase: {
    kind: 'ellipse',
    minWidth: 126,
    minHeight: 58,
    insets: { top: 10, right: 18, bottom: 10, left: 18 },
  },
  component: {
    kind: 'component',
    minWidth: 126,
    minHeight: 54,
    insets: { top: 8, right: 12, bottom: 8, left: 34 },
  },
  interface: {
    kind: 'interface',
    minWidth: 76,
    minHeight: 76,
    insets: { top: 18, right: 12, bottom: 18, left: 12 },
  },
  object: {
    kind: 'object',
    minWidth: 118,
    minHeight: 54,
    insets: DEFAULT_INSETS,
  },
  collections: {
    kind: 'stack',
    minWidth: 122,
    minHeight: 58,
    insets: { top: 12, right: 12, bottom: 8, left: 14 },
  },
  control: {
    kind: 'control',
    minWidth: 82,
    minHeight: 76,
    insets: { top: 16, right: 12, bottom: 16, left: 12 },
  },
  boundary: {
    kind: 'boundary',
    minWidth: 90,
    minHeight: 76,
    insets: { top: 16, right: 12, bottom: 16, left: 20 },
  },
  card: {
    kind: 'card',
    minWidth: 118,
    minHeight: 54,
    insets: DEFAULT_INSETS,
  },
  hexagon: {
    kind: 'hexagon',
    minWidth: 126,
    minHeight: 58,
    insets: { top: 8, right: 20, bottom: 8, left: 20 },
  },
  folder: {
    kind: 'folder',
    minWidth: 124,
    minHeight: 58,
    insets: { top: 16, right: 12, bottom: 8, left: 12 },
  },
  cloud: {
    kind: 'cloud',
    minWidth: 134,
    minHeight: 70,
    insets: { top: 14, right: 18, bottom: 14, left: 18 },
  },
  node: {
    kind: 'node',
    minWidth: 118,
    minHeight: 58,
    insets: DEFAULT_INSETS,
  },
  frame: {
    kind: 'frame',
    minWidth: 120,
    minHeight: 58,
    insets: { top: 16, right: 12, bottom: 8, left: 12 },
  },
  label: {
    kind: 'label',
    minWidth: 106,
    minHeight: 42,
    insets: { top: 6, right: 8, bottom: 6, left: 8 },
  },
  agent: {
    kind: 'agent',
    minWidth: 116,
    minHeight: 54,
    insets: DEFAULT_INSETS,
  },
  activityStart: {
    kind: 'filledCircle',
    minWidth: 28,
    minHeight: 28,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    hideText: true,
  },
  activityEnd: {
    kind: 'bullseye',
    minWidth: 34,
    minHeight: 34,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    hideText: true,
  },
  activityAction: {
    kind: 'roundRect',
    minWidth: 132,
    minHeight: 48,
    insets: { top: 8, right: 14, bottom: 8, left: 14 },
  },
  activityDecision: {
    kind: 'diamond',
    minWidth: 128,
    minHeight: 76,
    insets: { top: 18, right: 28, bottom: 18, left: 28 },
  },
  activityMerge: {
    kind: 'diamond',
    minWidth: 34,
    minHeight: 34,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    hideText: true,
  },
  state: {
    kind: 'state',
    minWidth: 124,
    minHeight: 54,
    insets: { top: 8, right: 14, bottom: 8, left: 14 },
  },
  stateStart: {
    kind: 'filledCircle',
    minWidth: 28,
    minHeight: 28,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    hideText: true,
  },
  stateEnd: {
    kind: 'bullseye',
    minWidth: 34,
    minHeight: 34,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    hideText: true,
  },
};

function hasMembers(node) {
  return node.members && node.members.length > 0;
}

export function nodeShapeProfile(node) {
  const type = node?.type || 'entity';

  if (CYLINDER_TYPES.has(type)) {
    return {
      kind: type === 'queue' ? 'queue' : 'cylinder',
      minWidth: 124,
      minHeight: 62,
      insets: { top: 14, right: 12, bottom: 10, left: 12 },
    };
  }

  if (DOCUMENT_TYPES.has(type)) {
    return {
      kind: type,
      minWidth: 120,
      minHeight: 58,
      insets: {
        top: 10,
        right: 18,
        bottom: 8,
        left: type === 'artifact' ? 34 : 12,
      },
    };
  }

  if (type === 'interface' && hasMembers(node)) {
    return {
      kind: 'classifier',
      minWidth: 118,
      minHeight: 54,
      insets: DEFAULT_INSETS,
    };
  }

  if (CLASSIFIER_TYPES.has(type)) {
    return {
      kind: 'classifier',
      minWidth: 118,
      minHeight: 54,
      insets: DEFAULT_INSETS,
    };
  }

  return SHAPE_PROFILES[type] || {
    kind: 'rectangle',
    minWidth: 112,
    minHeight: 42,
    insets: DEFAULT_INSETS,
  };
}

export function nodeTextInsets(node) {
  return nodeShapeProfile(node).insets;
}

export function nodeMinimumSize(node) {
  const profile = nodeShapeProfile(node);

  return {
    width: profile.minWidth,
    height: profile.minHeight,
  };
}

export function nodeTextVisible(node) {
  return nodeShapeProfile(node).hideText !== true;
}
