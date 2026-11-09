# Whatsapp Pairing Bot

Standalone WhatsApp pairing starter adapted from the pairing workflow in **TOHID-BUG**.

**Original project credit:** MR TOHID / TOHID-AI. The source project's attribution is retained.

## Features

- WhatsApp phone-number pairing code
- Multi-file session persistence
- Existing session restore on restart
- Latest Baileys WhatsApp Web version lookup
- No automatic group joining
- No automatic newsletter following

## Requirements

- Node.js 20+
- A WhatsApp account and phone with access to Linked Devices

## Setup

```bash
npm install
npm start -- 919876543210
```

Replace the example number with your country code and phone number, digits only.

Then on your phone open **WhatsApp → Linked devices → Link a device → Link with phone number**, and enter the code shown in the terminal.

Session credentials are stored under `sessions/<phone-number>/`. Keep this folder private. Never upload session files or share pairing codes.

## Environment

Optional:
- `PHONE_NUMBER`: phone number used when no CLI number is provided
- `SESSION_DIR`: session storage directory (default: `./sessions`)
- `LOG_LEVEL`: Pino log level (default: `silent`)

## Notes

This repository currently contains the pairing foundation only. Commands and message handlers can be added as the next step.
