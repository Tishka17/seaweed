export function defineMarkers(defs, theme) {
  const markerData = [
    ['seaweed-arrow-end', 10, 5, 'auto', 'M 0 0 L 10 5 L 0 10 z', theme.edgeStroke, theme.edgeStroke],
    ['seaweed-arrow-start', 0, 5, 'auto-start-reverse', 'M 0 0 L 10 5 L 0 10 z', theme.edgeStroke, theme.edgeStroke],
    ['seaweed-circle-end', 5, 5, 'auto', 'M 5 1.5 A 3.5 3.5 0 1 0 5 8.5 A 3.5 3.5 0 1 0 5 1.5', theme.background, theme.edgeStroke],
    ['seaweed-circle-start', 5, 5, 'auto-start-reverse', 'M 5 1.5 A 3.5 3.5 0 1 0 5 8.5 A 3.5 3.5 0 1 0 5 1.5', theme.background, theme.edgeStroke],
    ['seaweed-diamond-end', 10, 5, 'auto', 'M 1 5 L 5 1 L 9 5 L 5 9 z', theme.edgeStroke, theme.edgeStroke],
    ['seaweed-diamond-start', 0, 5, 'auto-start-reverse', 'M 1 5 L 5 1 L 9 5 L 5 9 z', theme.edgeStroke, theme.edgeStroke],
    ['seaweed-cross-end', 8, 5, 'auto', 'M 2 2 L 8 8 M 8 2 L 2 8', 'none', theme.edgeStroke],
    ['seaweed-cross-start', 2, 5, 'auto-start-reverse', 'M 2 2 L 8 8 M 8 2 L 2 8', 'none', theme.edgeStroke],
  ];

  markerData.forEach(([id, refX, refY, orient, path, fill, stroke]) => {
    defs
      .append('marker')
      .attr('id', id)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', refX)
      .attr('refY', refY)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', orient)
      .append('path')
      .attr('d', path)
      .attr('fill', fill)
      .attr('stroke', stroke)
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round');
  });
}
