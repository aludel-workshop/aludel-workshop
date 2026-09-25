// CI results (PLATFORM-UX-01 round 3): each generated app's own GitHub Actions workflow runs its tests and uploads
// test-results.xml (JUnit, from node --test). GitHub serves artifacts as zip archives; this reads one without a dependency.
import { inflateRawSync } from 'node:zlib';

// The first file in a zip whose name matches, from the central directory (stored or deflated).
export function unzipFile(buffer, match = () => true) {
  const data = Buffer.from(buffer);
  let end = data.length - 22;
  while (end >= 0 && data.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Not a zip archive.');
  const count = data.readUInt16LE(end + 10);
  let at = data.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (data.readUInt32LE(at) !== 0x02014b50) throw new Error('Damaged zip archive.');
    const method = data.readUInt16LE(at + 10); const size = data.readUInt32LE(at + 20);
    const nameLength = data.readUInt16LE(at + 28); const extra = data.readUInt16LE(at + 30); const comment = data.readUInt16LE(at + 32);
    const local = data.readUInt32LE(at + 42); const name = data.toString('utf8', at + 46, at + 46 + nameLength);
    if (match(name)) {
      const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
      const body = data.subarray(start, start + size);
      if (method === 0) return { name, text: body.toString('utf8') };
      if (method === 8) return { name, text: inflateRawSync(body).toString('utf8') };
      throw new Error(`Unsupported zip method ${method}.`);
    }
    at += 46 + nameLength + extra + comment;
  }
  return null;
}

const unescape = value => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// JUnit test cases: name, file, and whether they passed. Skipped tests are neither passed nor failed.
export function parseJunit(xml) {
  const tests = [];
  for (const match of String(xml).matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attrs = Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, unescape(value)]));
    const body = match[3] || '';
    const failed = /<failure\b/.test(body) || 'failure' in attrs;
    const skipped = /<skipped\b/.test(body);
    tests.push({ name: attrs.name || '', file: attrs.file || attrs.classname || '', result: skipped ? 'skipped' : failed ? 'fail' : 'pass', message: failed ? (attrs.failure || /message="([^"]*)"/.exec(body)?.[1] || '').slice(0, 300) : '' });
  }
  return tests;
}
