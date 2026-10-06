// W-27 (A7): Previous beside Proposed for a staged record. A record's fields become readable lines (YAML-like: nested
// objects indent, lists take "- "), then a line diff pairs them into rows, so both sides stay aligned and the changed
// lines are marked. Empty values (null, '', []) are left out, as a reader would.
export type DiffRow = { kind: 'same' | 'changed' | 'removed' | 'added' | 'gap'; previous: string | null; proposed: string | null; hidden?: number };
export type FieldDiff = { key: string; label: string; changed: boolean; rows: DiffRow[] };

const empty = (value: unknown): boolean => value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)
  || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value as object).some(key => !empty((value as Record<string, unknown>)[key])));
const scalar = (value: unknown) => typeof value === 'string' ? value.replace(/\s*\n\s*/g, ' ') : String(value);

export function toLines(value: unknown, indent = ''): string[] {
  if (empty(value)) return [];
  if (Array.isArray(value)) return value.flatMap(entry => {
    const lines = toLines(entry, indent + '  ');
    if (!lines.length) return [];
    return [indent + '- ' + lines[0].slice(indent.length + 2), ...lines.slice(1)];
  });
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    if (empty(entry) || key === 'id') return []; // a nested record's id means nothing to a reader
    if (typeof entry !== 'object') return [`${indent}${label(key)}: ${scalar(entry)}`];
    return [`${indent}${label(key)}:`, ...toLines(entry, indent + '  ')];
  });
  return [indent + scalar(value)];
}

export function label(key: string) {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Longest common subsequence over lines; records are small, and a very large pair falls back to "all changed".
function ops(a: string[], b: string[]): ('=' | '-' | '+')[] {
  const n = a.length, m = b.length;
  if (n * m > 400_000) return [...a.map(() => '-' as const), ...b.map(() => '+' as const)];
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const out: ('=' | '-' | '+')[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { out.push('='); i++; j++; } else if (table[i + 1][j] >= table[i][j + 1]) { out.push('-'); i++; } else { out.push('+'); j++; } }
  while (i < n) { out.push('-'); i++; }
  while (j < m) { out.push('+'); j++; }
  return out;
}

// Pairs a run of removed lines with the added lines after it, so a changed line sits beside what replaced it.
export function diffRows(previous: string[], proposed: string[]): DiffRow[] {
  const rows: DiffRow[] = []; let i = 0, j = 0; const steps = ops(previous, proposed);
  for (let k = 0; k < steps.length;) {
    if (steps[k] === '=') { rows.push({ kind: 'same', previous: previous[i++], proposed: proposed[j++] }); k++; continue; }
    const removed: string[] = [], added: string[] = [];
    while (k < steps.length && steps[k] !== '=') { if (steps[k] === '-') removed.push(previous[i++]); else added.push(proposed[j++]); k++; }
    for (let p = 0; p < Math.max(removed.length, added.length); p++) {
      const before = removed[p] ?? null, after = added[p] ?? null;
      rows.push({ kind: before !== null && after !== null ? 'changed' : before !== null ? 'removed' : 'added', previous: before, proposed: after });
    }
  }
  return rows;
}

// Long unchanged runs fold to a gap with three lines of context either side.
export function fold(rows: DiffRow[], context = 3): DiffRow[] {
  const out: DiffRow[] = [];
  for (let k = 0; k < rows.length;) {
    if (rows[k].kind !== 'same') { out.push(rows[k++]); continue; }
    let end = k; while (end < rows.length && rows[end].kind === 'same') end++;
    const run = rows.slice(k, end), lead = k === 0 ? 0 : context, tail = end === rows.length ? 0 : context;
    if (run.length > lead + tail + 2) out.push(...run.slice(0, lead), { kind: 'gap', previous: null, proposed: null, hidden: run.length - lead - tail }, ...run.slice(run.length - tail));
    else out.push(...run);
    k = end;
  }
  return out;
}

// Field by field: every field either side has, in the proposed record's order, then any only the previous one had.
export function recordDiff(previous: Record<string, unknown> | null | undefined, proposed: Record<string, unknown> | null | undefined): FieldDiff[] {
  const before = previous || {}, after = proposed || {};
  const keys = [...new Set([...Object.keys(after), ...Object.keys(before)])];
  return keys.flatMap(key => {
    const a = toLines(before[key]), b = toLines(after[key]);
    if (!a.length && !b.length) return [];
    const changed = a.length !== b.length || a.some((line, index) => line !== b[index]);
    return [{ key, label: label(key), changed, rows: diffRows(a, b) }];
  });
}

// W-27 #5: a git unified diff as the same aligned rows, with each side's line numbers; each hunk opens with its @@ line.
export type CodeRow = DiffRow & { oldNo?: number | null; newNo?: number | null; hunk?: string };
export function unifiedRows(diff: string): CodeRow[] {
  const rows: CodeRow[] = [];
  let oldNo = 0, newNo = 0, removed: [string, number][] = [], added: [string, number][] = [];
  const flush = () => {
    for (let p = 0; p < Math.max(removed.length, added.length); p++) {
      const before = removed[p] ?? null, after = added[p] ?? null;
      rows.push({ kind: before && after ? 'changed' : before ? 'removed' : 'added', previous: before?.[0] ?? null, proposed: after?.[0] ?? null, oldNo: before?.[1] ?? null, newNo: after?.[1] ?? null });
    }
    removed = []; added = [];
  };
  for (const line of diff.split('\n')) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) { flush(); oldNo = Number(hunk[1]); newNo = Number(hunk[2]); rows.push({ kind: 'gap', previous: null, proposed: null, hunk: line }); continue; }
    if (!rows.length || line === '' || line.startsWith('\\')) continue; // the file header, the trailing newline, "\ No newline at end of file"
    if (line[0] === '-') removed.push([line.slice(1), oldNo++]);
    else if (line[0] === '+') added.push([line.slice(1), newNo++]);
    else { flush(); rows.push({ kind: 'same', previous: line.slice(1), proposed: line.slice(1), oldNo: oldNo++, newNo: newNo++ }); }
  }
  flush();
  return rows;
}

// The changed files as a folder tree; a folder holding one folder and nothing else is shown joined ("src/layers").
export type FileEntry = { path: string; from: string | null; status: string; added: number; removed: number; binary: boolean };
export type TreeNode = { name: string; path: string; file: FileEntry | null; children: TreeNode[] };
export function fileTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', file: null, children: [] };
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    let node = root; const parts = file.path.split('/');
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/'), last = index === parts.length - 1;
      let child = node.children.find(entry => entry.name === part && Boolean(entry.file) === last);
      if (!child) node.children.push(child = { name: part, path, file: last ? file : null, children: [] });
      node = child;
    });
  }
  const join = (node: TreeNode): TreeNode => {
    let current = { ...node, children: node.children.map(join) };
    while (!current.file && current.children.length === 1 && !current.children[0].file) { const only = current.children[0]; current = { ...only, name: `${current.name}/${only.name}` }; }
    return current;
  };
  const sorted = (nodes: TreeNode[]): TreeNode[] => nodes.map(node => ({ ...node, children: sorted(node.children) })).sort((a, b) => Number(Boolean(a.file)) - Number(Boolean(b.file)) || a.name.localeCompare(b.name));
  return sorted(root.children.map(join));
}
