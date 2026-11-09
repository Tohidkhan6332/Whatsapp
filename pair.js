/**
 * Pairing module adapted from TOHID-BUG's pairing workflow.
 * Original project credit: MR TOHID / TOHID-AI.
 * This standalone version intentionally excludes automatic group joining
 * and newsletter following.
 */
'use strict';

const path = require('path');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
} = require('@whiskeysockets/baileys');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

async function startPairing(phoneNumber, options = {}) {
  const phone = normalizePhone(phoneNumber);
  if (!phone || phone.length < 8 || phone.length > 15) {
    throw new Error('Enter a valid WhatsApp number with country code, digits only.');
  }

  const sessionRoot = path.resolve(options.sessionDir || process.env.SESSION_DIR || './sessions');
  const sessionPath = path.join(sessionRoot, phone);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  let version;
  try {
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
  } catch (error) {
    console.warn('Could not fetch latest WhatsApp Web version; using Baileys default.', error.message);
  }

  const socket = makeWASocket({
    logger: pino({ level: process.env.LOG_LEVEL || 'silent' }),
    printQRInTerminal: false,
    auth: state,
    ...(version ? { version } : {}),
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 30_000,
    keepAliveIntervalMs: 30_000,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  let pairingRequested = false;
  let pairingRequestInFlight = false;

  socket.ev.on('creds.update', saveCreds);

  // Group-only moderation and management commands.
  const groupManager = require('./groupManager');
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !Array.isArray(messages)) return;
    for (const message of messages) {
      try {
        await groupManager.handleGroupMessage(socket, message);
      } catch (error) {
        console.error('Group message handler error:', error.message);
      }
    }
  });

  socket.ev.on('group-participants.update', async (update) => {
    try {
      await groupManager.handleParticipantUpdate(socket, update);
    } catch (error) {
      console.error('Group welcome handler error:', error.message);
    }
  });

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !state.creds.registered && !pairingRequested && !pairingRequestInFlight) {
      pairingRequestInFlight = true;
      try {
        await sleep(800);
        const rawCode = await socket.requestPairingCode(phone);
        const formatted = rawCode.match(/.{1,4}/g)?.join('-') || rawCode;
        pairingRequested = true;
        console.log('\n========================================');
        console.log(' WhatsApp Pairing Code:', formatted);
        console.log(' Open WhatsApp > Linked devices > Link with phone number');
        console.log('========================================\n');
      } catch (error) {
        console.error('Pairing code request failed:', error.message);
      } finally {
        pairingRequestInFlight = false;
      }
    }

    if (connection === 'open') {
      console.log('WhatsApp connected successfully.');
      console.log('Session saved in:', sessionPath);
    } else if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.error('WhatsApp session logged out. Remove this number session folder and pair again.');
      } else {
        console.error('WhatsApp connection closed. Restart the app to reconnect.');
      }
    }
  });

  return socket;
}

module.exports = startPairing;
module.exports.normalizePhone = normalizePhone;
