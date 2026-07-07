import { nodeShapeProfile, nodeTextInsets } from '../layout/node-shapes.js';

function nodeFill(item, theme) {
  return item.data?.color || theme.nodeFill;
}

function strokeAttrs(selection, theme) {
  return selection
    .attr('stroke', theme.nodeStroke)
    .attr('stroke-width', 1.4);
}

function rect(selection, item, theme, radius = 4) {
  strokeAttrs(
    selection
      .append('rect')
      .attr('width', item.width)
      .attr('height', item.height)
      .attr('rx', radius)
      .attr('ry', radius)
      .attr('fill', nodeFill(item, theme)),
    theme,
  );
}

function ellipse(selection, item, theme) {
  strokeAttrs(
    selection
      .append('ellipse')
      .attr('cx', item.width / 2)
      .attr('cy', item.height / 2)
      .attr('rx', item.width / 2)
      .attr('ry', item.height / 2)
      .attr('fill', nodeFill(item, theme)),
    theme,
  );
}

function cylinder(selection, item, theme, showMiddleLine = false) {
  const capHeight = Math.min(16, Math.max(10, item.height * 0.22));
  const path = [
    `M 0 ${capHeight / 2}`,
    `C 0 ${-capHeight / 6}, ${item.width} ${-capHeight / 6}, ${item.width} ${capHeight / 2}`,
    `L ${item.width} ${item.height - capHeight / 2}`,
    `C ${item.width} ${item.height + capHeight / 6}, 0 ${item.height + capHeight / 6}, 0 ${item.height - capHeight / 2}`,
    'Z',
  ].join(' ');

  strokeAttrs(selection.append('path').attr('d', path).attr('fill', nodeFill(item, theme)), theme);
  strokeAttrs(
    selection
      .append('path')
      .attr('d', `M 0 ${capHeight / 2} C 0 ${capHeight * 1.1}, ${item.width} ${capHeight * 1.1}, ${item.width} ${capHeight / 2}`)
      .attr('fill', 'none'),
    theme,
  );

  if (showMiddleLine) {
    strokeAttrs(
      selection
        .append('path')
        .attr('d', `M 0 ${item.height / 2} C 0 ${item.height / 2 + capHeight * 0.55}, ${item.width} ${item.height / 2 + capHeight * 0.55}, ${item.width} ${item.height / 2}`)
        .attr('fill', 'none')
        .attr('opacity', 0.55),
      theme,
    );
  }
}

function component(selection, item, theme) {
  rect(selection, item, theme, 4);

  const glyph = selection.append('g').attr('class', 'component-glyph');
  [14, 27].forEach((y) => {
    strokeAttrs(
      glyph
        .append('rect')
        .attr('x', 8)
        .attr('y', Math.min(y, item.height - 16))
        .attr('width', 16)
        .attr('height', 9)
        .attr('fill', theme.background),
      theme,
    );
  });
}

function actor(selection, item, theme) {
  const cx = item.width / 2;
  const headY = 14;
  const bodyTop = 26;
  const bodyBottom = Math.min(48, item.height - 26);

  selection.append('rect')
    .attr('width', item.width)
    .attr('height', item.height)
    .attr('fill', 'transparent');

  strokeAttrs(
    selection
      .append('circle')
      .attr('cx', cx)
      .attr('cy', headY)
      .attr('r', 8)
      .attr('fill', theme.background),
    theme,
  );

  strokeAttrs(selection.append('line').attr('x1', cx).attr('x2', cx).attr('y1', bodyTop).attr('y2', bodyBottom), theme);
  strokeAttrs(selection.append('line').attr('x1', cx - 18).attr('x2', cx + 18).attr('y1', 34).attr('y2', 34), theme);
  strokeAttrs(selection.append('line').attr('x1', cx).attr('x2', cx - 16).attr('y1', bodyBottom).attr('y2', bodyBottom + 18), theme);
  strokeAttrs(selection.append('line').attr('x1', cx).attr('x2', cx + 16).attr('y1', bodyBottom).attr('y2', bodyBottom + 18), theme);
}

function stack(selection, item, theme) {
  strokeAttrs(
    selection
      .append('rect')
      .attr('x', 8)
      .attr('y', 0)
      .attr('width', item.width - 8)
      .attr('height', item.height - 8)
      .attr('rx', 4)
      .attr('fill', nodeFill(item, theme))
      .attr('opacity', 0.55),
    theme,
  );
  strokeAttrs(
    selection
      .append('rect')
      .attr('x', 4)
      .attr('y', 4)
      .attr('width', item.width - 8)
      .attr('height', item.height - 8)
      .attr('rx', 4)
      .attr('fill', nodeFill(item, theme))
      .attr('opacity', 0.75),
    theme,
  );
  rect(selection, { ...item, width: item.width - 8, height: item.height - 8 }, theme, 4);
}

function boundary(selection, item, theme) {
  const radius = Math.min(item.height, item.width) * 0.32;
  const cx = item.width / 2 + 6;
  const cy = item.height / 2;

  strokeAttrs(selection.append('circle').attr('cx', cx).attr('cy', cy).attr('r', radius).attr('fill', nodeFill(item, theme)), theme);
  strokeAttrs(selection.append('line').attr('x1', cx - radius - 12).attr('x2', cx - radius - 12).attr('y1', cy - radius).attr('y2', cy + radius), theme);
  strokeAttrs(selection.append('line').attr('x1', cx - radius - 12).attr('x2', cx - radius).attr('y1', cy).attr('y2', cy), theme);
}

function card(selection, item, theme) {
  const fold = Math.min(18, item.width * 0.16, item.height * 0.35);
  const path = `M 0 0 H ${item.width - fold} L ${item.width} ${fold} V ${item.height} H 0 Z`;
  strokeAttrs(selection.append('path').attr('d', path).attr('fill', nodeFill(item, theme)), theme);
  strokeAttrs(selection.append('path').attr('d', `M ${item.width - fold} 0 V ${fold} H ${item.width}`).attr('fill', 'none'), theme);
}

function hexagon(selection, item, theme) {
  const edge = Math.min(item.width * 0.18, 24);
  const points = [
    [edge, 0],
    [item.width - edge, 0],
    [item.width, item.height / 2],
    [item.width - edge, item.height],
    [edge, item.height],
    [0, item.height / 2],
  ].map((point) => point.join(',')).join(' ');
  strokeAttrs(selection.append('polygon').attr('points', points).attr('fill', nodeFill(item, theme)), theme);
}

function diamond(selection, item, theme) {
  const points = [
    [item.width / 2, 0],
    [item.width, item.height / 2],
    [item.width / 2, item.height],
    [0, item.height / 2],
  ].map((point) => point.join(',')).join(' ');
  strokeAttrs(selection.append('polygon').attr('points', points).attr('fill', nodeFill(item, theme)), theme);
}

function filledCircle(selection, item, theme) {
  const radius = Math.min(item.width, item.height) / 2;
  selection
    .append('circle')
    .attr('cx', item.width / 2)
    .attr('cy', item.height / 2)
    .attr('r', radius)
    .attr('fill', theme.edgeStroke);
}

function bullseye(selection, item, theme) {
  const radius = Math.min(item.width, item.height) / 2 - 1;
  strokeAttrs(
    selection
      .append('circle')
      .attr('cx', item.width / 2)
      .attr('cy', item.height / 2)
      .attr('r', radius)
      .attr('fill', theme.background),
    theme,
  );
  selection
    .append('circle')
    .attr('cx', item.width / 2)
    .attr('cy', item.height / 2)
    .attr('r', Math.max(4, radius - 7))
    .attr('fill', theme.edgeStroke);
}

function folder(selection, item, theme) {
  const tabWidth = Math.min(52, item.width * 0.42);
  const tabHeight = Math.min(14, item.height * 0.28);
  const path = `M 0 ${tabHeight} V 0 H ${tabWidth} L ${tabWidth + 10} ${tabHeight} H ${item.width} V ${item.height} H 0 Z`;
  strokeAttrs(selection.append('path').attr('d', path).attr('fill', nodeFill(item, theme)), theme);
}

function cloud(selection, item, theme) {
  const w = item.width;
  const h = item.height;
  const path = [
    `M ${w * 0.22} ${h * 0.75}`,
    `C ${w * 0.02} ${h * 0.72}, ${w * 0.04} ${h * 0.38}, ${w * 0.25} ${h * 0.42}`,
    `C ${w * 0.28} ${h * 0.12}, ${w * 0.63} ${h * 0.1}, ${w * 0.68} ${h * 0.38}`,
    `C ${w * 0.92} ${h * 0.34}, ${w * 0.98} ${h * 0.68}, ${w * 0.78} ${h * 0.75}`,
    'Z',
  ].join(' ');
  strokeAttrs(selection.append('path').attr('d', path).attr('fill', nodeFill(item, theme)), theme);
}

function nodeCube(selection, item, theme) {
  const depth = Math.min(14, item.width * 0.12, item.height * 0.22);
  strokeAttrs(
    selection
      .append('path')
      .attr('d', `M 0 ${depth} L ${depth} 0 H ${item.width} V ${item.height - depth} L ${item.width - depth} ${item.height} H 0 Z`)
      .attr('fill', nodeFill(item, theme)),
    theme,
  );
  strokeAttrs(selection.append('path').attr('d', `M 0 ${depth} H ${item.width - depth} L ${item.width} 0 M ${item.width - depth} ${depth} V ${item.height}`).attr('fill', 'none'), theme);
}

function frame(selection, item, theme) {
  const corner = Math.min(22, item.width * 0.2);
  const path = `M 0 0 H ${item.width - corner} L ${item.width} ${corner} V ${item.height} H 0 Z`;
  strokeAttrs(selection.append('path').attr('d', path).attr('fill', nodeFill(item, theme)), theme);
  strokeAttrs(selection.append('path').attr('d', `M ${item.width - corner} 0 V ${corner} H ${item.width}`).attr('fill', 'none'), theme);
}

function label(selection, item, theme) {
  strokeAttrs(
    selection
      .append('path')
      .attr('d', `M 0 ${item.height / 2} H ${item.width}`)
      .attr('fill', 'none')
      .attr('stroke-dasharray', '4 3'),
    theme,
  );
}

export function nodeTextArea(item) {
  const insets = nodeTextInsets(item.data);

  return {
    x: insets.left,
    y: insets.top,
    width: Math.max(1, item.width - insets.left - insets.right),
    height: Math.max(1, item.height - insets.top - insets.bottom),
  };
}

export function drawNodeShape(selection, item, theme) {
  const shape = nodeShapeProfile(item.data).kind;

  if (shape === 'actor') {
    actor(selection, item, theme);
  } else if (shape === 'ellipse' || shape === 'interface' || shape === 'control') {
    ellipse(selection, item, theme);
  } else if (shape === 'cylinder') {
    cylinder(selection, item, theme);
  } else if (shape === 'queue') {
    cylinder(selection, item, theme, true);
  } else if (shape === 'component') {
    component(selection, item, theme);
  } else if (shape === 'stack') {
    stack(selection, item, theme);
  } else if (shape === 'boundary') {
    boundary(selection, item, theme);
  } else if (shape === 'card' || shape === 'file') {
    card(selection, item, theme);
  } else if (shape === 'artifact') {
    component(selection, item, theme);
  } else if (shape === 'hexagon') {
    hexagon(selection, item, theme);
  } else if (shape === 'diamond') {
    diamond(selection, item, theme);
  } else if (shape === 'filledCircle') {
    filledCircle(selection, item, theme);
  } else if (shape === 'bullseye') {
    bullseye(selection, item, theme);
  } else if (shape === 'folder') {
    folder(selection, item, theme);
  } else if (shape === 'cloud') {
    cloud(selection, item, theme);
  } else if (shape === 'node') {
    nodeCube(selection, item, theme);
  } else if (shape === 'frame') {
    frame(selection, item, theme);
  } else if (shape === 'label') {
    label(selection, item, theme);
  } else {
    rect(selection, item, theme, shape === 'agent' || shape === 'roundRect' || shape === 'state' ? 10 : 4);
  }
}
