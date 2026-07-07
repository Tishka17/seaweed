import test from 'node:test';
import assert from 'node:assert/strict';
import { edgePoints } from '../src/renderer/layout/edges.js';
import { buildGraph } from '../src/renderer/layout/graph.js';
import { normalizeLayout } from '../src/renderer/layout/postprocess.js';
import { buildSequenceLayout, isSequenceDiagram } from '../src/renderer/layout/sequence.js';
import { intersects, segmentLength } from '../src/renderer/utils/geometry.js';

function createDiagram(edges) {
  return {
    nodes: [
      { id: 'A', label: 'A', type: 'entity', members: [] },
      { id: 'B', label: 'B', type: 'entity', members: [] },
      { id: 'C', label: 'C', type: 'entity', members: [] },
    ],
    edges,
    groups: [],
    notes: [],
    events: [],
    meta: {
      direction: 'left to right',
      skinparams: {},
    },
  };
}

test('buildGraph increases spacing and node size for dense edge layouts', () => {
  const sparse = buildGraph(createDiagram([
    { id: 'A-B', source: 'A', target: 'B', arrow: '-->' },
  ]));
  const dense = buildGraph(createDiagram([
    { id: 'A-B-1', source: 'A', target: 'B', arrow: '-->' },
    { id: 'A-B-2', source: 'A', target: 'B', arrow: '-->' },
    { id: 'A-B-3', source: 'A', target: 'B', arrow: '-->' },
    { id: 'A-C-1', source: 'A', target: 'C', arrow: '-->' },
    { id: 'A-C-2', source: 'A', target: 'C', arrow: '-->' },
  ]));

  const sparseNode = sparse.children.find((node) => node.id === 'A');
  const denseNode = dense.children.find((node) => node.id === 'A');

  assert.ok(Number(dense.layoutOptions['elk.spacing.edgeEdge']) > Number(sparse.layoutOptions['elk.spacing.edgeEdge']));
  assert.ok(Number(dense.layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers']) > Number(sparse.layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers']));
  assert.ok(denseNode.width > sparseNode.width);
});

test('buildGraph supports configurable ELK layout algorithms', () => {
  const graph = buildGraph(createDiagram([
    { id: 'A-B', source: 'A', target: 'B', arrow: '-->' },
  ]), {
    layoutAlgorithm: 'mrtree',
  });

  assert.equal(graph.layoutOptions['elk.algorithm'], 'mrtree');
  assert.equal(graph.layoutOptions['elk.direction'], 'RIGHT');
});

test('buildGraph allows ELK layout option overrides', () => {
  const graph = buildGraph(createDiagram([
    { id: 'A-B', source: 'A', target: 'B', arrow: '-->' },
  ]), {
    layoutAlgorithm: {
      name: 'layered',
      layoutOptions: {
        'elk.spacing.nodeNode': '90',
      },
    },
    layoutOptions: {
      'elk.edgeRouting': 'POLYLINE',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '44',
    },
  });

  assert.equal(graph.layoutOptions['elk.algorithm'], 'layered');
  assert.equal(graph.layoutOptions['elk.spacing.nodeNode'], '90');
  assert.equal(graph.layoutOptions['elk.edgeRouting'], 'POLYLINE');
  assert.equal(graph.layoutOptions['elk.layered.spacing.edgeEdgeBetweenLayers'], '44');
});

test('buildGraph uses shape-aware minimum sizes for diagram node types', () => {
  const diagram = {
    ...createDiagram([]),
    nodes: [
      { id: 'Actor', label: 'User', type: 'actor', members: [] },
      { id: 'UseCase', label: 'Place Order', type: 'usecase', members: [] },
      { id: 'Db', label: 'Orders', type: 'database', members: [] },
      { id: 'Component', label: 'API', type: 'component', members: [] },
      { id: 'Decision', label: 'valid?', type: 'activityDecision', members: [] },
      { id: 'StateStart', label: '', type: 'stateStart', members: [] },
    ],
  };
  const graph = buildGraph(diagram);
  const byId = new Map(graph.children.map((node) => [node.id, node]));

  assert.ok(byId.get('Actor').height >= 104);
  assert.ok(byId.get('UseCase').width >= 126);
  assert.ok(byId.get('Db').height >= 62);
  assert.ok(byId.get('Component').width >= 126);
  assert.ok(byId.get('Decision').height >= 76);
  assert.ok(byId.get('StateStart').width >= 28);
});

test('buildGraph keeps marker nodes text-free and compact', () => {
  const diagram = {
    ...createDiagram([]),
    nodes: [
      { id: 'state-start', label: '', type: 'stateStart', members: [] },
      { id: 'state-end', label: '', type: 'stateEnd', members: [] },
      { id: 'activity-start', label: '', type: 'activityStart', members: [] },
      { id: 'activity-end', label: '', type: 'activityEnd', members: [] },
      { id: 'activity-merge', label: '', type: 'activityMerge', members: [] },
    ],
  };
  const graph = buildGraph(diagram);
  const byId = new Map(graph.children.map((node) => [node.id, node]));

  assert.deepEqual(byId.get('state-start').labels, []);
  assert.deepEqual(byId.get('state-end').labels, []);
  assert.equal(byId.get('state-start').width, 28);
  assert.equal(byId.get('state-end').height, 34);
  assert.equal(byId.get('activity-start').width, 28);
  assert.equal(byId.get('activity-end').height, 34);
  assert.equal(byId.get('activity-merge').width, 34);
});

test('sequence diagrams use timeline layout instead of graph layout', () => {
  const diagram = {
    nodes: [
      { id: 'User', label: 'User', type: 'actor', members: [] },
      { id: 'Browser', label: 'Browser', type: 'participant', members: [] },
      { id: 'Auth', label: 'Auth API', type: 'participant', members: [] },
    ],
    edges: [
      { id: 'User-Browser', source: 'User', target: 'Browser', arrow: '->', label: 'open' },
      { id: 'Browser-Auth', source: 'Browser', target: 'Auth', arrow: '->', label: 'login' },
      { id: 'Auth-Browser', source: 'Auth', target: 'Browser', arrow: '-->', label: 'token' },
    ],
    groups: [],
    notes: [],
    events: [
      { id: 'event-1', type: 'activate', target: 'Auth' },
      { id: 'event-2', type: 'deactivate', target: 'Auth' },
    ],
    timeline: [
      { type: 'edge', edgeId: 'User-Browser', order: 0 },
      { type: 'edge', edgeId: 'Browser-Auth', order: 1 },
      { type: 'event', eventId: 'event-1', order: 2 },
      { type: 'edge', edgeId: 'Auth-Browser', order: 3 },
      { type: 'event', eventId: 'event-2', order: 4 },
    ],
    meta: {
      direction: 'left to right',
      skinparams: {},
    },
  };
  const layout = buildSequenceLayout(diagram);
  const user = layout.children.find((node) => node.id === 'User');
  const browser = layout.children.find((node) => node.id === 'Browser');
  const auth = layout.children.find((node) => node.id === 'Auth');
  const firstEdgeY = edgePoints(layout.edges[0])[0].y;
  const secondEdgeY = edgePoints(layout.edges[1])[0].y;
  const thirdEdgeY = edgePoints(layout.edges[2])[0].y;
  const headerBottom = Math.max(...layout.children.map((node) => node.y + node.height));

  assert.equal(isSequenceDiagram(diagram), true);
  assert.ok(user.x < browser.x);
  assert.ok(browser.x < auth.x);
  assert.ok(firstEdgeY >= headerBottom + 48);
  assert.ok(secondEdgeY > firstEdgeY);
  assert.equal(layout.lifelines.length, 3);
  assert.equal(layout.activations.length, 1);
  assert.equal(layout.activations[0].target, 'Auth');
  assert.equal(layout.activations[0].y, secondEdgeY + 8);
  assert.equal(layout.activations[0].height, thirdEdgeY - layout.activations[0].y + 8);
  assert.equal(edgePoints(layout.edges[2])[0].x, layout.activations[0].x);
});

test('sequence alt fragments follow timeline branches and notes', () => {
  const diagram = {
    nodes: [
      { id: 'Alice', label: 'Alice', type: 'participant', members: [] },
      { id: 'Bob', label: 'Bob', type: 'participant', members: [] },
    ],
    edges: [
      { id: 'Alice-Bob', source: 'Alice', target: 'Bob', arrow: '->', label: 'login' },
    ],
    groups: [
      {
        id: 'alt-1',
        type: 'alt',
        title: 'success',
        branches: [{ type: 'else', label: 'failure' }],
      },
    ],
    notes: [
      {
        id: 'note-1',
        type: 'note',
        placement: 'right of',
        targets: ['Bob'],
        body: 'waiting for retry\nwith timeout',
        parentId: 'alt-1',
      },
    ],
    events: [],
    timeline: [
      { type: 'group-open', groupId: 'alt-1', order: 0 },
      { type: 'edge', edgeId: 'Alice-Bob', order: 1 },
      { type: 'group-branch', groupId: 'alt-1', label: 'failure', order: 2 },
      { type: 'note', noteId: 'note-1', order: 3 },
      { type: 'group-close', groupId: 'alt-1', order: 4 },
    ],
    meta: {
      direction: 'left to right',
      skinparams: {},
    },
  };
  const layout = buildSequenceLayout(diagram);
  const fragment = layout.fragments.find((group) => group.id === 'alt-1');
  const note = layout.notes.find((item) => item.id === 'note-1');
  const messageY = edgePoints(layout.edges[0])[0].y;
  const branchY = fragment.branches[0].y;

  assert.ok(fragment.y < messageY);
  assert.ok(fragment.y + fragment.height > note.y + note.height);
  assert.ok(fragment.x <= note.x);
  assert.ok(fragment.x + fragment.width >= note.x + note.width);
  assert.ok(branchY > messageY);
  assert.ok(branchY < note.y);
  assert.ok(note.y > messageY);
});

test('sequence activations follow notes inside fragments', () => {
  const diagram = {
    nodes: [
      { id: 'Alice', label: 'Alice', type: 'participant', members: [] },
      { id: 'Bob', label: 'Bob', type: 'participant', members: [] },
    ],
    edges: [
      { id: 'Alice-Bob', source: 'Alice', target: 'Bob', arrow: '->', label: 'login' },
    ],
    groups: [
      {
        id: 'alt-1',
        type: 'alt',
        title: 'success',
        branches: [{ type: 'else', label: 'failure' }],
      },
    ],
    notes: [
      {
        id: 'note-1',
        type: 'note',
        placement: 'right of',
        targets: ['Bob'],
        body: 'waiting for retry\nwith timeout',
        parentId: 'alt-1',
      },
    ],
    events: [
      { id: 'event-1', type: 'activate', target: 'Bob' },
      { id: 'event-2', type: 'deactivate', target: 'Bob' },
    ],
    timeline: [
      { type: 'edge', edgeId: 'Alice-Bob', order: 0 },
      { type: 'event', eventId: 'event-1', order: 1 },
      { type: 'group-open', groupId: 'alt-1', order: 2 },
      { type: 'group-branch', groupId: 'alt-1', label: 'failure', order: 3 },
      { type: 'note', noteId: 'note-1', order: 4 },
      { type: 'group-close', groupId: 'alt-1', order: 5 },
      { type: 'event', eventId: 'event-2', order: 6 },
    ],
    meta: {
      direction: 'left to right',
      skinparams: {},
    },
  };
  const layout = buildSequenceLayout(diagram);
  const bob = layout.children.find((node) => node.id === 'Bob');
  const fragment = layout.fragments.find((group) => group.id === 'alt-1');
  const note = layout.notes.find((item) => item.id === 'note-1');
  const activation = layout.activations[0];
  const branchY = fragment.branches[0].y;
  const messageY = edgePoints(layout.edges[0])[0].y;

  assert.equal(activation.x, bob.x + bob.width / 2 - 5);
  assert.equal(activation.y, messageY + 8);
  assert.ok(activation.y + activation.height > note.y + note.height);
  assert.ok(fragment.y < branchY);
  assert.ok(fragment.y + fragment.height > branchY);
});

test('sequence message endpoints attach to active activation sides', () => {
  const diagram = {
    nodes: [
      { id: 'Alice', label: 'Alice', type: 'participant', members: [] },
      { id: 'Bob', label: 'Bob', type: 'participant', members: [] },
    ],
    edges: [
      { id: 'Alice-Bob', source: 'Alice', target: 'Bob', arrow: '->', label: 'start' },
      { id: 'Alice-Bob-2', source: 'Alice', target: 'Bob', arrow: '->', label: 'next' },
      { id: 'Bob-Alice', source: 'Bob', target: 'Alice', arrow: '-->', label: 'reply' },
    ],
    groups: [],
    notes: [],
    events: [
      { id: 'event-1', type: 'activate', target: 'Bob' },
      { id: 'event-2', type: 'deactivate', target: 'Bob' },
    ],
    timeline: [
      { type: 'edge', edgeId: 'Alice-Bob', order: 0 },
      { type: 'event', eventId: 'event-1', order: 1 },
      { type: 'edge', edgeId: 'Alice-Bob-2', order: 2 },
      { type: 'edge', edgeId: 'Bob-Alice', order: 3 },
      { type: 'event', eventId: 'event-2', order: 4 },
    ],
    meta: {
      direction: 'left to right',
      skinparams: {},
    },
  };
  const layout = buildSequenceLayout(diagram);
  const activation = layout.activations[0];
  const incoming = edgePoints(layout.edges[1]);
  const outgoing = edgePoints(layout.edges[2]);

  assert.equal(incoming[incoming.length - 1].x, activation.x);
  assert.equal(outgoing[0].x, activation.x);
});

test('edgePoints preserves ELK geometry so labels match rendered arrows', () => {
  const edge = {
    id: 'A-B',
    data: { source: 'A', target: 'B' },
    sections: [{
      startPoint: { x: 0, y: 0 },
      bendPoints: [{ x: 50, y: 10 }],
      endPoint: { x: 100, y: 0 },
    }],
  };

  assert.deepEqual(edgePoints(edge), [
    { x: 0, y: 0 },
    { x: 50, y: 10 },
    { x: 100, y: 0 },
  ]);
});

test('normalizeLayout creates visible edge sections when ELK omits them', () => {
  const diagram = createDiagram([
    { id: 'A-B', source: 'A', target: 'B', arrow: '-->' },
  ]);
  const layout = {
    children: [
      { id: 'A', x: 0, y: 0, width: 112, height: 42 },
      { id: 'B', x: 180, y: 0, width: 112, height: 42 },
    ],
    edges: [{ id: 'A-B' }],
  };

  const normalized = normalizeLayout(layout, diagram, {
    layoutAlgorithm: 'rectpacking',
  });
  const points = edgePoints(normalized.edges[0]);

  assert.equal(points.length, 2);
  assert.ok(segmentLength(points[0], points[1]) > 4);
});

test('normalizeLayout anchors actor edges to the visible glyph, not the label box', () => {
  const actor = { id: 'User', label: 'User', type: 'actor', members: [] };
  const usecase = { id: 'Login', label: 'Login', type: 'usecase', members: [] };
  const diagram = {
    nodes: [actor, usecase],
    edges: [{ id: 'User-Login', source: 'User', target: 'Login', arrow: '-->' }],
    groups: [],
    notes: [],
    events: [],
    meta: {
      direction: 'left to right',
      skinparams: {},
    },
  };
  const layout = {
    children: [
      { id: 'User', x: 0, y: 0, width: 82, height: 104, data: actor },
      { id: 'Login', x: 180, y: 8, width: 126, height: 58, data: usecase },
    ],
    edges: [{ id: 'User-Login' }],
  };

  const normalized = normalizeLayout(layout, diagram, {
    layoutAlgorithm: 'rectpacking',
  });
  const points = edgePoints(normalized.edges[0]);

  assert.ok(points[0].x < 66);
  assert.ok(points[0].y < 58);
  assert.ok(points[0].y > 16);
});

test('normalizeLayout pulls existing ELK actor endpoints back to the visible glyph', () => {
  const actor = { id: 'User', label: 'User', type: 'actor', members: [] };
  const usecase = { id: 'Login', label: 'Login', type: 'usecase', members: [] };
  const diagram = {
    nodes: [actor, usecase],
    edges: [{ id: 'User-Login', source: 'User', target: 'Login', arrow: '-->' }],
    groups: [],
    notes: [],
    events: [],
    meta: {
      direction: 'left to right',
      skinparams: {},
    },
  };
  const layout = {
    children: [
      { id: 'User', x: 0, y: 0, width: 82, height: 104, data: actor },
      { id: 'Login', x: 180, y: 8, width: 126, height: 58, data: usecase },
    ],
    edges: [{
      id: 'User-Login',
      sections: [{
        startPoint: { x: 82, y: 52 },
        bendPoints: [{ x: 132, y: 52 }],
        endPoint: { x: 180, y: 37 },
      }],
    }],
  };

  const normalized = normalizeLayout(layout, diagram, {
    layoutAlgorithm: 'layered',
  });
  const points = edgePoints(normalized.edges[0]);

  assert.ok(points[0].x < 66);
  assert.ok(points[0].y < 56);
  assert.deepEqual(points[1], { x: 132, y: 52 });
});

test('normalizeLayout preserves existing rectangular ELK endpoints', () => {
  const diagram = createDiagram([
    { id: 'A-B', source: 'A', target: 'B', arrow: '-->' },
  ]);
  const layout = {
    children: [
      { id: 'A', x: 0, y: 0, width: 112, height: 42 },
      { id: 'B', x: 180, y: 0, width: 112, height: 42 },
    ],
    edges: [{
      id: 'A-B',
      sections: [{
        startPoint: { x: 112, y: 21 },
        endPoint: { x: 180, y: 21 },
      }],
    }],
  };

  const normalized = normalizeLayout(layout, diagram, {
    layoutAlgorithm: 'layered',
  });

  assert.deepEqual(edgePoints(normalized.edges[0]), [
    { x: 112, y: 21 },
    { x: 180, y: 21 },
  ]);
});

test('normalizeLayout reroutes valid-looking edges hidden inside nodes', () => {
  const diagram = createDiagram([
    { id: 'A-B', source: 'A', target: 'B', arrow: '-->' },
  ]);
  const layout = {
    children: [
      { id: 'A', x: 0, y: 0, width: 112, height: 42 },
      { id: 'B', x: 180, y: 0, width: 112, height: 42 },
    ],
    edges: [{
      id: 'A-B',
      sections: [{
        startPoint: { x: 56, y: 21 },
        endPoint: { x: 236, y: 21 },
      }],
    }],
  };

  const normalized = normalizeLayout(layout, diagram, {
    layoutAlgorithm: 'layered',
  });
  const points = edgePoints(normalized.edges[0]);

  assert.ok(points[0].x > 112);
  assert.ok(points[points.length - 1].x < 180);
});

test('normalizeLayout reroutes valid-looking edges crossing other nodes', () => {
  const diagram = createDiagram([
    { id: 'A-C', source: 'A', target: 'C', arrow: '-->' },
  ]);
  const layout = {
    children: [
      { id: 'A', x: 0, y: 0, width: 80, height: 40 },
      { id: 'B', x: 120, y: 0, width: 80, height: 40 },
      { id: 'C', x: 240, y: 0, width: 80, height: 40 },
    ],
    edges: [{
      id: 'A-C',
      sections: [{
        startPoint: { x: 80, y: 20 },
        endPoint: { x: 240, y: 20 },
      }],
    }],
  };

  const normalized = normalizeLayout(layout, diagram, {
    layoutAlgorithm: 'layered',
  });
  const points = edgePoints(normalized.edges[0]);

  assert.ok(points.length > 2);
  for (let index = 0; index < points.length - 1; index += 1) {
    assert.equal(
      intersects(
        {
          x: Math.min(points[index].x, points[index + 1].x),
          y: Math.min(points[index].y, points[index + 1].y),
          width: Math.abs(points[index + 1].x - points[index].x) || 1,
          height: Math.abs(points[index + 1].y - points[index].y) || 1,
        },
        layout.children[1],
        0,
      ),
      false,
    );
  }
});

test('normalizeLayout separates overlapping nodes and reroutes degenerate edges', () => {
  const diagram = createDiagram([
    { id: 'A-B', source: 'A', target: 'B', arrow: '-->' },
    { id: 'A-C', source: 'A', target: 'C', arrow: '-->' },
  ]);
  const layout = {
    children: [
      { id: 'A', x: 8, y: 8, width: 112, height: 42 },
      { id: 'B', x: 8, y: 8, width: 112, height: 42 },
      { id: 'C', x: 8, y: 8, width: 112, height: 42 },
    ],
    edges: [
      {
        id: 'A-B',
        sections: [{
          startPoint: { x: 64, y: 29 },
          endPoint: { x: 64, y: 29 },
        }],
      },
      { id: 'A-C' },
    ],
  };

  const normalized = normalizeLayout(layout, diagram, {
    layoutAlgorithm: 'sporeCompaction',
    nodeOverlapGap: 20,
  });

  for (let left = 0; left < normalized.children.length; left += 1) {
    for (let right = left + 1; right < normalized.children.length; right += 1) {
      assert.equal(intersects(normalized.children[left], normalized.children[right], 0), false);
    }
  }

  normalized.edges.forEach((edge) => {
    const points = edgePoints(edge);
    assert.ok(points.length >= 2);
    assert.ok(segmentLength(points[0], points[points.length - 1]) > 4);
  });

  assert.ok(edgePoints(normalized.edges.find((edge) => edge.id === 'A-C')).length > 2);
});
