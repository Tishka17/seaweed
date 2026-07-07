export function safeText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

export function textWidth(value, fontSize = 14) {
  return Math.max(1, safeText(value).length) * fontSize * 0.58;
}

export function formatMember(member) {
  const prefix = member.visibility ? `${member.visibility} ` : '';
  return `${prefix}${member.text}`;
}

export function nodeTextRows(node) {
  const rows = [];

  if (node.stereotypes && node.stereotypes.length > 0) {
    rows.push({
      type: 'stereotype',
      text: `<<${node.stereotypes.join(', ')}>>`,
    });
  }

  rows.push({
    type: 'title',
    text: node.label || node.id,
  });

  if (node.members && node.members.length > 0) {
    for (let index = 0; index < node.members.length; index += 1) {
      const member = node.members[index];
      rows.push({
        type: member.kind,
        text: member.kind === 'separator' ? '' : formatMember(member),
      });
    }
  }

  return rows;
}

export function noteLines(note) {
  const body = safeText(note.body || note.type || 'note');
  return body.length > 0 ? body.split('\n') : [''];
}

export function labelBox(text, fontSize = 12) {
  return {
    width: Math.ceil(textWidth(text, fontSize) + 10),
    height: fontSize + 7,
  };
}

export function noteSize(note) {
  const lines = noteLines(note);
  let longest = 0;

  for (let index = 0; index < lines.length; index += 1) {
    longest = Math.max(longest, textWidth(lines[index], 13));
  }

  return {
    width: Math.max(110, Math.ceil(longest + 22)),
    height: Math.max(36, 14 + lines.length * 18),
  };
}

export function eventSize(event) {
  return labelBox(event.body ? `${event.type}: ${event.body}` : event.type, 12);
}
