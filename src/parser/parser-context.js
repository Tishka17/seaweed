import { tokenize } from './lexer.js';
import { normalizeWhitespace, splitLines, trimWhitespace } from './string-utils.js';

function stripBlockComments(lines) {
  const result = [];
  let inBlockComment = false;

  lines.forEach((line) => {
    let cleaned = '';
    let index = 0;

    while (index < line.length) {
      if (inBlockComment) {
        const endIndex = line.indexOf("'/", index);
        if (endIndex < 0) {
          index = line.length;
          continue;
        }

        inBlockComment = false;
        index = endIndex + 2;
        continue;
      }

      if (line[index] === '/' && line[index + 1] === "'") {
        inBlockComment = true;
        index += 2;
        continue;
      }

      cleaned += line[index];
      index += 1;
    }

    result.push(cleaned);
  });

  return result;
}

export class ParserContext {
  constructor(source, builder) {
    this.lines = stripBlockComments(splitLines(source));
    this.builder = builder;
    this.index = 0;
  }

  hasMore() {
    return this.index < this.lines.length;
  }

  advance(count = 1) {
    this.index += count;
  }

  getStatement(offset = 0) {
    const rawLine = this.lines[this.index + offset] ?? '';
    const trimmed = trimWhitespace(rawLine);
    return {
      raw: trimmed,
      normalized: normalizeWhitespace(trimmed),
      tokens: tokenize(trimmed),
      lineNumber: this.index + offset + 1,
    };
  }

  currentStatement() {
    return this.getStatement(0);
  }
}
