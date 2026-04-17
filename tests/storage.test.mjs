import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { load, save } from '../storage.js';

function tmpPath() {
  return path.join(
    os.tmpdir(),
    `sticky-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

function cleanup(p) {
  for (const f of [p, p + '.tmp']) {
    try { fs.unlinkSync(f); } catch {}
  }
}

test('load returns {} when file does not exist', () => {
  const p = tmpPath();
  assert.deepEqual(load(p), {});
});

test('save then load round-trips the object', () => {
  const p = tmpPath();
  const data = { notes: [{ id: 'a', title: 'hello' }], tweaks: { theme: 'paper' } };
  save(p, data);
  assert.deepEqual(load(p), data);
  cleanup(p);
});

test('load returns {} on invalid JSON and warns', () => {
  const p = tmpPath();
  fs.writeFileSync(p, '{ not valid json');
  const origWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };
  try {
    assert.deepEqual(load(p), {});
    assert.ok(warned, 'expected console.warn to be called');
  } finally {
    console.warn = origWarn;
    cleanup(p);
  }
});

test('save creates the parent directory if missing', () => {
  const dir = path.join(os.tmpdir(), `sticky-dir-${Date.now()}`);
  const p = path.join(dir, 'nested', 'notes.json');
  try {
    save(p, { hi: 1 });
    assert.ok(fs.existsSync(p));
    assert.deepEqual(load(p), { hi: 1 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('save writes to .tmp first then renames', (t) => {
  const p = tmpPath();
  let tmpExistedAtRename = false;
  const origRename = fs.renameSync.bind(fs);
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (from === p + '.tmp' && to === p) {
      tmpExistedAtRename = fs.existsSync(p + '.tmp');
    }
    return origRename(from, to);
  });
  save(p, { hi: 1 });
  assert.ok(tmpExistedAtRename, 'tmp file should exist at moment of rename');
  cleanup(p);
});

test('save preserves original file if rename throws', (t) => {
  const p = tmpPath();
  save(p, { original: true });
  const m = t.mock.method(fs, 'renameSync', () => { throw new Error('simulated crash'); });
  assert.throws(() => save(p, { new: true }), /simulated crash/);
  m.mock.restore();
  assert.deepEqual(load(p), { original: true });
  cleanup(p);
});
