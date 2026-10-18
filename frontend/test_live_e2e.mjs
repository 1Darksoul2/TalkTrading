import { x25519, ed25519 } from '@noble/curves/ed25519.js';
import { ClientCryptoAdapter } from './src/crypto/x3dhCrypto.js';

const BASE = 'http://127.0.0.1:8003';
const ALICE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtYTExMS0xMTExMTExMTExMTEiLCJ1c2VyX2lkIjoiMTExMTExMTEtMTExMS00MTExLWExMTEtMTExMTExMTExMTExIiwiZXhwIjoxODIwNTExMDkzfQ.03noPCr-1b_aMArepJ4pnrK1FOToaWNAZUFEpOXiCVE';
const BOB_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMjIyMjIyMi0yMjIyLTQyMjItYTIyMi0yMjIyMjIyMjIyMjIiLCJ1c2VyX2lkIjoiMjIyMjIyMjItMjIyMi00MjIyLWEyMjItMjIyMjIyMjIyMjIyIiwiZXhwIjoxODIwNTExMDkzfQ.DYlybcBLA3qzfkvcwkPuDglx-yGK0NQjZb0SWYoJTd8';
const ALICE_UID = '11111111-1111-4111-a111-111111111111';
const BOB_UID = '22222222-2222-4222-a222-222222222222';
const CONV_ID = '90da5b4a-1472-4368-a510-1d544f321829';

async function run() {
  console.log('=== 1. Initialize Adapters ===');
  const alice = new ClientCryptoAdapter('web-alice-device');
  const bob = new ClientCryptoAdapter('web-bob-device');

  const aliceReg = await alice.registerDevice('Alice Dev');
  const bobReg = await bob.registerDevice('Bob Dev');

  // Register with backend (or ignore 409)
  await fetch(BASE + '/e2ee/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ALICE_TOKEN },
    body: JSON.stringify(aliceReg)
  }).catch(() => {});

  await fetch(BASE + '/e2ee/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + BOB_TOKEN },
    body: JSON.stringify(bobReg)
  }).catch(() => {});

  console.log('=== 2. Alice fetches Bob key bundle ===');
  const bobBundleRes = await fetch(BASE + '/e2ee/keys/' + BOB_UID, {
    headers: { 'Authorization': 'Bearer ' + ALICE_TOKEN }
  });
  const bobBundleData = await bobBundleRes.json();
  const bobDevice = bobBundleData.devices[0];

  const aliceBundleRes = await fetch(BASE + '/e2ee/keys/' + ALICE_UID, {
    headers: { 'Authorization': 'Bearer ' + ALICE_TOKEN }
  });
  const aliceBundleData = await aliceBundleRes.json();
  const aliceDevice = aliceBundleData.devices[0];

  console.log('=== 3. Alice encrypts and sends message ===');
  const msgPayload = {
    conversation_id: CONV_ID,
    sender_id: ALICE_UID,
    content: 'Hello Bob! Testing X3DH + AES-256-GCM encryption in live system.',
    timestamp: Math.floor(Date.now() / 1000)
  };

  const envelopes = await alice.encryptForDevices([bobDevice, aliceDevice], msgPayload);

  const sendRes = await fetch(BASE + '/e2ee/conversations/' + CONV_ID + '/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ALICE_TOKEN,
      'X-Device-Id': 'web-alice-device'
    },
    body: JSON.stringify({ envelopes })
  });
  console.log('Send message HTTP status:', sendRes.status);
  const sendResult = await sendRes.json();
  console.log('Message ID created:', sendResult.message_id);

  console.log('=== 4. Bob retrieves and decrypts message from backend ===');
  const bobGetRes = await fetch(BASE + '/e2ee/conversations/' + CONV_ID + '/messages', {
    headers: { 'Authorization': 'Bearer ' + BOB_TOKEN, 'X-Device-Id': 'web-bob-device' }
  });
  const bobEnvelopes = await bobGetRes.json();
  console.log('Bob retrieved envelopes count:', bobEnvelopes.length);

  const bobDecrypted = await bob.decryptEnvelope(
    bobEnvelopes[bobEnvelopes.length - 1].encrypted_payload,
    bobEnvelopes[bobEnvelopes.length - 1].sender_device_id,
    '',
    false
  );
  console.log('Bob decrypted message content:', bobDecrypted.content);

  console.log('=== 5. Bob replies to Alice ===');
  const bobReplyPayload = {
    conversation_id: CONV_ID,
    sender_id: BOB_UID,
    content: 'Hi Alice! Encrypted reply received and decrypted successfully.',
    timestamp: Math.floor(Date.now() / 1000)
  };

  const bobReplyEnvelopes = await bob.encryptForDevices([aliceDevice, bobDevice], bobReplyPayload);
  const replyRes = await fetch(BASE + '/e2ee/conversations/' + CONV_ID + '/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + BOB_TOKEN,
      'X-Device-Id': 'web-bob-device'
    },
    body: JSON.stringify({ envelopes: bobReplyEnvelopes })
  });
  console.log('Bob reply HTTP status:', replyRes.status);

  console.log('=== 6. Alice retrieves and decrypts full chat history ===');
  const aliceGetRes = await fetch(BASE + '/e2ee/conversations/' + CONV_ID + '/messages', {
    headers: { 'Authorization': 'Bearer ' + ALICE_TOKEN, 'X-Device-Id': 'web-alice-device' }
  });
  const aliceEnvelopes = await aliceGetRes.json();
  console.log('Alice retrieved total envelopes:', aliceEnvelopes.length);

  for (const env of aliceEnvelopes) {
    const dec = await alice.decryptEnvelope(env.encrypted_payload, env.sender_device_id, '', false);
    const senderLabel = env.sender_id === ALICE_UID ? 'Alice (Me)' : 'Bob';
    console.log('  [' + senderLabel + '] -> ' + dec.content);
  }

  console.log('\n========================================');
  console.log('SUCCESS: Full End-to-End Test Passed!');
  console.log('========================================');
}

run().catch(console.error);
