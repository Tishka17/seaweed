import { tokenize } from './lexer.js';
import {
  compareIgnoreCase,
  endsWithIgnoreCase,
  findSequenceOutsideQuotes,
  removeQuotes,
  splitOnceOutsideQuotes,
  startsWithIgnoreCase,
  trimWhitespace,
} from './string-utils.js';

const GROUP_ONLY_KINDS = ['package', 'namespace'];
const CONTAINER_CAPABLE_KINDS = ['rectangle', 'node', 'frame', 'folder', 'cloud', 'database'];
const CLASSIFIER_KINDS = ['class', 'interface', 'enum', 'annotation', 'protocol', 'struct', 'exception', 'metaclass', 'object'];
const ENTITY_KINDS = [
  'actor',
  'participant',
  'queue',
  'collections',
  'control',
  'boundary',
  'entity',
  'artifact',
  'component',
  'usecase',
  'card',
  'file',
  'label',
  'hexagon',
  'storage',
  'agent',
  'state',
  'database',
  'rectangle',
  'node',
  'folder',
  'frame',
  'cloud',
  ...CLASSIFIER_KINDS,
];
const BLOCK_KINDS = ['group', 'alt', 'opt', 'loop', 'par', 'break', 'critical', 'box'];
const EVENT_KINDS = ['activate', 'deactivate', 'destroy', 'create'];
const MEMBER_VISIBILITIES = ['+', '-', '#', '~'];

function lowerAscii(value) {
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

function isWordToken(token, value = null) {
  if (!token || token.type !== 'word') {
    return false;
  }

  if (value === null) {
    return true;
  }

  return compareIgnoreCase(token.value, value);
}

function isSymbolToken(token, value) {
  return Boolean(token && token.type === 'symbol' && token.value === value);
}

function stripTrailingBlockStart(line) {
  let end = line.length;

  while (end > 0 && line[end - 1] === ' ') {
    end -= 1;
  }

  if (end > 0 && line[end - 1] === '{') {
    return {
      line: trimWhitespace(line.slice(0, end - 1)),
      hasBody: true,
    };
  }

  return {
    line: line,
    hasBody: false,
  };
}

function readWrappedReference(tokens, line, startIndex, openSymbol, closeSymbol) {
  let depth = 0;

  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isSymbolToken(token, openSymbol)) {
      depth += 1;
      continue;
    }

    if (isSymbolToken(token, closeSymbol)) {
      depth -= 1;
      if (depth === 0) {
        const value = trimWhitespace(removeQuotes(line.slice(tokens[startIndex].end, token.start)));
        return {
          value,
          startIndex,
          nextIndex: index + 1,
        };
      }
    }
  }

  return null;
}

export function readReference(tokens, line, startIndex) {
  if (startIndex >= tokens.length) {
    return null;
  }

  const token = tokens[startIndex];

  if (token.type === 'word' || token.type === 'string') {
    return {
      value: trimWhitespace(removeQuotes(token.value)),
      startIndex,
      nextIndex: startIndex + 1,
    };
  }

  if (isSymbolToken(token, '[')) {
    return readWrappedReference(tokens, line, startIndex, '[', ']');
  }

  if (isSymbolToken(token, '(')) {
    return readWrappedReference(tokens, line, startIndex, '(', ')');
  }

  return null;
}

export function readReferenceBackward(tokens, line, endExclusive) {
  if (endExclusive <= 0) {
    return null;
  }

  const token = tokens[endExclusive - 1];
  if (token.type === 'word' || token.type === 'string') {
    return {
      value: trimWhitespace(removeQuotes(token.value)),
      startIndex: endExclusive - 1,
      nextIndex: endExclusive,
    };
  }

  if (isSymbolToken(token, ']')) {
    let depth = 0;

    for (let index = endExclusive - 1; index >= 0; index -= 1) {
      const current = tokens[index];
      if (isSymbolToken(current, ']')) {
        depth += 1;
        continue;
      }

      if (isSymbolToken(current, '[')) {
        depth -= 1;
        if (depth === 0) {
          const value = trimWhitespace(removeQuotes(line.slice(current.end, token.start)));
          return {
            value,
            startIndex: index,
            nextIndex: endExclusive,
          };
        }
      }
    }
  }

  if (isSymbolToken(token, ')')) {
    let depth = 0;

    for (let index = endExclusive - 1; index >= 0; index -= 1) {
      const current = tokens[index];
      if (isSymbolToken(current, ')')) {
        depth += 1;
        continue;
      }

      if (isSymbolToken(current, '(')) {
        depth -= 1;
        if (depth === 0) {
          const value = trimWhitespace(removeQuotes(line.slice(current.end, token.start)));
          return {
            value,
            startIndex: index,
            nextIndex: endExclusive,
          };
        }
      }
    }
  }

  return null;
}

function parseDecorators(remaining) {
  const stereotypes = [];
  let color = null;
  let index = 0;

  while (index < remaining.length) {
    while (index < remaining.length && remaining[index] === ' ') {
      index += 1;
    }

    if (index >= remaining.length) {
      break;
    }

    if (remaining[index] === '<' && remaining[index + 1] === '<') {
      const end = findSequenceOutsideQuotes(remaining.slice(index + 2), '>>');
      if (end >= 0) {
        const value = trimWhitespace(remaining.slice(index + 2, index + 2 + end));
        if (value.length > 0) {
          stereotypes.push(value);
        }
        index = index + 2 + end + 2;
        continue;
      }
    }

    if (remaining[index] === '#') {
      let end = index + 1;
      while (end < remaining.length && remaining[end] !== ' ') {
        end += 1;
      }
      color = remaining.slice(index, end);
      index = end;
      continue;
    }

    index += 1;
  }

  return { stereotypes, color };
}

function parseKindFromTokens(tokens) {
  if (tokens.length === 0) {
    return null;
  }

  const first = tokens[0];

  if (isSymbolToken(first, '[')) {
    return {
      kind: 'component',
      referenceStartIndex: 0,
      modifiers: [],
      implicitShape: true,
    };
  }

  if (isSymbolToken(first, '(')) {
    return {
      kind: 'usecase',
      referenceStartIndex: 0,
      modifiers: [],
      implicitShape: true,
    };
  }

  if (isWordToken(first, 'abstract') && tokens.length > 1 && isWordToken(tokens[1], 'class')) {
    return {
      kind: 'class',
      referenceStartIndex: 2,
      modifiers: ['abstract'],
      implicitShape: false,
    };
  }

  if (isWordToken(first)) {
    const kind = lowerAscii(first.value);
    if (ENTITY_KINDS.includes(kind) || GROUP_ONLY_KINDS.includes(kind) || CONTAINER_CAPABLE_KINDS.includes(kind)) {
      return {
        kind,
        referenceStartIndex: 1,
        modifiers: [],
        implicitShape: false,
      };
    }
  }

  return null;
}

function parseReferenceList(tokens, line, startIndex) {
  const references = [];
  let index = startIndex;

  while (index < tokens.length) {
    const reference = readReference(tokens, line, index);
    if (!reference) {
      break;
    }

    references.push(reference.value);
    index = reference.nextIndex;

    if (index < tokens.length && isSymbolToken(tokens[index], ',')) {
      index += 1;
    }
  }

  return references;
}

function containsArrowLineChars(segment) {
  let hasLine = false;

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    if (char === '-' || char === '.' || char === '=') {
      hasLine = true;
      break;
    }
  }

  return hasLine;
}

function parseArrowDirection(arrow) {
  const value = lowerAscii(arrow);
  if (value.includes('left')) {
    return 'left';
  }

  if (value.includes('right')) {
    return 'right';
  }

  if (value.includes('up')) {
    return 'up';
  }

  if (value.includes('down')) {
    return 'down';
  }

  return null;
}

function parseArrowStyle(arrow) {
  if (arrow.includes('..')) {
    return 'dashed';
  }

  if (arrow.includes('==')) {
    return 'bold';
  }

  return 'solid';
}

export function isCommentLine(line) {
  return startsWithIgnoreCase(line, "'") || startsWithIgnoreCase(line, '//') || startsWithIgnoreCase(line, '/\'');
}

export function isDiagramBoundary(line) {
  return startsWithIgnoreCase(line, '@startuml') || startsWithIgnoreCase(line, '@enduml');
}

export function parseDeclarationLine(line) {
  const { line: declarationLine, hasBody } = stripTrailingBlockStart(line);
  const tokens = tokenize(declarationLine);
  const kindInfo = parseKindFromTokens(tokens);

  if (!kindInfo) {
    return null;
  }

  const reference = readReference(tokens, declarationLine, kindInfo.referenceStartIndex);
  if (!reference) {
    return null;
  }

  let alias = null;
  let index = reference.nextIndex;

  while (index < tokens.length) {
    if (isWordToken(tokens[index], 'as')) {
      const aliasReference = readReference(tokens, declarationLine, index + 1);
      if (aliasReference) {
        alias = aliasReference.value;
        index = aliasReference.nextIndex;
      }
      break;
    }
    index += 1;
  }

  const decoratorStart = index < tokens.length ? tokens[index]?.start ?? declarationLine.length : declarationLine.length;
  const decorators = parseDecorators(declarationLine.slice(decoratorStart));

  let structure = 'node';
  let closeStrategy = null;

  if (GROUP_ONLY_KINDS.includes(kindInfo.kind)) {
    structure = 'group';
    closeStrategy = hasBody ? 'brace' : 'end';
  } else if (CONTAINER_CAPABLE_KINDS.includes(kindInfo.kind) && hasBody) {
    structure = 'group';
    closeStrategy = 'brace';
  } else if (CLASSIFIER_KINDS.includes(kindInfo.kind) && hasBody) {
    structure = 'entityBody';
    closeStrategy = 'brace';
  }

  return {
    kind: kindInfo.kind,
    label: reference.value,
    alias,
    hasBody,
    structure,
    closeStrategy,
    stereotypes: decorators.stereotypes,
    color: decorators.color,
    modifiers: kindInfo.modifiers,
  };
}

export function parseAliasStatement(line) {
  const tokens = tokenize(line);
  if (tokens.length < 3) {
    return null;
  }

  const label = readReference(tokens, line, 0);
  if (!label) {
    return null;
  }

  if (!isWordToken(tokens[label.nextIndex], 'as')) {
    return null;
  }

  const alias = readReference(tokens, line, label.nextIndex + 1);
  if (!alias) {
    return null;
  }

  return {
    label: label.value,
    alias: alias.value,
  };
}

export function parseEdge(line) {
  const [headPart, labelPart] = splitOnceOutsideQuotes(line, ':');
  const head = trimWhitespace(headPart);
  const label = trimWhitespace(labelPart);
  const tokens = tokenize(head);

  if (tokens.length < 3) {
    return null;
  }

  const sourceReference = readReference(tokens, head, 0);
  if (!sourceReference) {
    return null;
  }

  let arrowStartIndex = sourceReference.nextIndex;
  let sourceCardinality = null;
  if (arrowStartIndex < tokens.length && tokens[arrowStartIndex].type === 'string') {
    sourceCardinality = trimWhitespace(removeQuotes(tokens[arrowStartIndex].value));
    arrowStartIndex += 1;
  }

  const targetReference = readReferenceBackward(tokens, head, tokens.length);
  if (!targetReference || targetReference.startIndex <= arrowStartIndex) {
    return null;
  }

  let arrowEndIndex = targetReference.startIndex;
  let targetCardinality = null;
  if (arrowEndIndex - 1 >= arrowStartIndex && tokens[arrowEndIndex - 1].type === 'string') {
    targetCardinality = trimWhitespace(removeQuotes(tokens[arrowEndIndex - 1].value));
    arrowEndIndex -= 1;
  }

  if (arrowEndIndex <= arrowStartIndex) {
    return null;
  }

  const arrow = trimWhitespace(head.slice(tokens[arrowStartIndex].start, tokens[arrowEndIndex - 1].end));
  if (!containsArrowLineChars(arrow)) {
    return null;
  }

  return {
    from: sourceReference.value,
    to: targetReference.value,
    arrow,
    label: label.length > 0 ? removeQuotes(label) : null,
    sourceCardinality,
    targetCardinality,
    direction: parseArrowDirection(arrow),
    lineStyle: parseArrowStyle(arrow),
  };
}

export function parseMetadataLine(line) {
  const metadataKeywords = ['title', 'caption', 'header', 'footer'];

  for (let index = 0; index < metadataKeywords.length; index += 1) {
    const keyword = metadataKeywords[index];
    const prefix = `${keyword} `;
    if (startsWithIgnoreCase(line, prefix)) {
      return {
        key: keyword,
        value: trimWhitespace(removeQuotes(line.slice(prefix.length))),
      };
    }
  }

  if (compareIgnoreCase(line, 'left to right direction')) {
    return {
      key: 'direction',
      value: 'left to right',
    };
  }

  if (compareIgnoreCase(line, 'top to bottom direction')) {
    return {
      key: 'direction',
      value: 'top to bottom',
    };
  }

  return null;
}

export function parseSkinParamLine(line) {
  if (!startsWithIgnoreCase(line, 'skinparam ')) {
    return null;
  }

  const body = trimWhitespace(line.slice('skinparam '.length));
  const tokens = tokenize(body);
  if (tokens.length < 2 || !isWordToken(tokens[0])) {
    return {
      key: null,
      value: body,
    };
  }

  return {
    key: tokens[0].value,
    value: trimWhitespace(body.slice(tokens[0].end)),
  };
}

export function parseDirectiveLine(line) {
  if (line.length === 0) {
    return null;
  }

  if (line[0] === '!') {
    let index = 1;
    while (index < line.length && line[index] !== ' ') {
      index += 1;
    }

    return {
      type: 'preprocessor',
      name: line.slice(1, index),
      value: trimWhitespace(line.slice(index)),
      raw: line,
    };
  }

  if (startsWithIgnoreCase(line, 'autonumber')) {
    return {
      type: 'sequence',
      name: 'autonumber',
      value: trimWhitespace(line.slice('autonumber'.length)),
      raw: line,
    };
  }

  if (startsWithIgnoreCase(line, 'newpage')) {
    return {
      type: 'layout',
      name: 'newpage',
      value: trimWhitespace(line.slice('newpage'.length)),
      raw: line,
    };
  }

  if (startsWithIgnoreCase(line, 'hide ')) {
    return {
      type: 'hide',
      name: 'hide',
      value: trimWhitespace(line.slice('hide '.length)),
      raw: line,
    };
  }

  if (startsWithIgnoreCase(line, 'show ')) {
    return {
      type: 'show',
      name: 'show',
      value: trimWhitespace(line.slice('show '.length)),
      raw: line,
    };
  }

  return null;
}

function unwrapFirstParenthesizedValue(line) {
  const start = line.indexOf('(');
  if (start < 0) {
    return null;
  }

  const end = line.indexOf(')', start + 1);
  if (end < 0) {
    return null;
  }

  return trimWhitespace(removeQuotes(line.slice(start + 1, end)));
}

function unwrapTrailingParenthesizedValue(line) {
  const start = line.lastIndexOf('(');
  const end = line.lastIndexOf(')');
  if (start < 0 || end < start) {
    return null;
  }

  return trimWhitespace(removeQuotes(line.slice(start + 1, end)));
}

export function parseActivityLine(line, isInsideActivity = false) {
  if (compareIgnoreCase(line, 'start')) {
    return {
      type: 'start',
    };
  }

  if (compareIgnoreCase(line, 'stop') || (isInsideActivity && compareIgnoreCase(line, 'end'))) {
    return {
      type: 'stop',
    };
  }

  if (line.length > 2 && line[0] === ':' && line[line.length - 1] === ';') {
    return {
      type: 'action',
      label: trimWhitespace(removeQuotes(line.slice(1, line.length - 1))),
    };
  }

  if (startsWithIgnoreCase(line, 'if ')) {
    const condition = unwrapFirstParenthesizedValue(line) || trimWhitespace(removeQuotes(line.slice(3)));
    const thenLabel = startsWithIgnoreCase(line, 'if ') && line.includes(' then ')
      ? unwrapTrailingParenthesizedValue(line)
      : null;

    return {
      type: 'decision',
      label: condition,
      branchLabel: thenLabel,
    };
  }

  if (startsWithIgnoreCase(line, 'while ')) {
    return {
      type: 'while',
      label: unwrapFirstParenthesizedValue(line) || trimWhitespace(removeQuotes(line.slice('while '.length))),
      branchLabel: line.includes(' is ') ? unwrapTrailingParenthesizedValue(line) : null,
    };
  }

  if (isInsideActivity && startsWithIgnoreCase(line, 'endwhile')) {
    return {
      type: 'endwhile',
      branchLabel: unwrapTrailingParenthesizedValue(line),
    };
  }

  if (isInsideActivity && startsWithIgnoreCase(line, 'else')) {
    return {
      type: 'else',
      branchLabel: unwrapTrailingParenthesizedValue(line),
    };
  }

  if (isInsideActivity && compareIgnoreCase(line, 'endif')) {
    return {
      type: 'endif',
    };
  }

  return null;
}

export function parseAttachedMemberLine(line) {
  const [ownerPart, memberPart] = splitOnceOutsideQuotes(line, ':');
  const owner = trimWhitespace(removeQuotes(ownerPart));
  const member = trimWhitespace(memberPart);

  if (owner.length === 0 || member.length === 0 || parseEdge(line)) {
    return null;
  }

  return {
    owner,
    member: parseMemberLine(member),
  };
}

export function parseStateTransition(line) {
  if (!line.includes('[*]')) {
    return null;
  }

  const edge = parseEdge(line);
  if (!edge) {
    return null;
  }

  return {
    ...edge,
    fromStart: edge.from === '*',
    toEnd: edge.to === '*',
  };
}

export function parseBlockLine(line) {
  if (compareIgnoreCase(line, 'divider')) {
    return {
      type: 'divider',
      title: 'divider',
      supportsBranches: false,
    };
  }

  if (startsWithIgnoreCase(line, '==') && endsWithIgnoreCase(line, '==') && line.length > 4) {
    return {
      type: 'divider',
      title: trimWhitespace(line.slice(2, line.length - 2)),
      supportsBranches: false,
    };
  }

  if (compareIgnoreCase(line, 'else')) {
    return {
      type: 'else',
      title: 'else',
    };
  }

  if (startsWithIgnoreCase(line, 'else ')) {
    return {
      type: 'else',
      title: trimWhitespace(removeQuotes(line.slice('else '.length))),
    };
  }

  for (let index = 0; index < BLOCK_KINDS.length; index += 1) {
    const keyword = BLOCK_KINDS[index];
    if (compareIgnoreCase(line, keyword)) {
      return {
        type: keyword,
        title: keyword,
        supportsBranches: keyword === 'alt' || keyword === 'par',
      };
    }

    if (startsWithIgnoreCase(line, `${keyword} `)) {
      return {
        type: keyword,
        title: trimWhitespace(removeQuotes(line.slice(keyword.length + 1))),
        supportsBranches: keyword === 'alt' || keyword === 'par',
      };
    }
  }

  return null;
}

export function parseReferenceBlockLine(line) {
  if (!startsWithIgnoreCase(line, 'ref ')) {
    return null;
  }

  const body = trimWhitespace(line.slice('ref '.length));
  const [descriptorPart, titlePart] = splitOnceOutsideQuotes(body, ':');
  const descriptor = trimWhitespace(descriptorPart);
  const title = trimWhitespace(removeQuotes(titlePart));
  let targets = [];

  if (startsWithIgnoreCase(descriptor, 'over ')) {
    const targetLine = trimWhitespace(descriptor.slice('over '.length));
    const tokens = tokenize(targetLine);
    targets = parseReferenceList(tokens, targetLine, 0);
  }

  return {
    type: 'ref',
    title: title || trimWhitespace(removeQuotes(descriptor)),
    targets,
  };
}

export function parseNoteLine(line) {
  if (!startsWithIgnoreCase(line, 'note ')) {
    return null;
  }

  const body = trimWhitespace(line.slice('note '.length));
  const [descriptorPart, noteBodyPart] = splitOnceOutsideQuotes(body, ':');
  const descriptor = trimWhitespace(descriptorPart);
  const noteBody = trimWhitespace(noteBodyPart);
  const tokens = tokenize(descriptor);

  let placement = 'over';
  let index = 0;

  if (tokens.length > 0 && isWordToken(tokens[0], 'over')) {
    placement = 'over';
    index = 1;
  } else if (tokens.length > 1 && isWordToken(tokens[1], 'of')) {
    placement = `${lowerAscii(tokens[0].value)} of`;
    index = 2;
  }

  const targets = parseReferenceList(tokens, descriptor, index);
  return {
    type: 'note',
    placement,
    targets,
    body: noteBody.length > 0 ? noteBody : null,
    isMultiline: noteBody.length === 0,
  };
}

export function parseEventLine(line) {
  for (let index = 0; index < EVENT_KINDS.length; index += 1) {
    const keyword = EVENT_KINDS[index];
    if (startsWithIgnoreCase(line, `${keyword} `)) {
      return {
        type: keyword,
        target: trimWhitespace(removeQuotes(line.slice(keyword.length + 1))),
      };
    }
  }

  if (compareIgnoreCase(line, 'return')) {
    return {
      type: 'return',
      body: null,
    };
  }

  if (startsWithIgnoreCase(line, 'return ')) {
    return {
      type: 'return',
      body: trimWhitespace(removeQuotes(line.slice('return '.length))),
    };
  }

  return null;
}

function isMemberSeparator(line) {
  if (line.length < 2) {
    return false;
  }

  const allowed = ['-', '.', '=', '_'];
  for (let index = 0; index < line.length; index += 1) {
    if (!allowed.includes(line[index])) {
      return false;
    }
  }

  return true;
}

function isMethodMember(line) {
  const openIndex = line.indexOf('(');
  const closeIndex = line.indexOf(')');
  return openIndex >= 0 && closeIndex > openIndex;
}

export function parseMemberLine(line) {
  if (isMemberSeparator(line)) {
    return {
      kind: 'separator',
      text: line,
    };
  }

  let visibility = null;
  let body = line;

  if (MEMBER_VISIBILITIES.includes(line[0])) {
    visibility = line[0];
    body = trimWhitespace(line.slice(1));
  }

  return {
    kind: isMethodMember(body) ? 'method' : 'field',
    text: body,
    visibility,
  };
}
