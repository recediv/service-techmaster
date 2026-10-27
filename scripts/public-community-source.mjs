import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// Exact local mysqldump reader. It never executes SQL or imports the old
// research module, and returns only explicitly requested columns.
export async function readCommunitySnapshot(file) {
  const bytes = await fs.readFile(file), sql = bytes.toString('utf8');
  const schemas = new Map();
  function columns(table) {
    if (schemas.has(table)) return schemas.get(table);
    if (!/^[a-z0-9_]+$/i.test(table)) throw new Error('Invalid local source table.');
    const start = sql.search(new RegExp('CREATE TABLE(?: IF NOT EXISTS)? `' + table + '`'));
    if (start < 0) throw new Error('Required local public source schema is missing.');
    const definition = sql.slice(start, sql.indexOf(';', start));
    const names = [...definition.matchAll(/`([^`]+)`\s+(?:bigint|smallint|mediumint|tinyint|int|varchar|char|text|mediumtext|longtext|datetime|timestamp|decimal|double|float|enum|set|blob|binary|varbinary)\b/gi)].map(match => match[1]);
    if (!names.length) throw new Error('Unrecognized local public source schema.');
    schemas.set(table, names); return names;
  }
  function unquote(raw) {
    if (raw === 'NULL') return null;
    if (raw[0] !== "'") return raw;
    return raw.slice(1, -1).replace(/\\([0bnrtZ\\'"])/g, (_, character) => ({ '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a' }[character] ?? character));
  }
  function* rows(table) {
    let position = 0; const marker = 'INSERT INTO `' + table + '`';
    while ((position = sql.indexOf(marker, position)) !== -1) {
      position += marker.length;
      const next = sql.slice(position).match(/^\s*(?:\(([^;]+?)\)\s*)?VALUES\s*/i);
      if (!next) throw new Error('Unsupported local INSERT column layout.');
      const insertColumns = next[1] ? next[1].split(',').map(value => {
        const match = value.trim().match(/^`([a-z0-9_]+)`$/i); if (!match) throw new Error('Invalid local INSERT column.'); return match[1];
      }) : columns(table);
      position += next[0].length;
      let quoted = false, depth = 0, cell = position, values = [];
      for (; position < sql.length; position++) {
        const character = sql[position];
        if (quoted) { if (character === '\\') position++; else if (character === "'") quoted = false; continue; }
        if (character === "'") { quoted = true; continue; }
        if (character === '(') { depth++; if (depth === 1) { cell = position + 1; values = []; } continue; }
        if (character === ',' && depth === 1) { values.push(sql.slice(cell, position).trim()); cell = position + 1; continue; }
        if (character === ')') { if (depth === 1) { values.push(sql.slice(cell, position).trim()); yield { values, insertColumns }; } depth--; continue; }
        if (character === ';' && depth === 0) { position++; break; }
      }
    }
  }
  const select = (table, predicate, fields) => {
    const names = columns(table), indexes = new Map(names.map((name, index) => [name, index]));
    for (const field of fields) if (!indexes.has(field)) throw new Error('A required public source column is missing: ' + table + '.' + field);
    const result = [];
    for (const { values, insertColumns } of rows(table)) {
      if (values.length !== insertColumns.length || insertColumns.some(name => !indexes.has(name))) throw new Error('Local source row does not match its declared schema.');
      const positions = new Map(insertColumns.map((name, index) => [name, index]));
      const get = name => positions.has(name) ? unquote(values[positions.get(name)] ?? 'NULL') : null;
      if (predicate(get)) result.push(Object.fromEntries(fields.map(name => [name, get(name)])));
    }
    return result;
  };
  return { select, columns, sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'), sourceBytes: bytes.length };
}
