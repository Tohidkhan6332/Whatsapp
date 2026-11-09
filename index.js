/**
 * Standalone WhatsApp pairing runner.
 * Original pairing workflow credit: MR TOHID / TOHID-AI.
 */
'use strict';

require('dotenv').config();
const startPairing = require('./pair');

async function main() {
  const number = process.argv[2] || process.env.PHONE_NUMBER;
  if (!number) {
    console.log('Usage: npm start -- <country-code-and-phone-number>');
    console.log('Example: npm start -- 919876543210');
    process.exitCode = 1;
    return;
  }

  await startPairing(number);
}

main().catch((error) => {
  console.error('Startup failed:', error);
  process.exitCode = 1;
});
