import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const notebookPath = path.join(__dirname, '..', 'Preprocessing', 'translate.ipynb');

const notebook = JSON.parse(fs.readFileSync(notebookPath, 'utf8'));
let strippedCells = 0;

for (const cell of notebook.cells ?? []) {
  if (cell.cell_type !== 'code') continue;
  if ((cell.outputs?.length ?? 0) > 0 || cell.execution_count != null) {
    strippedCells += 1;
  }
  cell.outputs = [];
  cell.execution_count = null;
}

fs.writeFileSync(notebookPath, `${JSON.stringify(notebook, null, 1)}\n`, 'utf8');
console.log(`Stripped outputs from ${strippedCells} code cells in ${notebookPath}.`);
