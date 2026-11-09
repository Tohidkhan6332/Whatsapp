# Whatsapp Group Management Bot

WhatsApp group-management bot with pairing-code login, persistent sessions and admin tools.

**Original pairing workflow credit:** MR TOHID / TOHID-AI.

## Features

- Pairing code login and multi-file session persistence
- Group-only commands (default prefix: `.`)
- Admin checks for moderation and group settings
- Kick, add, promote and demote members
- Mute/unmute group, change name/description
- Group invite link and reset link
- Tag all members and hidden tag
- Anti-link protection with warning tracking
- Optional welcome messages
- No automatic group joining and no automatic newsletter following

## Requirements

- Node.js 20+
- WhatsApp account with access to Linked Devices
- Make the connected WhatsApp account a **group admin** in groups where you want to use admin commands

## Setup

```bash
npm install
npm start -- 919876543210
```

Use your country code and phone number, digits only. On your phone, open **WhatsApp → Linked devices → Link a device → Link with phone number**, then enter the pairing code shown in the terminal.

## Commands

| Command | What it does |
|---|---|
| `.menu` | Show command list |
| `.groupinfo` | Show group details |
| `.admins` | List group admins |
| `.tagall [text]` | Mention all members (admin only) |
| `.hidetag [text]` | Hidden mention all members (admin only) |
| `.kick @user` | Remove member |
| `.add 919876543210` | Add member (WhatsApp may require invite approval) |
| `.promote @user` | Make member an admin |
| `.demote @user` | Remove admin role |
| `.mute` / `.unmute` | Restrict/allow member messages |
| `.setname New name` | Change group name |
| `.setdesc New description` | Change group description |
| `.link` / `.revoke` | Get/reset group invite link |
| `.antilink on/off` | Enable/disable group invite-link moderation |
| `.welcome on/off` | Enable/disable welcome messages |
| `.warn @user` | Add a warning |
| `.warnings @user` | Check warnings |
| `.resetwarn @user` | Clear warnings |

Mention a user or reply to their message for member-targeted commands.

## Environment variables

- `PHONE_NUMBER`: optional phone number if not passed on the command line
- `SESSION_DIR`: session directory (default `./sessions`)
- `GROUP_DATA_DIR`: group settings directory (default `./data`)
- `PREFIX`: command prefix (default `.`)
- `LOG_LEVEL`: Pino log level (default `silent`)

## Security

- Keep `sessions/` private. It contains WhatsApp login credentials.
- Group commands are intended for groups you administer.
- Anti-link moderation requires the bot to be a group admin to delete messages or remove members.
- This project does not join groups or follow newsletters automatically.
