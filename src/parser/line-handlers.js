import { compareIgnoreCase, startsWithIgnoreCase } from './string-utils.js';
import {
  isCommentLine,
  isDiagramBoundary,
  parseAttachedMemberLine,
  parseAliasStatement,
  parseActivityLine,
  parseBlockLine,
  parseDeclarationLine,
  parseDirectiveLine,
  parseEdge,
  parseEventLine,
  parseMemberLine,
  parseMetadataLine,
  parseNoteLine,
  parseReferenceBlockLine,
  parseSkinParamLine,
  parseStateTransition,
} from './token-parsers.js';

export class LineHandler {
  canHandle(context) {
    throw new Error('canHandle must be implemented');
  }

  handle(context) {
    throw new Error('handle must be implemented');
  }
}

class IgnoredLineHandler extends LineHandler {
  canHandle(context) {
    const statement = context.currentStatement();
    return statement.raw.length === 0 || isCommentLine(statement.normalized) || isDiagramBoundary(statement.normalized);
  }

  handle(context) {
    context.advance();
  }
}

class MetadataHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseMetadataLine(context.currentStatement().normalized));
  }

  handle(context) {
    const metadata = parseMetadataLine(context.currentStatement().normalized);
    context.builder.setMeta(metadata.key, metadata.value);
    context.advance();
  }
}

class SkinParamHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseSkinParamLine(context.currentStatement().normalized));
  }

  handle(context) {
    const skinParam = parseSkinParamLine(context.currentStatement().normalized);
    if (skinParam.key) {
      context.builder.setSkinParam(skinParam.key, skinParam.value);
    } else {
      context.builder.addDirective({
        type: 'skinparam',
        name: 'skinparam',
        value: skinParam.value,
      });
    }
    context.advance();
  }
}

class DirectiveHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseDirectiveLine(context.currentStatement().normalized));
  }

  handle(context) {
    const directive = parseDirectiveLine(context.currentStatement().normalized);
    context.builder.addDirective(directive);

    if (directive.type === 'hide' || directive.type === 'show') {
      context.builder.addVisibilityRule(directive.type, directive.value);
    }

    context.advance();
  }
}

class ActivityHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseActivityLine(
      context.currentStatement().normalized,
      context.builder.meta.diagramType === 'activity',
    ));
  }

  handle(context) {
    const activity = parseActivityLine(
      context.currentStatement().normalized,
      context.builder.meta.diagramType === 'activity',
    );
    context.builder.setMeta('diagramType', 'activity');

    if (activity.type === 'start') {
      context.builder.addSequentialFlowNode({
        id: 'activity-start',
        type: 'activityStart',
        label: '',
      });
    } else if (activity.type === 'stop') {
      context.builder.addSequentialFlowNode({
        id: 'activity-end',
        type: 'activityEnd',
        label: '',
      });
    } else if (activity.type === 'action') {
      context.builder.addSequentialFlowNode({
        type: 'activityAction',
        label: activity.label,
      });
    } else if (activity.type === 'decision') {
      const decision = context.builder.addSequentialFlowNode({
        type: 'activityDecision',
        label: activity.label,
      });
      context.builder.pushDecisionNode(decision.id);
      context.builder.setPreviousFlowNode(decision.id);
      context.builder.setNextFlowEdgeLabel(activity.branchLabel);
    } else if (activity.type === 'while') {
      const loop = context.builder.addSequentialFlowNode({
        type: 'activityDecision',
        label: activity.label,
      });
      context.builder.pushLoopNode(loop.id);
      context.builder.setPreviousFlowNode(loop.id);
      context.builder.setNextFlowEdgeLabel(activity.branchLabel);
    } else if (activity.type === 'else') {
      context.builder.switchDecisionBranch();
      context.builder.setNextFlowEdgeLabel(activity.branchLabel || 'else');
    } else if (activity.type === 'endif') {
      context.builder.closeDecisionBranch();
    } else if (activity.type === 'endwhile') {
      context.builder.closeLoop(activity.branchLabel);
    }

    context.advance();
  }
}

class CloseScopeHandler extends LineHandler {
  canHandle(context) {
    const line = context.currentStatement().normalized;
    return line === '}' || compareIgnoreCase(line, 'end') || startsWithIgnoreCase(line, 'end ');
  }

  handle(context) {
    const line = context.currentStatement().normalized;

    if (line === '}') {
      context.builder.closeScopeByStrategy('brace');
      context.advance();
      return;
    }

    if (compareIgnoreCase(line, 'end note')) {
      context.advance();
      return;
    }

    context.builder.closeLastGroup();
    context.advance();
  }
}

class NoteHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseNoteLine(context.currentStatement().normalized));
  }

  handle(context) {
    const parsedNote = parseNoteLine(context.currentStatement().normalized);

    if (!parsedNote.isMultiline) {
      context.builder.addNote(parsedNote);
      context.advance();
      return;
    }

    const lines = [];
    context.advance();

    while (context.hasMore()) {
      const statement = context.currentStatement();
      if (compareIgnoreCase(statement.normalized, 'end note')) {
        break;
      }

      lines.push(statement.raw);
      context.advance();
    }

    parsedNote.body = lines.join('\n');
    context.builder.addNote(parsedNote);

    if (context.hasMore() && compareIgnoreCase(context.currentStatement().normalized, 'end note')) {
      context.advance();
    }
  }
}

class ReferenceBlockHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseReferenceBlockLine(context.currentStatement().normalized));
  }

  handle(context) {
    const referenceBlock = parseReferenceBlockLine(context.currentStatement().normalized);
    context.builder.openGroup({
      type: referenceBlock.type,
      title: referenceBlock.title,
      closeStrategy: 'inline',
    });
    context.builder.closeScopeByStrategy('inline');

    if (referenceBlock.title.length > 0 || referenceBlock.targets.length > 0) {
      context.builder.addNote({
        type: 'ref',
        placement: 'over',
        targets: referenceBlock.targets,
        body: referenceBlock.title,
      });
    }

    context.advance();
  }
}

class BlockHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseBlockLine(context.currentStatement().normalized));
  }

  handle(context) {
    const block = parseBlockLine(context.currentStatement().normalized);

    if (block.type === 'else') {
      context.builder.addBranch(block.title === 'else' ? null : block.title);
      context.advance();
      return;
    }

    if (block.type === 'divider') {
      context.builder.openGroup({
        type: block.type,
        title: block.title,
        closeStrategy: 'inline',
      });
      context.builder.closeScopeByStrategy('inline');
      context.advance();
      return;
    }

    context.builder.openGroup({
      type: block.type,
      title: block.title,
      closeStrategy: 'end',
      supportsBranches: block.supportsBranches,
    });
    context.advance();
  }
}

class DeclarationHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseDeclarationLine(context.currentStatement().normalized));
  }

  handle(context) {
    const declaration = parseDeclarationLine(context.currentStatement().normalized);

    if (declaration.kind === 'state') {
      context.builder.setMeta('diagramType', 'state');
    }

    if (declaration.structure === 'group') {
      context.builder.openGroup({
        type: declaration.kind,
        title: declaration.label,
        alias: declaration.alias,
        closeStrategy: declaration.closeStrategy,
      });
      context.advance();
      return;
    }

    const node = context.builder.addNode({
      id: declaration.alias || declaration.label,
      alias: declaration.alias,
      label: declaration.label,
      type: declaration.kind,
      stereotypes: declaration.stereotypes,
      color: declaration.color,
      modifiers: declaration.modifiers,
    });

    if (declaration.structure === 'entityBody') {
      context.builder.openEntityBody(node.id);
    }

    context.advance();
  }
}

class MemberHandler extends LineHandler {
  canHandle(context) {
    return context.builder.currentEntityBodyOwner() !== null;
  }

  handle(context) {
    const ownerId = context.builder.currentEntityBodyOwner();
    context.builder.addMember(ownerId, parseMemberLine(context.currentStatement().raw));
    context.advance();
  }
}

class AttachedMemberHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseAttachedMemberLine(context.currentStatement().normalized));
  }

  handle(context) {
    const parsed = parseAttachedMemberLine(context.currentStatement().normalized);
    context.builder.ensureNode(parsed.owner, {
      type: context.builder.meta.diagramType === 'state' ? 'state' : 'implicit',
    });
    context.builder.addMember(parsed.owner, parsed.member);
    context.advance();
  }
}

class EventHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseEventLine(context.currentStatement().normalized));
  }

  handle(context) {
    const statement = context.currentStatement();
    const event = parseEventLine(context.currentStatement().normalized);
    context.builder.addEvent(event);

    if (event.type !== 'activate' && event.type !== 'deactivate') {
      context.builder.addWarning({
        code: 'partial-support',
        message: `Sequence event "${event.type}" is parsed but not rendered yet.`,
        lineNumber: statement.lineNumber,
        raw: statement.raw,
      });
    }

    context.advance();
  }
}

class EdgeHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseEdge(context.currentStatement().normalized));
  }

  handle(context) {
    context.builder.addEdge(parseEdge(context.currentStatement().normalized));
    context.advance();
  }
}

class StateTransitionHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseStateTransition(context.currentStatement().normalized));
  }

  handle(context) {
    const transition = parseStateTransition(context.currentStatement().normalized);
    context.builder.setMeta('diagramType', 'state');

    const source = transition.fromStart
      ? context.builder.addNode({ id: 'state-start', label: '', type: 'stateStart' })
      : context.builder.ensureNode(transition.from, { type: 'state' });
    const target = transition.toEnd
      ? context.builder.addNode({ id: 'state-end', label: '', type: 'stateEnd' })
      : context.builder.ensureNode(transition.to, { type: 'state' });

    context.builder.addRawEdge({
      source: source.id,
      target: target.id,
      arrow: transition.arrow,
      label: transition.label,
      lineStyle: transition.lineStyle,
    });
    context.advance();
  }
}

class StateEdgeHandler extends LineHandler {
  canHandle(context) {
    return context.builder.meta.diagramType === 'state' &&
      Boolean(parseEdge(context.currentStatement().normalized));
  }

  handle(context) {
    const edge = parseEdge(context.currentStatement().normalized);
    const source = context.builder.ensureNode(edge.from, { type: 'state' });
    const target = context.builder.ensureNode(edge.to, { type: 'state' });

    context.builder.addRawEdge({
      source: source.id,
      target: target.id,
      arrow: edge.arrow,
      label: edge.label,
      lineStyle: edge.lineStyle,
    });
    context.advance();
  }
}

class AliasHandler extends LineHandler {
  canHandle(context) {
    return Boolean(parseAliasStatement(context.currentStatement().normalized));
  }

  handle(context) {
    const alias = parseAliasStatement(context.currentStatement().normalized);
    context.builder.addNode({
      id: alias.alias,
      alias: alias.alias,
      label: alias.label,
      type: 'entity',
    });
    context.advance();
  }
}

class UnknownLineHandler extends LineHandler {
  canHandle() {
    return true;
  }

  handle(context) {
    const statement = context.currentStatement();
    context.builder.addWarning({
      code: 'unsupported-line',
      message: 'PlantUML statement is not supported and was ignored.',
      lineNumber: statement.lineNumber,
      raw: statement.raw,
    });
    context.advance();
  }
}

export function createDefaultHandlers() {
  return [
    new IgnoredLineHandler(),
    new MetadataHandler(),
    new SkinParamHandler(),
    new DirectiveHandler(),
    new ActivityHandler(),
    new CloseScopeHandler(),
    new NoteHandler(),
    new ReferenceBlockHandler(),
    new BlockHandler(),
    new StateTransitionHandler(),
    new StateEdgeHandler(),
    new DeclarationHandler(),
    new MemberHandler(),
    new AttachedMemberHandler(),
    new EventHandler(),
    new EdgeHandler(),
    new AliasHandler(),
    new UnknownLineHandler(),
  ];
}
