function isWhitespace(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function toLowerAscii(char) {
  if (char >= 'A' && char <= 'Z') {
    return String.fromCharCode(char.charCodeAt(0) + 32);
  }

  return char;
}

export function trimWhitespace(str) {
  let start = 0;
  let end = str.length;

  while (start < end && isWhitespace(str[start])) {
    start += 1;
  }

  while (end > start && isWhitespace(str[end - 1])) {
    end -= 1;
  }

  return str.slice(start, end);
}

export function normalizeWhitespace(line) {
  let result = '';
  let lastWasSpace = false;
  let quote = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quote) {
      result += char;
      if (char === quote && line[index - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      result += char;
      lastWasSpace = false;
      continue;
    }

    if (isWhitespace(char)) {
      if (!lastWasSpace && result.length > 0) {
        result += ' ';
      }
      lastWasSpace = true;
      continue;
    }

    result += char;
    lastWasSpace = false;
  }

  return trimWhitespace(result);
}

export function compareIgnoreCase(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (toLowerAscii(a[index]) !== toLowerAscii(b[index])) {
      return false;
    }
  }

  return true;
}

export function startsWithIgnoreCase(str, prefix) {
  if (str.length < prefix.length) {
    return false;
  }

  for (let index = 0; index < prefix.length; index += 1) {
    if (toLowerAscii(str[index]) !== toLowerAscii(prefix[index])) {
      return false;
    }
  }

  return true;
}

export function endsWithIgnoreCase(str, suffix) {
  if (str.length < suffix.length) {
    return false;
  }

  const offset = str.length - suffix.length;
  for (let index = 0; index < suffix.length; index += 1) {
    if (toLowerAscii(str[offset + index]) !== toLowerAscii(suffix[index])) {
      return false;
    }
  }

  return true;
}

export function startsWith(str, prefix) {
  if (str.length < prefix.length) {
    return false;
  }

  for (let index = 0; index < prefix.length; index += 1) {
    if (str[index] !== prefix[index]) {
      return false;
    }
  }

  return true;
}

export function sliceFromPrefix(str, prefix) {
  if (str.length <= prefix.length) {
    return '';
  }

  return str.slice(prefix.length);
}

export function removeQuotes(str) {
  let value = str;

  if (
    value.length >= 2 &&
    ((value[0] === '"' && value[value.length - 1] === '"') ||
      (value[0] === "'" && value[value.length - 1] === "'"))
  ) {
    value = value.slice(1, value.length - 1);
  }

  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === '\\' && next !== undefined) {
      if (next === 'n') {
        result += '\n';
      } else if (next === 'r') {
        result += '\r';
      } else if (next === 't') {
        result += '\t';
      } else {
        result += next;
      }
      index += 1;
      continue;
    }

    result += char;
  }

  return result;
}

export function splitLines(source) {
  const lines = [];
  let current = '';

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (char === '\r' && nextChar === '\n') {
      lines.push(current);
      current = '';
      index += 1;
      continue;
    }

    if (char === '\n' || char === '\r') {
      lines.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

export function sanitizeId(str) {
  let result = '';
  let lastWasSeparator = false;

  for (let index = 0; index < str.length; index += 1) {
    const char = str[index];
    const isAlphaNumeric =
      (char >= 'a' && char <= 'z') ||
      (char >= 'A' && char <= 'Z') ||
      (char >= '0' && char <= '9');

    if (isAlphaNumeric || char === '_' || char === '-' || char === '.') {
      result += char;
      lastWasSeparator = false;
      continue;
    }

    if (isWhitespace(char) && !lastWasSeparator && result.length > 0) {
      result += '_';
      lastWasSeparator = true;
    }
  }

  if (result.length === 0) {
    return 'node';
  }

  return result;
}

export function findCharOutsideQuotes(str, target) {
  let quote = null;

  for (let index = 0; index < str.length; index += 1) {
    const char = str[index];

    if (quote) {
      if (char === quote && str[index - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === target) {
      return index;
    }
  }

  return -1;
}

export function findSequenceOutsideQuotes(str, sequence) {
  if (sequence.length === 0 || str.length < sequence.length) {
    return -1;
  }

  let quote = null;

  for (let index = 0; index <= str.length - sequence.length; index += 1) {
    const char = str[index];

    if (quote) {
      if (char === quote && str[index - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    let matches = true;
    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (str[index + offset] !== sequence[offset]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return index;
    }
  }

  return -1;
}

export function splitOnceOutsideQuotes(str, delimiter) {
  const index = findSequenceOutsideQuotes(str, delimiter);
  if (index < 0) {
    return [str, ''];
  }

  return [str.slice(0, index), str.slice(index + delimiter.length)];
}
