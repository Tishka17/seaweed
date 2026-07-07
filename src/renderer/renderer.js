import * as d3 from 'd3';
import ELK from 'elkjs/lib/elk.bundled.js';
import { parsePlantUML } from '../parser/parser.js';
import { defineMarkers } from './draw/markers.js';
import {
  drawContainers,
  drawEdges,
  drawEvents,
  drawFragments,
  drawNodes,
  drawNotes,
  drawSequenceActivations,
  drawSequenceLifelines,
} from './draw/layers.js';
import { diagramBounds, reserveTitleSpace } from './layout/bounds.js';
import {
  createContainerBounds,
  resolveEventPositions,
  resolveFragmentBounds,
  resolveNotePositions,
} from './layout/elements.js';
import { buildGraph } from './layout/graph.js';
import { normalizeLayout } from './layout/postprocess.js';
import { buildSequenceLayout, isSequenceDiagram } from './layout/sequence.js';
import { RENDERER_DEFAULTS, resolveLayoutAlgorithm, resolveTheme } from './theme.js';
import { boundsFromItems } from './utils/geometry.js';

export class PlantUMLRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      ...RENDERER_DEFAULTS,
      ...options,
    };
    this.theme = resolveTheme(this.options.theme);
    this.elk = new ELK();
  }

  setTheme(theme) {
    this.options.theme = theme;
    this.theme = resolveTheme(theme);
  }

  setLayoutAlgorithm(layoutAlgorithm) {
    this.options.layoutAlgorithm = layoutAlgorithm;
  }

  setLayoutOptions(layoutOptions) {
    this.options.layoutOptions = {
      ...this.options.layoutOptions,
      ...layoutOptions,
    };
  }

  async render(source) {
    const diagram = parsePlantUML(source);
    if (isSequenceDiagram(diagram)) {
      this.draw(buildSequenceLayout(diagram), diagram);
      return diagram;
    }

    const graph = buildGraph(diagram, this.options);
    const layout = await this.layoutGraph(graph, diagram);
    const normalizedLayout = normalizeLayout(layout, diagram, this.options);
    this.draw(normalizedLayout, diagram);
    return diagram;
  }

  async layoutGraph(graph, diagram) {
    try {
      return await this.elk.layout(graph);
    } catch (error) {
      const layoutAlgorithm = resolveLayoutAlgorithm(this.options.layoutAlgorithm);
      if (layoutAlgorithm.elkAlgorithm === 'layered') {
        throw error;
      }

      const fallbackGraph = buildGraph(diagram, {
        ...this.options,
        layoutAlgorithm: 'layered',
      });
      return this.elk.layout(fallbackGraph);
    }
  }

  draw(layout, diagram) {
    d3.select(this.container).selectAll('*').remove();

    const nodeById = new Map();
    (layout.children || []).forEach((node) => {
      nodeById.set(node.id, node);
    });

    const graphBounds = boundsFromItems(layout.children || []);
    const containers = createContainerBounds(diagram, nodeById);
    const notes = layout.notes || resolveNotePositions(diagram.notes || [], nodeById, graphBounds);
    const events = resolveEventPositions(diagram.events || [], nodeById, graphBounds);
    const fragments = layout.fragments || resolveFragmentBounds(diagram.groups || [], graphBounds);
    const bounds = reserveTitleSpace(diagramBounds(layout, containers, fragments, notes, events), diagram);
    const width = Math.max(this.options.minWidth, Math.ceil(bounds.width));
    const height = Math.max(this.options.minHeight, Math.ceil(bounds.height));

    const svg = d3
      .select(this.container)
      .append('svg')
      .attr('class', 'seaweed-diagram')
      .attr('viewBox', `${bounds.x} ${bounds.y} ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('role', 'img');

    defineMarkers(svg.append('defs'), this.theme);
    this.drawBackground(svg, bounds, width, height);

    const root = svg.append('g').attr('font-family', 'Arial, sans-serif');
    drawFragments(root, fragments, this.theme);
    drawContainers(root, containers, this.theme);
    drawSequenceLifelines(root, layout.lifelines || [], this.theme);
    drawSequenceActivations(root, layout.activations || [], this.theme);
    drawEdges(root, layout.edges || [], this.theme);
    drawNodes(root, layout.children || [], this.theme);
    drawNotes(root, notes, this.theme);
    drawEvents(root, layout.type === 'sequence' ? [] : events, this.theme);
    this.drawTitle(root, diagram, bounds, width);
  }

  drawBackground(svg, bounds, width, height) {
    svg
      .append('rect')
      .attr('x', bounds.x)
      .attr('y', bounds.y)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', this.theme.background);
  }

  drawTitle(root, diagram, bounds, width) {
    if (!diagram.meta.title) {
      return;
    }

    root
      .append('text')
      .attr('x', bounds.x + width / 2)
      .attr('y', bounds.y + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', 16)
      .attr('font-weight', 600)
      .attr('fill', this.theme.text)
      .text(diagram.meta.title);
  }
}
