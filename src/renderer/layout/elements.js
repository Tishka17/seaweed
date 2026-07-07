import { avoidCollisions, boundsFromItems, expandBounds } from '../utils/geometry.js';
import { eventSize, labelBox, noteSize } from '../utils/text.js';

const CONTAINER_GROUP_TYPES = ['package', 'namespace', 'rectangle', 'node', 'frame', 'folder', 'cloud', 'database'];
const FRAGMENT_GROUP_TYPES = ['group', 'alt', 'opt', 'loop', 'par', 'break', 'critical', 'box', 'ref'];

function isContainerGroup(group) {
  return CONTAINER_GROUP_TYPES.includes(group.type);
}

function isFragmentGroup(group) {
  return FRAGMENT_GROUP_TYPES.includes(group.type);
}

export function groupLabel(group) {
  if (group.type === 'divider') {
    return group.title;
  }

  if (group.type === group.title) {
    return group.type;
  }

  return `${group.type}: ${group.title}`;
}

export function createContainerBounds(diagram, nodeById) {
  const boundsByGroupId = new Map();
  const groups = diagram.groups.filter(isContainerGroup);

  for (let pass = 0; pass < groups.length + 1; pass += 1) {
    for (let index = groups.length - 1; index >= 0; index -= 1) {
      const group = groups[index];
      const children = [];

      for (let nodeIndex = 0; nodeIndex < diagram.nodes.length; nodeIndex += 1) {
        const node = diagram.nodes[nodeIndex];
        const layoutNode = nodeById.get(node.id);
        if (node.parentId === group.id && layoutNode) {
          children.push(layoutNode);
        }
      }

      for (let childIndex = 0; childIndex < groups.length; childIndex += 1) {
        const childGroup = groups[childIndex];
        const childBounds = boundsByGroupId.get(childGroup.id);
        if (childGroup.parentId === group.id && childBounds) {
          children.push(childBounds);
        }
      }

      if (children.length > 0) {
        const label = labelBox(groupLabel(group), 12);
        boundsByGroupId.set(
          group.id,
          expandBounds(boundsFromItems(children), {
            left: 12,
            right: 12,
            top: Math.max(26, label.height + 8),
            bottom: 12,
          }),
        );
      }
    }
  }

  return diagram.groups
    .filter((group) => boundsByGroupId.has(group.id))
    .map((group) => ({
      ...group,
      ...boundsByGroupId.get(group.id),
    }));
}

export function resolveNotePositions(notes, nodeById, baseBounds) {
  const nodeObstacles = Array.from(nodeById.values());
  const candidates = notes.map((note, index) => {
    const size = noteSize(note);
    const targets = (note.targets || [])
      .map((target) => nodeById.get(target))
      .filter(Boolean);
    let x = baseBounds.x + index * 18;
    let y = baseBounds.maxY + 34 + index * 18;

    if (targets.length === 1) {
      const target = targets[0];
      if (note.placement === 'right of') {
        x = target.x + target.width + 18;
        y = target.y + target.height / 2 - size.height / 2;
      } else if (note.placement === 'left of') {
        x = target.x - size.width - 18;
        y = target.y + target.height / 2 - size.height / 2;
      } else {
        x = target.x + target.width / 2 - size.width / 2;
        y = target.y - size.height - 18;
      }
    } else if (targets.length > 1) {
      const targetBounds = boundsFromItems(targets);
      x = targetBounds.x + targetBounds.width / 2 - size.width / 2;
      y = targetBounds.y - size.height - 18;
    }

    return {
      ...note,
      x,
      y,
      width: size.width,
      height: size.height,
    };
  });

  return avoidCollisions(candidates, nodeObstacles, 14);
}

export function resolveEventPositions(events, nodeById, baseBounds) {
  const countsByTarget = new Map();

  const candidates = events.map((event, index) => {
    const size = eventSize(event);
    const target = event.target ? nodeById.get(event.target) : null;
    let x = baseBounds.maxX + 18;
    let y = baseBounds.y + index * (size.height + 8);

    if (target) {
      const count = countsByTarget.get(event.target) || 0;
      countsByTarget.set(event.target, count + 1);
      x = target.x + target.width + 8;
      y = target.y + 8 + count * (size.height + 6);
    }

    return {
      ...event,
      x,
      y,
      width: size.width,
      height: size.height,
    };
  });

  return avoidCollisions(candidates, Array.from(nodeById.values()), 10);
}

export function resolveFragmentBounds(groups, baseBounds) {
  let frameOffset = 0;
  let dividerOffset = 0;

  return groups
    .filter((group) => isFragmentGroup(group) || group.type === 'divider')
    .map((group) => {
      if (group.type === 'divider') {
        const y = baseBounds.y - 22 - dividerOffset * 24;
        dividerOffset += 1;
        return {
          ...group,
          x: baseBounds.x,
          y,
          width: baseBounds.width,
          height: 24,
        };
      }

      const offset = frameOffset * 8;
      frameOffset += 1;
      return {
        ...group,
        x: baseBounds.x - 10 - offset,
        y: baseBounds.y - 10 - offset,
        width: baseBounds.width + 20 + offset * 2,
        height: baseBounds.height + 20 + offset * 2,
      };
    });
}
