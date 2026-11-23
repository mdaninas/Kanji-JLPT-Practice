export function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { cells.push(cell); cell = ''; continue; }
    cell += char;
  }

  cells.push(cell);
  return cells.map((value) => value.trim());
}
