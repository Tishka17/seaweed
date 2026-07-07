import { nodeMinimumSize, nodeTextInsets } from './node-shapes.js';
import { nodeTextRows, noteSize, textWidth } from '../utils/text.js';

const LAYOUT = {
  marginX: 36,
  headerY: 56,
  participantGap: 88,
  headerMessageGap: 48,
  minMessageStartY: 170,
  messageGap: 54,
  branchGap: 24,
  lifelineBottomPadding: 48,
};

function estimateParticipantSize(node) {
  const minimum = nodeMinimumSize(node);
  const insets = nodeTextInsets(node);
  const rows = nodeTextRows(node);
  let longest = 0;

  rows.forEach((row) => {
    longest = Math.max(longest, textWidth(row.text, row.type === 'title' ? 14 : 12));
  });

  return {
    width: Math.max(minimum.width, Math.ceil(longest + insets.left + insets.right)),
    height: Math.max(minimum.height, Math.ceil(rows.length * 20 + insets.top + insets.bottom)),
  };
}

function isSequenceParticipant(node) {
  return ['actor', 'participant', 'boundary', 'control', 'entity', 'database', 'collections', 'queue'].includes(node.type);
}

function edgeEndpointOrder(diagram) {
  const ids = [];

  diagram.edges.forEach((edge) => {
    if (!ids.includes(edge.source)) {
      ids.push(edge.source);
    }
    if (!ids.includes(edge.target)) {
      ids.push(edge.target);
    }
  });

  return ids;
}

export function isSequenceDiagram(diagram) {
  if (diagram.events.length > 0) {
    return true;
  }

  return diagram.nodes.some((node) => node.type === 'participant');
}

function orderedParticipants(diagram) {
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  const ids = edgeEndpointOrder(diagram);
  const ordered = [];

  diagram.nodes.forEach((node) => {
    if (isSequenceParticipant(node) && !ids.includes(node.id)) {
      ids.push(node.id);
    }
  });

  ids.forEach((id) => {
    if (byId.has(id)) {
      ordered.push(byId.get(id));
    }
  });

  diagram.nodes.forEach((node) => {
    if (!ordered.includes(node)) {
      ordered.push(node);
    }
  });

  return ordered;
}

function messageY(index, timeline) {
  return timeline.messageStartY + index * LAYOUT.messageGap;
}

function participantCenter(node) {
  return node.x + node.width / 2;
}

function activeActivationAt(activations, targetId, y) {
  let active = null;

  activations.forEach((activation) => {
    if (activation.target === targetId && y >= activation.y && y <= activation.y + activation.height) {
      active = activation;
    }
  });

  return active;
}

function activationSideX(node, otherNode, activation) {
  const centerX = participantCenter(node);
  const otherX = participantCenter(otherNode);

  return otherX < centerX
    ? activation.x
    : activation.x + activation.width;
}

function endpointX(node, otherNode, y, activations) {
  const activation = activeActivationAt(activations, node.id, y);

  if (!activation) {
    return participantCenter(node);
  }

  return activationSideX(node, otherNode, activation);
}

function edgeSection(edge, sourceNode, targetNode, timeline, activations) {
  const y = timeline.edgeYById.get(edge.id) ?? messageY(0, timeline);
  const sourceX = endpointX(sourceNode, targetNode, y, activations);
  const targetX = endpointX(targetNode, sourceNode, y, activations);

  if (sourceNode.id === targetNode.id) {
    const loopWidth = Math.max(48, sourceNode.width * 0.42);
    const active = activeActivationAt(activations, sourceNode.id, y);
    const loopStartX = active ? active.x + active.width : sourceX;

    return {
      id: `${edge.id}_s0`,
      startPoint: { x: loopStartX, y },
      bendPoints: [
        { x: loopStartX + loopWidth, y },
        { x: loopStartX + loopWidth, y: y + LAYOUT.messageGap / 2 },
      ],
      endPoint: { x: loopStartX, y: y + LAYOUT.messageGap / 2 },
    };
  }

  return {
    id: `${edge.id}_s0`,
    startPoint: { x: sourceX, y },
    endPoint: { x: targetX, y },
  };
}

function buildTimeline(diagram, nodeById, messageStartY) {
  const edgeById = new Map(diagram.edges.map((edge) => [edge.id, edge]));
  const noteById = new Map(diagram.notes.map((note) => [note.id, note]));
  const edgeYById = new Map();
  const noteLayoutById = new Map();
  const branchYByOrder = new Map();
  const eventYById = new Map();
  const items = diagram.timeline && diagram.timeline.length > 0
    ? diagram.timeline
    : [
      ...diagram.edges.map((edge) => ({ type: 'edge', edgeId: edge.id })),
      ...diagram.notes.map((note) => ({ type: 'note', noteId: note.id })),
    ];
  let y = messageStartY;
  let hasContent = false;
  let currentEventY = messageStartY;
  let contentEndY = messageStartY;

  items.forEach((item) => {
    if (item.type === 'group-branch') {
      const branchY = hasContent ? y - LAYOUT.messageGap / 2 : y;
      branchYByOrder.set(item.order, branchY);
      currentEventY = branchY;
      contentEndY = Math.max(contentEndY, branchY);
      y += LAYOUT.branchGap;
      return;
    }

    if (item.type === 'edge' && edgeById.has(item.edgeId) && !edgeYById.has(item.edgeId)) {
      edgeYById.set(item.edgeId, y);
      currentEventY = y;
      contentEndY = Math.max(contentEndY, y);
      y += LAYOUT.messageGap;
      hasContent = true;
      return;
    }

    if (item.type === 'note' && noteById.has(item.noteId) && !noteLayoutById.has(item.noteId)) {
      const note = noteById.get(item.noteId);
      const layout = layoutSequenceNote(note, nodeById, y);
      noteLayoutById.set(item.noteId, layout);
      currentEventY = layout.y + layout.height;
      contentEndY = Math.max(contentEndY, currentEventY);
      y += Math.max(LAYOUT.messageGap, layout.height + 20);
      hasContent = true;
      return;
    }

    if (item.type === 'event' && item.eventId) {
      eventYById.set(item.eventId, currentEventY);
    }
  });

  diagram.edges.forEach((edge) => {
    if (!edgeYById.has(edge.id)) {
      edgeYById.set(edge.id, y);
      currentEventY = y;
      contentEndY = Math.max(contentEndY, y);
      y += LAYOUT.messageGap;
      hasContent = true;
    }
  });

  diagram.notes.forEach((note) => {
    if (!noteLayoutById.has(note.id)) {
      const layout = layoutSequenceNote(note, nodeById, y);
      noteLayoutById.set(note.id, layout);
      currentEventY = layout.y + layout.height;
      contentEndY = Math.max(contentEndY, currentEventY);
      y += Math.max(LAYOUT.messageGap, layout.height + 20);
      hasContent = true;
    }
  });

  return {
    messageStartY,
    edgeYById,
    noteLayoutById,
    branchYByOrder,
    eventYById,
    contentEndY: hasContent ? contentEndY : messageStartY,
  };
}

function layoutSequenceNote(note, nodeById, centerY) {
  const size = noteSize(note);
  const targets = (note.targets || [])
    .map((target) => nodeById.get(target))
    .filter(Boolean);
  let x = LAYOUT.marginX;
  let y = centerY - size.height / 2;

  if (targets.length === 1) {
    const target = targets[0];
    const lifelineX = target.x + target.width / 2;

    if (note.placement === 'right of') {
      x = lifelineX + 18;
    } else if (note.placement === 'left of') {
      x = lifelineX - size.width - 18;
    } else {
      x = lifelineX - size.width / 2;
    }
  } else if (targets.length > 1) {
    const left = Math.min(...targets.map((target) => target.x + target.width / 2));
    const right = Math.max(...targets.map((target) => target.x + target.width / 2));
    x = left + (right - left) / 2 - size.width / 2;
  }

  return {
    ...note,
    x,
    y,
    width: size.width,
    height: size.height,
  };
}

function includeRange(range, top, bottom, left = Infinity, right = -Infinity) {
  range.minY = Math.min(range.minY, top);
  range.maxY = Math.max(range.maxY, bottom);
  range.minX = Math.min(range.minX, left);
  range.maxX = Math.max(range.maxX, right);
}

function buildActivations(diagram, nodeById, timeline, lifelineEndY) {
  const activations = [];
  const activeByTarget = new Map();
  const edgeById = new Map(diagram.edges.map((edge) => [edge.id, edge]));
  const eventById = new Map(diagram.events.map((event) => [event.id, event]));
  let currentY = timeline.messageStartY;
  const items = diagram.timeline && diagram.timeline.length > 0
    ? diagram.timeline
    : [
      ...diagram.edges.map((edge) => ({ type: 'edge', edgeId: edge.id })),
      ...diagram.events.map((event) => ({ type: 'event', eventId: event.id })),
    ];

  items.forEach((item) => {
    if (item.type === 'edge' && edgeById.has(item.edgeId)) {
      currentY = timeline.edgeYById.get(item.edgeId) ?? currentY;
      return;
    }

    if (item.type !== 'event') {
      return;
    }

    const event = eventById.get(item.eventId);
    if (!event.target || (event.type !== 'activate' && event.type !== 'deactivate')) {
      return;
    }

    const node = nodeById.get(event.target);
    if (!node) {
      return;
    }

    const eventY = timeline.eventYById.get(event.id) ?? currentY;

    if (event.type === 'activate') {
      activeByTarget.set(event.target, {
        id: `${event.id}-activation`,
        target: event.target,
        x: node.x + node.width / 2 - 5,
        y: eventY + 8,
        width: 10,
        startY: eventY,
      });
      return;
    }

    const active = activeByTarget.get(event.target);
    if (!active) {
      return;
    }

    const endY = Math.max(active.startY + LAYOUT.messageGap, eventY);
    active.height = Math.max(28, endY - active.y + 8);
    activations.push(active);
    activeByTarget.delete(event.target);
  });

  activeByTarget.forEach((active) => {
    active.height = Math.max(28, lifelineEndY - active.y - 8);
    activations.push(active);
  });

  return activations;
}

function buildSequenceFragments(diagram, bounds, timeline) {
  let offset = 0;
  const edgeById = new Map(diagram.edges.map((edge) => [edge.id, edge]));
  const noteById = new Map(diagram.notes.map((note) => [note.id, note]));
  const groupRanges = new Map();
  const openGroups = [];

  (diagram.timeline || []).forEach((item) => {
    if (item.type === 'edge' && edgeById.has(item.edgeId)) {
      const y = timeline.edgeYById.get(item.edgeId) ?? timeline.messageStartY;
      openGroups.forEach((groupId) => {
        const range = groupRanges.get(groupId);
        includeRange(range, y - 20, y + 22);
      });
      return;
    }

    if (item.type === 'note' && noteById.has(item.noteId)) {
      const note = timeline.noteLayoutById.get(item.noteId);
      if (!note) {
        return;
      }

      openGroups.forEach((groupId) => {
        const range = groupRanges.get(groupId);
        includeRange(
          range,
          note.y - 8,
          note.y + note.height + 8,
          note.x - 8,
          note.x + note.width + 8,
        );
      });
      return;
    }

    if (item.type === 'group-open') {
      groupRanges.set(item.groupId, {
        minY: Infinity,
        maxY: -Infinity,
        minX: Infinity,
        maxX: -Infinity,
        branches: [],
      });
      openGroups.push(item.groupId);
      return;
    }

    if (item.type === 'group-branch') {
      const range = groupRanges.get(item.groupId);
      if (range) {
        const y = timeline.branchYByOrder.get(item.order);
        if (Number.isFinite(y)) {
          includeRange(range, y - 16, y + 16);
        }
        range.branches.push({
          label: item.label || 'else',
          y,
        });
      }
      return;
    }

    if (item.type === 'group-close') {
      const index = openGroups.lastIndexOf(item.groupId);
      if (index >= 0) {
        openGroups.splice(index, 1);
      }
    }
  });

  return diagram.groups
    .filter((group) => ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'group', 'box', 'ref'].includes(group.type) || group.type === 'divider')
    .map((group) => {
      if (group.type === 'divider') {
        const y = timeline.messageStartY - 34 - offset * 26;
        offset += 1;
        return {
          ...group,
          x: bounds.x,
          y,
          width: bounds.width,
          height: 24,
        };
      }

      const inset = offset * 8;
      offset += 1;
      const range = groupRanges.get(group.id);
      const hasContentRange = range && range.minY !== Infinity && range.maxY >= range.minY;
      const topY = hasContentRange
        ? range.minY - 18
        : timeline.messageStartY - 26;
      const bottomY = hasContentRange
        ? range.maxY + 18
        : bounds.maxY;
      const leftX = hasContentRange && Number.isFinite(range.minX)
        ? Math.min(bounds.x, range.minX)
        : bounds.x;
      const rightX = hasContentRange && Number.isFinite(range.maxX)
        ? Math.max(bounds.maxX, range.maxX)
        : bounds.maxX;

      return {
        ...group,
        branches: (range?.branches || group.branches || []).map((branch) => ({
          ...branch,
          y: branch.y,
        })),
        x: leftX - 14 - inset,
        y: topY - inset,
        width: rightX - leftX + 28 + inset * 2,
        height: Math.max(54, bottomY - topY) + inset * 2,
      };
    });
}

export function buildSequenceLayout(diagram) {
  const participants = orderedParticipants(diagram);
  let x = LAYOUT.marginX;
  const children = participants.map((node) => {
    const size = estimateParticipantSize(node);
    const layoutNode = {
      id: node.id,
      x,
      y: LAYOUT.headerY,
      width: size.width,
      height: size.height,
      data: node,
      labels: [{ text: node.label || node.id }],
    };
    x += size.width + LAYOUT.participantGap;
    return layoutNode;
  });
  const nodeById = new Map(children.map((node) => [node.id, node]));
  const headerBottom = children.reduce((bottom, node) => Math.max(bottom, node.y + node.height), LAYOUT.headerY);
  const timeline = buildTimeline(
    diagram,
    nodeById,
    Math.max(LAYOUT.minMessageStartY, headerBottom + LAYOUT.headerMessageGap),
  );
  const lifelineEndY = timeline.contentEndY + LAYOUT.lifelineBottomPadding;
  const activations = buildActivations(diagram, nodeById, timeline, lifelineEndY);
  const edges = diagram.edges
    .map((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);

      if (!source || !target) {
        return null;
      }

      return {
        id: edge.id,
        data: edge,
        sources: [edge.source],
        targets: [edge.target],
        sections: [edgeSection(edge, source, target, timeline, activations)],
      };
    })
    .filter(Boolean);
  const bounds = {
    x: LAYOUT.marginX,
    y: LAYOUT.headerY,
    width: Math.max(1, x - LAYOUT.participantGap - LAYOUT.marginX),
    height: lifelineEndY - LAYOUT.headerY,
    minX: LAYOUT.marginX,
    minY: LAYOUT.headerY,
    maxX: Math.max(LAYOUT.marginX + 1, x - LAYOUT.participantGap),
    maxY: lifelineEndY,
  };

  return {
    id: 'sequence-root',
    type: 'sequence',
    children,
    edges,
    lifelines: children.map((node) => ({
      id: node.id,
      x: node.x + node.width / 2,
      y1: node.y + node.height + 10,
      y2: lifelineEndY,
    })),
    activations,
    fragments: buildSequenceFragments(diagram, bounds, timeline),
    notes: Array.from(timeline.noteLayoutById.values()),
  };
}
