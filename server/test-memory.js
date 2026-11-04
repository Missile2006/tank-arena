
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

const filePath = path.join(os.tmpdir(), 'tank-arena-memory-test.bin');
const fileSize = 100 * 1024 * 1024;

function getRSS() {
  return (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createTestFile() {
  if (fs.existsSync(filePath)) return;

  console.log('Creating 100 MB test file...');

  const stream = fs.createWriteStream(filePath);
  const chunk = Buffer.alloc(1024 * 1024, 65);

  for (let i = 0; i < 100; i++) {
    if (!stream.write(chunk)) {
      await new Promise((resolve) => stream.once('drain', resolve));
    }
  }

  await new Promise((resolve, reject) => {
    stream.once('finish', resolve);
    stream.once('error', reject);
    stream.end();
  });
}

async function testReadFile() {
  console.log('\n=== readFile ===');
  console.log('RSS before:', getRSS(), 'MB');

  const data = await fs.promises.readFile(filePath);

  console.log('RSS after loading:', getRSS(), 'MB');
  console.log('Bytes loaded:', data.length);

  await sleep(1000);
}

async function testStream() {
  console.log('\n=== createReadStream ===');
  console.log('RSS before:', getRSS(), 'MB');

  const destination = new Writable({
    async write(chunk, encoding, callback) {
      await sleep(10);
      callback();
    },
  });

  await pipeline(
    fs.createReadStream(filePath, {
      highWaterMark: 64 * 1024,
    }),
    destination,
  );

  console.log('RSS after streaming:', getRSS(), 'MB');
}

await createTestFile();

const mode = process.argv[2];

if (mode === 'readfile') {
  await testReadFile();
} else if (mode === 'stream') {
  await testStream();
} else {
  console.log('Use: node test-memory.js readfile|stream');
}

console.log('\nExperiment finished');
