import * as d3 from 'd3';
import { GEOMETRY } from '../theme.js';
import {
  edgePath,
  layoutCardinalityLabels,
  layoutEdgeLabels,
  lineStyle,
  markerEnd,
  markerStart,
  strokeWidth,
} from '../layout/edges.js';
import { groupLabel } from '../layout/elements.js';
import { nodeTextVisible } from '../layout/node-shapes.js';
import { labelBox, nodeTextRows, noteLines } from '../utils/text.js';
import { drawNodeShape, nodeTextArea } from './node-shapes.js';

function applyContainerStroke(selection, theme) {
  return selection
    .attr('fill', theme.groupFill)
    .attr('stroke', theme.groupStroke)
    .attr('stroke-width', 1.2)
    .attr('stroke-dasharray', '4 3');
}

function containerPath(group) {
  if (group.type === 'package' || group.type === 'folder') {
    const tabWidth = Math.min(84, Math.max(48, group.width * 0.25));
    const tabHeight = 18;
    return `M ${group.x} ${group.y + tabHeight} V ${group.y} H ${group.x + tabWidth} L ${group.x + tabWidth + 12} ${group.y + tabHeight} H ${group.x + group.width} V ${group.y + group.height} H ${group.x} Z`;
  }

  if (group.type === 'frame') {
    const corner = 24;
    return `M ${group.x} ${group.y} H ${group.x + group.width - corner} L ${group.x + group.width} ${group.y + corner} V ${group.y + group.height} H ${group.x} Z`;
  }

  if (group.type === 'node') {
    const depth = 16;
    return `M ${group.x} ${group.y + depth} L ${group.x + depth} ${group.y} H ${group.x + group.width} V ${group.y + group.height - depth} L ${group.x + group.width - depth} ${group.y + group.height} H ${group.x} Z`;
  }

  if (group.type === 'cloud') {
    const x = group.x;
    const y = group.y;
    const w = group.width;
    const h = group.height;
    return [
      `M ${x + w * 0.16} ${y + h * 0.76}`,
      `C ${x - w * 0.02} ${y + h * 0.72}, ${x + w * 0.02} ${y + h * 0.36}, ${x + w * 0.22} ${y + h * 0.4}`,
      `C ${x + w * 0.28} ${y + h * 0.12}, ${x + w * 0.62} ${y + h * 0.08}, ${x + w * 0.7} ${y + h * 0.34}`,
      `C ${x + w * 0.95} ${y + h * 0.3}, ${x + w} ${y + h * 0.7}, ${x + w * 0.82} ${y + h * 0.78}`,
      'Z',
    ].join(' ');
  }

  return null;
}

function drawContainerShape(selection, group, theme) {
  if (group.type === 'database') {
    const capHeight = Math.min(18, group.height * 0.12);
    const path = [
      `M ${group.x} ${group.y + capHeight / 2}`,
      `C ${group.x} ${group.y - capHeight / 6}, ${group.x + group.width} ${group.y - capHeight / 6}, ${group.x + group.width} ${group.y + capHeight / 2}`,
      `L ${group.x + group.width} ${group.y + group.height - capHeight / 2}`,
      `C ${group.x + group.width} ${group.y + group.height + capHeight / 6}, ${group.x} ${group.y + group.height + capHeight / 6}, ${group.x} ${group.y + group.height - capHeight / 2}`,
      'Z',
    ].join(' ');

    applyContainerStroke(selection.append('path').attr('d', path), theme);
    selection
      .append('path')
      .attr('d', `M ${group.x} ${group.y + capHeight / 2} C ${group.x} ${group.y + capHeight * 1.05}, ${group.x + group.width} ${group.y + capHeight * 1.05}, ${group.x + group.width} ${group.y + capHeight / 2}`)
      .attr('fill', 'none')
      .attr('stroke', theme.groupStroke)
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '4 3');
    return;
  }

  const path = containerPath(group);
  if (path) {
    applyContainerStroke(selection.append('path').attr('d', path), theme);
    return;
  }

  applyContainerStroke(
    selection
      .append('rect')
      .attr('x', group.x)
      .attr('y', group.y)
      .attr('width', group.width)
      .attr('height', group.height)
      .attr('rx', group.type === 'rectangle' ? 2 : 3)
      .attr('ry', group.type === 'rectangle' ? 2 : 3),
    theme,
  );
}

export function drawContainers(root, containers, theme) {
  const groups = root
    .append('g')
    .attr('class', 'seaweed-containers')
    .selectAll('g.container')
    .data(containers)
    .join('g')
    .attr('class', 'container');

  groups.each(function renderContainerShape(group) {
    drawContainerShape(d3.select(this), group, theme);
  });

  groups
    .append('text')
    .attr('x', (group) => group.x + 10)
    .attr('y', (group) => group.y + 18)
    .attr('font-size', 12)
    .attr('font-weight', 600)
    .attr('fill', theme.mutedText)
    .text((group) => groupLabel(group));
}

export function drawFragments(root, fragments, theme) {
  const fragmentLayer = root.append('g').attr('class', 'seaweed-fragments');

  fragmentLayer
    .selectAll('g.fragment')
    .data(fragments.filter((group) => group.type !== 'divider'))
    .join('g')
    .attr('class', 'fragment')
    .each(function renderFragment(group) {
      const selection = d3.select(this);
      const label = groupLabel(group);
      const labelSize = labelBox(label, 12);

      selection
        .append('rect')
        .attr('x', group.x)
        .attr('y', group.y)
        .attr('width', group.width)
        .attr('height', group.height)
        .attr('fill', 'none')
        .attr('stroke', theme.groupStroke)
        .attr('stroke-width', 1.1);

      selection
        .append('path')
        .attr('d', `M ${group.x} ${group.y} h ${labelSize.width} l 10 10 v ${labelSize.height - 10} h ${-(labelSize.width + 10)} z`)
        .attr('fill', theme.groupFill)
        .attr('stroke', theme.groupStroke)
        .attr('stroke-width', 1.1);

      selection
        .append('text')
        .attr('x', group.x + 7)
        .attr('y', group.y + 17)
        .attr('font-size', 12)
        .attr('font-weight', 600)
        .attr('fill', theme.mutedText)
        .text(label);

      if (group.branches && group.branches.length > 0) {
        const step = group.height / (group.branches.length + 1);
        group.branches.forEach((branch, index) => {
          const y = branch.y ?? group.y + step * (index + 1);
          selection
            .append('line')
            .attr('x1', group.x)
            .attr('x2', group.x + group.width)
            .attr('y1', y)
            .attr('y2', y)
            .attr('stroke', theme.groupStroke)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4 4');

          selection
            .append('text')
            .attr('x', group.x + 8)
            .attr('y', y - 6)
            .attr('font-size', 11)
            .attr('fill', theme.mutedText)
            .text(branch.label);
        });
      }
    });

  fragmentLayer
    .selectAll('g.divider')
    .data(fragments.filter((group) => group.type === 'divider'))
    .join('g')
    .attr('class', 'divider')
    .each(function renderDivider(group) {
      const selection = d3.select(this);
      const y = group.y + group.height / 2;

      selection
        .append('line')
        .attr('x1', group.x)
        .attr('x2', group.x + group.width)
        .attr('y1', y)
        .attr('y2', y)
          .attr('stroke', theme.groupStroke)
        .attr('stroke-width', 1);

      selection
        .append('text')
        .attr('x', group.x + group.width / 2)
        .attr('y', y - 5)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', 12)
        .attr('font-weight', 600)
        .attr('fill', theme.mutedText)
        .text(group.title);
    });
}

export function drawEdges(root, edges, theme) {
  const edgeLayer = root.append('g').attr('class', 'seaweed-edges');
  const edgeLabels = layoutEdgeLabels(edges);
  const cardinalityLabels = layoutCardinalityLabels(edges, edgeLabels);

  edgeLayer
    .selectAll('path.edge-halo')
    .data(edges)
    .join('path')
    .attr('class', 'edge-halo')
    .attr('d', edgePath)
    .attr('fill', 'none')
    .attr('stroke', theme.background)
    .attr('stroke-width', (edge) => strokeWidth(edge) + 4)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .attr('opacity', 0.9);

  edgeLayer
    .selectAll('path.edge')
    .data(edges)
    .join('path')
    .attr('class', 'edge')
    .attr('d', edgePath)
    .attr('fill', 'none')
    .attr('stroke', theme.edgeStroke)
    .attr('stroke-width', strokeWidth)
    .attr('stroke-dasharray', lineStyle)
    .attr('marker-start', markerStart)
    .attr('marker-end', markerEnd);

  edgeLayer
    .selectAll('g.edge-label')
    .data(edgeLabels)
    .join('g')
    .attr('class', 'edge-label')
    .attr('transform', (label) => `translate(${label.x + label.width / 2},${label.y + label.height / 2})`)
    .each(function renderEdgeLabel(label) {
      d3.select(this)
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', 12)
        .attr('fill', theme.text)
        .attr('stroke', theme.background)
        .attr('stroke-width', 2.5)
        .attr('paint-order', 'stroke')
        .attr('stroke-linejoin', 'round')
        .text(label.text);
    });

  drawCardinalities(edgeLayer, cardinalityLabels, theme);
}

export function drawSequenceLifelines(root, lifelines, theme) {
  root
    .append('g')
    .attr('class', 'seaweed-lifelines')
    .selectAll('line.lifeline')
    .data(lifelines)
    .join('line')
    .attr('class', 'lifeline')
    .attr('x1', (lifeline) => lifeline.x)
    .attr('x2', (lifeline) => lifeline.x)
    .attr('y1', (lifeline) => lifeline.y1)
    .attr('y2', (lifeline) => lifeline.y2)
    .attr('stroke', theme.groupStroke)
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '5 5');
}

export function drawSequenceActivations(root, activations, theme) {
  root
    .append('g')
    .attr('class', 'seaweed-activations')
    .selectAll('rect.activation')
    .data(activations)
    .join('rect')
    .attr('class', 'activation')
    .attr('x', (activation) => activation.x)
    .attr('y', (activation) => activation.y)
    .attr('width', (activation) => activation.width)
    .attr('height', (activation) => activation.height)
    .attr('rx', 1)
    .attr('ry', 1)
    .attr('fill', theme.background)
    .attr('stroke', theme.edgeStroke)
    .attr('stroke-width', 1.2);
}

function drawCardinalities(edgeLayer, labels, theme) {
  const cardinality = edgeLayer
    .selectAll('g.cardinality')
    .data(labels)
    .join('g')
    .attr('class', 'cardinality')
    .attr('transform', (label) => `translate(${label.x + label.width / 2},${label.y + label.height / 2})`);

  cardinality.each(function renderCardinality(label) {
    d3.select(this)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 11)
      .attr('fill', theme.mutedText)
      .attr('stroke', theme.background)
      .attr('stroke-width', 2)
      .attr('paint-order', 'stroke')
      .attr('stroke-linejoin', 'round')
      .text(label.text);
  });
}

export function drawNodes(root, nodes, theme) {
  const node = root
    .append('g')
    .attr('class', 'seaweed-nodes')
    .selectAll('g.node')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .attr('transform', (item) => `translate(${item.x},${item.y})`);

  node.each(function renderNodeShape(item) {
    drawNodeShape(d3.select(this), item, theme);
  });

  node.each(function renderNodeText(item) {
    if (!nodeTextVisible(item.data)) {
      return;
    }

    const selection = d3.select(this);
    const rows = nodeTextRows(item.data);
    const textArea = nodeTextArea(item);
    const contentHeight = rows.reduce((total, row) => {
      if (row.type === 'separator') {
        return total + 10;
      }

      return total + (row.type === 'title' ? GEOMETRY.titleLineHeight : GEOMETRY.textLineHeight);
    }, 0);
    let y = textArea.y + (textArea.height - contentHeight) / 2;

    rows.forEach((row) => {
      if (row.type === 'separator') {
        y += 5;
        selection
          .append('line')
          .attr('x1', textArea.x)
          .attr('x2', textArea.x + textArea.width)
          .attr('y1', y)
          .attr('y2', y)
          .attr('stroke', theme.nodeStroke)
          .attr('stroke-width', 1);
        y += 5;
        return;
      }

      const isTitle = row.type === 'title';
      const isMember = row.type === 'field' || row.type === 'method';
      const lineHeight = isTitle ? GEOMETRY.titleLineHeight : GEOMETRY.textLineHeight;
      const textY = y + lineHeight / 2;

      selection
        .append('text')
        .attr('x', isMember ? textArea.x : textArea.x + textArea.width / 2)
        .attr('y', textY)
        .attr('text-anchor', isMember ? 'start' : 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', isTitle ? 14 : 12)
        .attr('font-weight', isTitle ? 600 : 400)
        .attr('font-style', item.data.modifiers?.includes('abstract') && isTitle ? 'italic' : 'normal')
        .attr('text-decoration', item.data.type === 'object' && isTitle ? 'underline' : 'none')
        .attr('fill', isTitle ? theme.text : theme.mutedText)
        .text(row.text);

      y += lineHeight;
    });
  });
}

export function drawNotes(root, notes, theme) {
  root
    .append('g')
    .attr('class', 'seaweed-notes')
    .selectAll('g.note')
    .data(notes)
    .join('g')
    .attr('class', 'note')
    .attr('transform', (note) => `translate(${note.x},${note.y})`)
    .each(function renderNote(note) {
      const selection = d3.select(this);
      const lines = noteLines(note);

      selection
        .append('rect')
        .attr('width', note.width)
        .attr('height', note.height)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('fill', theme.noteFill)
        .attr('stroke', theme.noteStroke)
        .attr('stroke-width', 1);

      lines.forEach((line, index) => {
        selection
          .append('text')
          .attr('x', 10)
          .attr('y', 18 + index * 18)
          .attr('dominant-baseline', 'central')
          .attr('font-size', 13)
          .attr('fill', theme.text)
          .text(line);
      });
    });
}

export function drawEvents(root, events, theme) {
  root
    .append('g')
    .attr('class', 'seaweed-events')
    .selectAll('g.event')
    .data(events)
    .join('g')
    .attr('class', 'event')
    .attr('transform', (event) => `translate(${event.x},${event.y})`)
    .each(function renderEvent(event) {
      const selection = d3.select(this);
      const text = event.body ? `${event.type}: ${event.body}` : event.type;

      selection
        .append('rect')
        .attr('width', event.width)
        .attr('height', event.height)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('fill', theme.eventFill)
        .attr('stroke', theme.eventStroke)
        .attr('stroke-width', 1);

      selection
        .append('text')
        .attr('x', event.width / 2)
        .attr('y', event.height / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', 12)
        .attr('fill', theme.mutedText)
        .text(text);
    });
}
