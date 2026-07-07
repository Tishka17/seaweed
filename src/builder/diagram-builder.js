import { removeQuotes, sanitizeId, trimWhitespace } from '../parser/string-utils.js';

function normalizeReference(value) {
  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char >= 'A' && char <= 'Z') {
      result += String.fromCharCode(char.charCodeAt(0) + 32);
    } else {
      result += char;
    }
  }

  return result;
}

function withOptionalProperty(target, key, value) {
  if (value !== null && value !== undefined && value !== '') {
    target[key] = value;
  }
}

function pushUniqueValues(target, values) {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

export class DiagramBuilder {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.groups = [];
    this.notes = [];
    this.events = [];
    this.timeline = [];
    this.warnings = [];
    this.meta = {
      title: null,
      caption: null,
      header: null,
      footer: null,
      direction: null,
      diagramType: null,
      skinparams: {},
      directives: [],
      hides: [],
      shows: [],
    };

    this.nodeMap = new Map();
    this.groupMap = new Map();
    this.referenceMap = new Map();
    this.edgeIds = new Set();
    this.scopeStack = [];
    this.counters = {
      edge: 0,
      note: 0,
      group: 0,
      event: 0,
      flow: 0,
    };
    this.flow = {
      previousNodeId: null,
      decisionStack: [],
      loopStack: [],
      nextEdgeLabel: null,
    };
    this.timelineIndex = 0;
  }

  nextCounter(name) {
    this.counters[name] += 1;
    return this.counters[name];
  }

  currentGroupId() {
    for (let index = this.scopeStack.length - 1; index >= 0; index -= 1) {
      const scope = this.scopeStack[index];
      if (scope.kind === 'group') {
        return scope.id;
      }
    }

    return null;
  }

  currentEntityBodyOwner() {
    for (let index = this.scopeStack.length - 1; index >= 0; index -= 1) {
      const scope = this.scopeStack[index];
      if (scope.kind === 'entityBody') {
        return scope.ownerId;
      }
    }

    return null;
  }

  registerReference(reference, targetId) {
    const cleaned = trimWhitespace(removeQuotes(reference || ''));
    if (cleaned.length === 0) {
      return;
    }

    this.referenceMap.set(cleaned, targetId);
    this.referenceMap.set(normalizeReference(cleaned), targetId);
  }

  resolveReference(reference) {
    const cleaned = trimWhitespace(removeQuotes(reference || ''));
    if (cleaned.length === 0) {
      return null;
    }

    if (this.referenceMap.has(cleaned)) {
      return this.referenceMap.get(cleaned);
    }

    const normalized = normalizeReference(cleaned);
    if (this.referenceMap.has(normalized)) {
      return this.referenceMap.get(normalized);
    }

    return sanitizeId(cleaned);
  }

  createUniqueEdgeId(source, target) {
    const baseId = `${source}-${target}`;
    if (!this.edgeIds.has(baseId)) {
      this.edgeIds.add(baseId);
      return baseId;
    }

    let suffix = 2;
    while (this.edgeIds.has(`${baseId}-${suffix}`)) {
      suffix += 1;
    }

    const uniqueId = `${baseId}-${suffix}`;
    this.edgeIds.add(uniqueId);
    return uniqueId;
  }

  createGroupId(type, title, alias = null) {
    const seed = alias || title || `${type}-${this.nextCounter('group')}`;
    let candidate = sanitizeId(`group-${type}-${seed}`);
    if (!this.groupMap.has(candidate)) {
      return candidate;
    }

    let suffix = 2;
    while (this.groupMap.has(`${candidate}-${suffix}`)) {
      suffix += 1;
    }

    return `${candidate}-${suffix}`;
  }

  mergeNode(existingNode, definition) {
    if (existingNode.label.length === 0 && definition.label.length > 0) {
      existingNode.label = definition.label;
    }

    if (existingNode.type === 'implicit' && definition.type !== 'implicit') {
      existingNode.type = definition.type;
    }

    if (!existingNode.alias && definition.alias) {
      existingNode.alias = definition.alias;
    }

    if (!existingNode.parentId && definition.parentId) {
      existingNode.parentId = definition.parentId;
    }

    if (definition.color && !existingNode.color) {
      existingNode.color = definition.color;
    }

    if (!existingNode.members) {
      existingNode.members = [];
    }

    if (!existingNode.stereotypes) {
      existingNode.stereotypes = [];
    }

    pushUniqueValues(existingNode.stereotypes, definition.stereotypes);

    if (!existingNode.modifiers) {
      existingNode.modifiers = [];
    }

    pushUniqueValues(existingNode.modifiers, definition.modifiers);
    return existingNode;
  }

  addNode(nameOrDefinition, id = null) {
    const definition = typeof nameOrDefinition === 'string'
      ? { label: nameOrDefinition, id }
      : { ...nameOrDefinition };

    const rawLabel = Object.prototype.hasOwnProperty.call(definition, 'label')
      ? definition.label
      : definition.id || definition.alias || '';
    const label = trimWhitespace(removeQuotes(rawLabel || ''));
    const nodeId = sanitizeId(definition.id || definition.alias || label || `node-${this.nodes.length + 1}`);
    const parentId = definition.parentId ?? this.currentGroupId();
    const fullDefinition = {
      id: nodeId,
      label,
      type: definition.type || 'entity',
      alias: definition.alias || null,
      parentId,
      color: definition.color || null,
      stereotypes: definition.stereotypes ? [...definition.stereotypes] : [],
      modifiers: definition.modifiers ? [...definition.modifiers] : [],
    };

    if (this.nodeMap.has(nodeId)) {
      const existingNode = this.nodeMap.get(nodeId);
      this.mergeNode(existingNode, fullDefinition);
      this.registerReference(nodeId, nodeId);
      this.registerReference(label, nodeId);
      if (fullDefinition.alias) {
        this.registerReference(fullDefinition.alias, nodeId);
      }
      return existingNode;
    }

    const node = {
      id: nodeId,
      label,
      type: fullDefinition.type,
      members: [],
    };

    withOptionalProperty(node, 'alias', fullDefinition.alias);
    withOptionalProperty(node, 'parentId', parentId);
    withOptionalProperty(node, 'color', fullDefinition.color);

    if (fullDefinition.stereotypes.length > 0) {
      node.stereotypes = fullDefinition.stereotypes;
    }

    if (fullDefinition.modifiers.length > 0) {
      node.modifiers = fullDefinition.modifiers;
    }

    this.nodes.push(node);
    this.nodeMap.set(nodeId, node);

    this.registerReference(nodeId, nodeId);
    this.registerReference(label, nodeId);
    if (fullDefinition.alias) {
      this.registerReference(fullDefinition.alias, nodeId);
    }

    return node;
  }

  ensureNode(reference, defaults = {}) {
    const resolvedId = this.resolveReference(reference);
    if (resolvedId && this.nodeMap.has(resolvedId)) {
      return this.nodeMap.get(resolvedId);
    }

    return this.addNode({
      label: defaults.label || reference,
      id: resolvedId || defaults.id || reference,
      alias: defaults.alias || null,
      type: defaults.type || 'implicit',
      parentId: defaults.parentId ?? this.currentGroupId(),
      stereotypes: defaults.stereotypes || [],
      modifiers: defaults.modifiers || [],
      color: defaults.color || null,
    });
  }

  openGroup(definition) {
    const parentId = definition.parentId ?? this.currentGroupId();
    const groupId = this.createGroupId(definition.type, definition.title, definition.alias || null);
    const group = {
      id: groupId,
      type: definition.type,
      title: definition.title || definition.type,
    };

    withOptionalProperty(group, 'alias', definition.alias || null);
    withOptionalProperty(group, 'parentId', parentId);

    if (definition.supportsBranches) {
      group.branches = [];
    }

    this.groups.push(group);
    this.groupMap.set(groupId, group);

    this.scopeStack.push({
      kind: 'group',
      id: groupId,
      type: definition.type,
      closeStrategy: definition.closeStrategy || 'end',
    });

    this.addTimelineItem({
      type: 'group-open',
      groupId,
    });

    return group;
  }

  closeScopeByStrategy(closeStrategy) {
    for (let index = this.scopeStack.length - 1; index >= 0; index -= 1) {
      if (this.scopeStack[index].closeStrategy === closeStrategy) {
        const scope = this.scopeStack.splice(index, 1)[0];
        this.addTimelineItem({
          type: 'group-close',
          groupId: scope.id,
        });
        return scope;
      }
    }

    return null;
  }

  closeLastGroup() {
    for (let index = this.scopeStack.length - 1; index >= 0; index -= 1) {
      if (this.scopeStack[index].kind === 'group') {
        const scope = this.scopeStack.splice(index, 1)[0];
        this.addTimelineItem({
          type: 'group-close',
          groupId: scope.id,
        });
        return scope;
      }
    }

    return null;
  }

  openEntityBody(ownerReference) {
    const ownerId = this.resolveReference(ownerReference) || sanitizeId(ownerReference);
    this.scopeStack.push({
      kind: 'entityBody',
      ownerId,
      closeStrategy: 'brace',
    });
  }

  addMember(ownerReference, member) {
    const ownerId = this.resolveReference(ownerReference) || ownerReference;
    if (!this.nodeMap.has(ownerId)) {
      return null;
    }

    const owner = this.nodeMap.get(ownerId);
    owner.members.push(member);
    return owner;
  }

  addEdge(definition) {
    const sourceNode = this.ensureNode(definition.from, { type: 'implicit' });
    const targetNode = this.ensureNode(definition.to, { type: 'implicit' });
    const edge = {
      id: this.createUniqueEdgeId(sourceNode.id, targetNode.id),
      source: sourceNode.id,
      target: targetNode.id,
      arrow: definition.arrow,
    };

    withOptionalProperty(edge, 'label', definition.label || null);
    withOptionalProperty(edge, 'sourceCardinality', definition.sourceCardinality || null);
    withOptionalProperty(edge, 'targetCardinality', definition.targetCardinality || null);
    withOptionalProperty(edge, 'direction', definition.direction || null);
    withOptionalProperty(edge, 'lineStyle', definition.lineStyle || null);

    this.edges.push(edge);
    this.addTimelineItem({
      type: 'edge',
      edgeId: edge.id,
    });
    return edge;
  }

  addRawEdge(definition) {
    const edge = {
      id: definition.id || this.createUniqueEdgeId(definition.source, definition.target),
      source: definition.source,
      target: definition.target,
      arrow: definition.arrow || '-->',
    };

    withOptionalProperty(edge, 'label', definition.label || null);
    withOptionalProperty(edge, 'lineStyle', definition.lineStyle || null);
    this.edges.push(edge);
    this.addTimelineItem({
      type: 'edge',
      edgeId: edge.id,
    });
    return edge;
  }

  addTimelineItem(definition) {
    this.timeline.push({
      ...definition,
      order: this.timelineIndex,
    });
    this.timelineIndex += 1;
  }

  addFlowNode(definition) {
    const nodeId = definition.id || `${definition.type}-${this.nextCounter('flow')}`;
    return this.addNode({
      id: nodeId,
      label: definition.label || '',
      type: definition.type,
    });
  }

  addSequentialFlowNode(definition, edgeLabel = null) {
    const node = this.addFlowNode(definition);
    const label = edgeLabel || this.flow.nextEdgeLabel;

    if (this.flow.previousNodeId) {
      this.addRawEdge({
        source: this.flow.previousNodeId,
        target: node.id,
        arrow: '-->',
        label,
        lineStyle: 'solid',
      });
    }

    this.flow.nextEdgeLabel = null;
    this.flow.previousNodeId = node.id;
    return node;
  }

  setPreviousFlowNode(nodeId) {
    this.flow.previousNodeId = nodeId;
  }

  setNextFlowEdgeLabel(label) {
    this.flow.nextEdgeLabel = label || null;
  }

  pushDecisionNode(nodeId) {
    this.flow.decisionStack.push({
      nodeId,
      thenEndId: null,
    });
  }

  switchDecisionBranch() {
    const decision = this.flow.decisionStack[this.flow.decisionStack.length - 1];
    if (!decision) {
      return null;
    }

    decision.thenEndId = this.flow.previousNodeId;
    this.flow.previousNodeId = decision.nodeId;
    return decision;
  }

  closeDecisionBranch() {
    const decision = this.flow.decisionStack.pop();
    if (!decision || !decision.thenEndId) {
      return null;
    }

    const merge = this.addFlowNode({
      type: 'activityMerge',
      label: '',
    });

    this.addRawEdge({
      source: decision.thenEndId,
      target: merge.id,
      arrow: '-->',
      lineStyle: 'solid',
    });

    if (this.flow.previousNodeId && this.flow.previousNodeId !== decision.nodeId) {
      this.addRawEdge({
        source: this.flow.previousNodeId,
        target: merge.id,
        arrow: '-->',
        lineStyle: 'solid',
      });
    }

    this.flow.previousNodeId = merge.id;
    return merge;
  }

  pushLoopNode(nodeId) {
    this.flow.loopStack.push({
      nodeId,
    });
  }

  closeLoop(exitLabel = null) {
    const loop = this.flow.loopStack.pop();
    if (!loop) {
      return null;
    }

    if (this.flow.previousNodeId && this.flow.previousNodeId !== loop.nodeId) {
      this.addRawEdge({
        source: this.flow.previousNodeId,
        target: loop.nodeId,
        arrow: '-->',
        lineStyle: 'solid',
      });
    }

    this.flow.previousNodeId = loop.nodeId;
    this.flow.nextEdgeLabel = exitLabel || null;
    return loop;
  }

  addNote(definition) {
    const note = {
      id: `note-${this.nextCounter('note')}`,
      body: definition.body,
      placement: definition.placement || 'over',
      type: definition.type || 'note',
      targets: [],
    };

    const parentId = definition.parentId ?? this.currentGroupId();
    withOptionalProperty(note, 'parentId', parentId);

    if (definition.targets) {
      for (let index = 0; index < definition.targets.length; index += 1) {
        const reference = definition.targets[index];
        const targetNode = this.ensureNode(reference, { type: 'implicit' });
        note.targets.push(targetNode.id);
      }
    }

    this.notes.push(note);
    this.addTimelineItem({
      type: 'note',
      noteId: note.id,
    });
    return note;
  }

  addBranch(label) {
    for (let index = this.scopeStack.length - 1; index >= 0; index -= 1) {
      const scope = this.scopeStack[index];
      if (scope.kind !== 'group') {
        continue;
      }

      const group = this.groupMap.get(scope.id);
      if (!group) {
        return null;
      }

      if (!group.branches) {
        group.branches = [];
      }

      group.branches.push({
        type: 'else',
        label: label || 'else',
      });
      this.addTimelineItem({
        type: 'group-branch',
        groupId: group.id,
        label: label || 'else',
      });

      return group;
    }

    return null;
  }

  addEvent(definition) {
    const event = {
      id: `event-${this.nextCounter('event')}`,
      type: definition.type,
    };

    if (definition.target) {
      const targetNode = this.ensureNode(definition.target, { type: 'implicit' });
      event.target = targetNode.id;
    }

    withOptionalProperty(event, 'body', definition.body || null);
    this.events.push(event);
    this.addTimelineItem({
      type: 'event',
      eventId: event.id,
    });
    return event;
  }

  setMeta(key, value) {
    this.meta[key] = value;
  }

  setSkinParam(name, value) {
    this.meta.skinparams[name] = value;
  }

  addDirective(definition) {
    this.meta.directives.push(definition);
  }

  addVisibilityRule(type, value) {
    if (type === 'hide') {
      this.meta.hides.push(value);
      return;
    }

    if (type === 'show') {
      this.meta.shows.push(value);
    }
  }

  addWarning(definition) {
    this.warnings.push({
      severity: definition.severity || 'warning',
      code: definition.code,
      message: definition.message,
      lineNumber: definition.lineNumber || null,
      raw: definition.raw || null,
    });
  }

  build() {
    return {
      nodes: this.nodes,
      edges: this.edges,
      groups: this.groups,
      notes: this.notes,
      events: this.events,
      timeline: this.timeline,
      meta: this.meta,
      warnings: this.warnings,
    };
  }
}
