import { ClientCryptoAdapter } from './src/crypto/x3dhCrypto.js';

const BASE = 'http://127.0.0.1:8003';
const BOB_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMjIyMjIyMi0yMjIyLTQyMjItYTIyMi0yMjIyMjIyMjIyMjIiLCJ1c2VyX2lkIjoiMjIyMjIyMjItMjIyMi00MjIyLWEyMjItMjIyMjIyMjIyMjIyIiwiZXhwIjoxODIwNTExMDkzfQ.DYlybcBLA3qzfkvcwkPuDglx-yGK0NQjZb0SWYoJTd8';
const ALICE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtYTExMS0xMTExMTExMTExMTEiLCJ1c2VyX2lkIjoiMTExMTExMTEtMTExMS00MTExLWExMTEtMTExMTExMTExMTExIiwiZXhwIjoxODIwNTExMDkzfQ.03noPCr-1b_aMArepJ4pnrK1FOToaWNAZUFEpOXiCVE';
const CONV_ID = '90da5b4a-1472-4368-a510-1d544f321829';

async function test() {
  const bob = new ClientCryptoAdapter('web-bob-device');
  const alice = new ClientCryptoAdapter('web-alice-device');

  console.log('=== Fetching envelopes for Bob ===');
  const resBob = await fetch(BASE + '/e2ee/conversations/' + CONV_ID + '/messages', {
    headers: { 'Authorization': 'Bearer ' + BOB_TOKEN, 'X-Device-Id': 'web-bob-device' }
  });
  const envsBob = await resBob.json();
  console.log('Total envelopes for Bob in DB:', envsBob.length);

  for (let i = 0; i < envsBob.length; i++) {
    const env = envsBob[i];
    try {
      const dec = await bob.decryptEnvelope(env.encrypted_payload, env.sender_device_id, '', false);
      console.log('  Env #' + env.envelope_id + ' (Sender: ' + env.sender_id.slice(0, 8) + ') -> ' + JSON.stringify(dec.content || dec));
    } catch (e) {
      console.error('  Env #' + env.envelope_id + ' (Sender: ' + env.sender_id.slice(0, 8) + ') FAILED: ' + e.message);
    }
  }

  console.log('\n=== Fetching envelopes for Alice ===');
  const resAlice = await fetch(BASE + '/e2ee/conversations/' + CONV_ID + '/messages', {
    headers: { 'Authorization': 'Bearer ' + ALICE_TOKEN, 'X-Device-Id': 'web-alice-device' }
  });
  const envsAlice = await resAlice.json();
  console.log('Total envelopes for Alice in DB:', envsAlice.length);

  for (let i = 0; i < envsAlice.length; i++) {
    const env = envsAlice[i];
    try {
      const dec = await alice.decryptEnvelope(env.encrypted_payload, env.sender_device_id, '', false);
      console.log('  Env #' + env.envelope_id + ' (Sender: ' + env.sender_id.slice(0, 8) + ') -> ' + JSON.stringify(dec.content || dec));
    } catch (e) {
      console.error('  Env #' + env.envelope_id + ' (Sender: ' + env.sender_id.slice(0, 8) + ') FAILED: ' + e.message);
    }
  }
}

test().catch(console.error);
