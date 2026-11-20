import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSnapshot, decodeSnapshot } from './protocol';
const uuid = '12345678-1234-1234-1234-123456789abc';
test('binary snapshot roundtrip and malformed input', () => {
 const encoded = encodeSnapshot({tick: 17, players:[{id:uuid,x:1,y:2,vx:3,vy:4,angle:0,hp:100,destroyed:false,lastProcessedSeq:7}], bullets:[{id:1,ownerId:uuid,x:1,y:2,vx:3,vy:4}], asteroids:[{id:2,x:3,y:4,radius:10,hp:20}]});
 const decoded = decodeSnapshot(encoded);
 assert.equal(decoded.tick,17); assert.equal(decoded.players[0]?.id,uuid);
 assert.equal(decoded.bullets.length,1); assert.equal(decoded.asteroids.length,1);
 assert.throws(()=>decodeSnapshot(encoded.slice(0,-1)),/length/);
 const invalidVersion = encoded.slice(0); new DataView(invalidVersion).setUint8(0,99);
 assert.throws(()=>decodeSnapshot(invalidVersion),/version/);
});

