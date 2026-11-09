/**
 * Group management commands for the Whatsapp project.
 * Original pairing workflow credit: MR TOHID / TOHID-AI.
 *
 * Commands are restricted to groups. Destructive/admin actions require
 * the command sender to be a group admin and the bot to be a group admin.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.env.GROUP_DATA_DIR || './data');
const SETTINGS_FILE = path.join(DATA_DIR, 'groups.json');
const PREFIX = process.env.PREFIX || '.';

function readStore() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (error) {
    console.error('Could not read group settings:', error.message);
    return {};
  }
}

function writeStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(store, null, 2));
}

function getSettings(groupId) {
  const store = readStore();
  return store[groupId] || { antilink: false, welcome: false, warnings: {} };
}

function updateSettings(groupId, patch) {
  const store = readStore();
  store[groupId] = { antilink: false, welcome: false, warnings: {}, ...(store[groupId] || {}), ...patch };
  writeStore(store);
  return store[groupId];
}

function getText(message) {
  const m = message.message || {};
  return m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    '';
}

function getContext(message) {
  const m = message.message || {};
  return m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo ||
    m.documentMessage?.contextInfo || {};
}

function jidNumber(jid = '') {
  return String(jid).split('@')[0].split(':')[0];
}

function isAdmin(metadata, jid) {
  return metadata.participants.some((p) =>
    p.id === jid && (p.admin === 'admin' || p.admin === 'superadmin')
  );
}

function targetFromMessage(message, args, metadata) {
  const context = getContext(message);
  const candidates = [...(context.mentionedJid || [])];
  if (context.participant) candidates.push(context.participant);
  if (!candidates.length && args[0]) {
    const digits = args[0].replace(/\D/g, '');
    if (digits.length >= 8) {
      const found = metadata.participants.find((p) => jidNumber(p.id) === digits);
      if (found) candidates.push(found.id);
    }
  }
  return [...new Set(candidates)];
}

async function sendText(sock, jid, text, quoted) {
  return sock.sendMessage(jid, { text }, quoted ? { quoted } : {});
}

async function handleGroupMessage(sock, message) {
  const jid = message.key?.remoteJid;
  if (!jid || !jid.endsWith('@g.us') || message.key?.fromMe) return;

  const text = getText(message).trim();
  if (!text) return;

  const sender = message.key.participant || message.participant || '';
  const metadata = await sock.groupMetadata(jid);
  const senderIsAdmin = isAdmin(metadata, sender);
  const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
  const botIsAdmin = isAdmin(metadata, botJid);
  const settings = getSettings(jid);

  // Anti-link moderation works even when the message is not a command.
  if (settings.antilink && /https?:\/\/chat\.whatsapp\.com\//i.test(text) && !senderIsAdmin) {
    if (botIsAdmin) {
      try { await sock.sendMessage(jid, { delete: message.key }); } catch (_) {}
    }
    const warnings = { ...(settings.warnings || {}) };
    warnings[sender] = (warnings[sender] || 0) + 1;
    updateSettings(jid, { warnings });
    await sendText(sock, jid, `⚠️ @${jidNumber(sender)} group link share karna allowed nahi hai. Warning: ${warnings[sender]}/3`, message);
    if (warnings[sender] >= 3 && botIsAdmin) {
      try {
        await sock.groupParticipantsUpdate(jid, [sender], 'remove');
        delete warnings[sender];
        updateSettings(jid, { warnings });
      } catch (error) {
        await sendText(sock, jid, '3 warnings ho gayi, lekin bot member ko remove nahi kar saka.', message);
      }
    }
    return;
  }

  if (!text.startsWith(PREFIX)) return;
  const [rawCommand, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = (rawCommand || '').toLowerCase();
  if (!command) return;

  const reply = (value) => sendText(sock, jid, value, message);
  const requireAdmin = async () => {
    if (!senderIsAdmin) {
      await reply('❌ Ye command sirf group admins use kar sakte hain.');
      return false;
    }
    if (!botIsAdmin) {
      await reply('❌ Pehle bot ko group admin banao.');
      return false;
    }
    return true;
  };

  try {
    switch (command) {
      case 'menu':
      case 'help':
        return reply(
          '╭─── GROUP MANAGEMENT ───\n' +
          '│ .groupinfo — Group details\n' +
          '│ .admins — Admin list\n' +
          '│ .tagall [message] — Tag all members\n' +
          '│ .hidetag [message] — Hidden tag all\n' +
          '│ .kick @user — Remove member\n' +
          '│ .add 91xxxxxxxxxx — Add member\n' +
          '│ .promote @user — Make admin\n' +
          '│ .demote @user — Remove admin\n' +
          '│ .mute / .unmute — Close/open group chat\n' +
          '│ .setname text — Change group name\n' +
          '│ .setdesc text — Change group description\n' +
          '│ .link / .revoke — Invite link / reset link\n' +
          '│ .antilink on/off — Link protection\n' +
          '│ .welcome on/off — Welcome messages\n' +
          '│ .warn @user — Add warning\n' +
          '│ .warnings @user — Check warnings\n' +
          '│ .resetwarn @user — Clear warnings\n' +
          '╰───────────────────────\n' +
          'Prefix: ' + PREFIX
        );

      case 'groupinfo':
        return reply(
          `📌 ${metadata.subject}\nID: ${jid}\nMembers: ${metadata.participants.length}\nOwner: ${metadata.owner || 'Unknown'}\nDescription: ${metadata.desc || 'None'}\nAnti-link: ${settings.antilink ? 'ON' : 'OFF'}\nWelcome: ${settings.welcome ? 'ON' : 'OFF'}`
        );

      case 'admins': {
        const admins = metadata.participants.filter((p) => p.admin);
        return sock.sendMessage(jid, {
          text: '👑 Group admins:\n' + admins.map((p) => '• @' + jidNumber(p.id)).join('\n'),
          mentions: admins.map((p) => p.id),
        }, { quoted: message });
      }

      case 'tagall':
      case 'hidetag': {
        if (!senderIsAdmin) return reply('❌ Sirf group admins tag command use kar sakte hain.');
        const members = metadata.participants.map((p) => p.id);
        const body = args.join(' ') || 'Attention everyone!';
        const mentions = command === 'tagall' ? members : [];
        const textBody = command === 'tagall'
          ? '📢 ' + body + '\n\n' + members.map((p) => '• @' + jidNumber(p)).join('\n')
          : '📢 ' + body;
        return sock.sendMessage(jid, { text: textBody, mentions: command === 'tagall' ? mentions : members }, { quoted: message });
      }

      case 'kick':
      case 'remove':
      case 'promote':
      case 'demote': {
        if (!(await requireAdmin())) return;
        const targets = targetFromMessage(message, args, metadata);
        if (!targets.length) return reply('❗ User ko @mention karo ya uske message par reply karke command bhejo.');
        if (targets.includes(botJid)) return reply('Bot ko khud remove/demote nahi kar sakte.');
        const action = command === 'kick' || command === 'remove' ? 'remove' : command;
        await sock.groupParticipantsUpdate(jid, targets, action);
        return reply(`✅ ${action} action complete: ${targets.map(jidNumber).join(', ')}`);
      }

      case 'add': {
        if (!(await requireAdmin())) return;
        const numbers = args.map((x) => x.replace(/\D/g, '')).filter((x) => x.length >= 8 && x.length <= 15);
        if (!numbers.length) return reply('Usage: .add 919876543210');
        const result = await sock.groupParticipantsUpdate(jid, numbers.map((n) => n + '@s.whatsapp.net'), 'add');
        return reply('Add request processed. WhatsApp may require invite approval for some users.\n' + JSON.stringify(result));
      }

      case 'mute':
      case 'unmute':
        if (!(await requireAdmin())) return;
        await sock.groupSettingUpdate(jid, command === 'mute' ? 'announcement' : 'not_announcement');
        return reply(command === 'mute' ? '🔒 Group muted. Only admins can send messages.' : '🔓 Group unmuted. All members can send messages.');

      case 'setname':
        if (!(await requireAdmin())) return;
        if (!args.length) return reply('Usage: .setname New Group Name');
        await sock.groupUpdateSubject(jid, args.join(' '));
        return reply('✅ Group name updated.');

      case 'setdesc':
        if (!(await requireAdmin())) return;
        if (!args.length) return reply('Usage: .setdesc New description');
        await sock.groupUpdateDescription(jid, args.join(' '));
        return reply('✅ Group description updated.');

      case 'link': {
        if (!(await requireAdmin())) return;
        const code = await sock.groupInviteCode(jid);
        return reply('🔗 Group invite link:\nhttps://chat.whatsapp.com/' + code);
      }

      case 'revoke':
        if (!(await requireAdmin())) return;
        await sock.groupRevokeInvite(jid);
        return reply('✅ Group invite link reset.');
      
      case 'antilink': {
        if (!(await requireAdmin())) return;
        const value = (args[0] || '').toLowerCase();
        if (!['on', 'off'].includes(value)) return reply('Usage: .antilink on/off');
        updateSettings(jid, { antilink: value === 'on' });
        return reply('🛡️ Anti-link ' + value.toUpperCase());
      }

      case 'welcome': {
        if (!(await requireAdmin())) return;
        const value = (args[0] || '').toLowerCase();
        if (!['on', 'off'].includes(value)) return reply('Usage: .welcome on/off');
        updateSettings(jid, { welcome: value === 'on' });
        return reply('👋 Welcome messages ' + value.toUpperCase());
      }

      case 'warn':
      case 'warnings':
      case 'resetwarn': {
        if (!(await requireAdmin())) return;
        const targets = targetFromMessage(message, args, metadata);
        if (!targets.length) return reply('User ko mention karo ya uske message par reply karo.');
        const warnings = { ...(settings.warnings || {}) };
        const target = targets[0];
        if (command === 'warn') warnings[target] = (warnings[target] || 0) + 1;
        if (command === 'resetwarn') delete warnings[target];
        updateSettings(jid, { warnings });
        if (command === 'warnings') return reply(`⚠️ @${jidNumber(target)} ke warnings: ${warnings[target] || 0}`);
        if (command === 'resetwarn') return reply('✅ Warnings reset kar di gayi.');
        return reply(`⚠️ @${jidNumber(target)} warning ${warnings[target]}/3`);
      }
      default:
        return;
    }
  } catch (error) {
    console.error('Group command error:', command, error);
    return reply('❌ Command failed: ' + (error.message || 'Unknown error'));
  }
}

async function handleParticipantUpdate(sock, update) {
  if (!update.id || !Array.isArray(update.participants)) return;
  const settings = getSettings(update.id);
  if (!settings.welcome || update.action !== 'add') return;
  const metadata = await sock.groupMetadata(update.id).catch(() => null);
  const groupName = metadata?.subject || 'this group';
  for (const participant of update.participants) {
    await sock.sendMessage(update.id, {
      text: `👋 Welcome @${jidNumber(participant)} to *${groupName}*!\nPlease read the group rules and enjoy.`,
      mentions: [participant],
    });
  }
}

module.exports = { handleGroupMessage, handleParticipantUpdate, PREFIX };
