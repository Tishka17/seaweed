function isWhitespace(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function isLetter(char) {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
}

function isDigit(char) {
  return char >= '0' && char <= '9';
}

function isIdentifierStart(char) {
  return isLetter(char) || char === '_' || char === '$';
}

function isIdentifierChar(char) {
  return isLetter(char) || isDigit(char) || char === '_' || char === '-' || char === '.' || char === '$';
}

function isArrowChar(char) {
  return (
    char === '-' ||
    char === '>' ||
    char === '<' ||
    char === '=' ||
    char === '.' ||
    char === '|' ||
    char === '/' ||
    char === '\\'
  );
}

function readQuotedToken(input, startIndex) {
  const quote = input[startIndex];
  let value = '';
  let index = startIndex + 1;

  while (index < input.length) {
    const char = input[index];
    if (char === quote && input[index - 1] !== '\\') {
      return {
        token: { type: 'string', value, start: startIndex, end: index + 1 },
        nextIndex: index + 1,
      };
    }

    value += char;
    index += 1;
  }

  return {
    token: { type: 'string', value, start: startIndex, end: index },
    nextIndex: index,
  };
}

export function tokenize(input) {
  const tokens = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (isWhitespace(char)) {
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const { token, nextIndex } = readQuotedToken(input, index);
      tokens.push(token);
      index = nextIndex;
      continue;
    }

    if (isArrowChar(char)) {
      const start = index;
      let value = char;
      index += 1;

      while (index < input.length && isArrowChar(input[index])) {
        value += input[index];
        index += 1;
      }

      tokens.push({ type: 'arrow', value, start, end: index });
      continue;
    }

    if (isIdentifierStart(char) || isDigit(char)) {
      const start = index;
      let value = char;
      index += 1;

      while (index < input.length && isIdentifierChar(input[index])) {
        value += input[index];
        index += 1;
      }

      tokens.push({ type: 'word', value, start, end: index });
      continue;
    }

    tokens.push({ type: 'symbol', value: char, start: index, end: index + 1 });
    index += 1;
  }

  return tokens;
}
