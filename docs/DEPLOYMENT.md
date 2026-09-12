# Deployment and Setup Guide

VaultCloud runs as a Node.js application or within Docker. It supports testing without Telegram credentials via `DEMO_MODE=true`.

## Prerequisites

- Node.js version 20 or higher (version 22+ recommended)
- npm version 10 or higher
- Optional: Docker and Docker Compose
- Optional for live mode: A Telegram bot token from `@BotFather` and a private Telegram channel

## Quick Start (Demo Mode)

Demo mode uses an in-memory storage adapter and pre-seeds a sample encrypted vault. You can test the application without creating a Telegram bot.

1. Clone the repository:
   ```bash
   git clone https://github.com/alexandrmotologa/vaultcloud-tma.git
   cd vaultcloud-tma
   ```

2. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the web client and start the server:
   ```bash
   npm run build
   npm start
   ```

5. Open `http://localhost:8080` in your web browser.
6. Enter `DemoPassword123!` to unlock the pre-seeded vault.

---

## Live Telegram Bot Setup

To store files directly in Telegram:

1. Create a Telegram Bot:
   - Open Telegram and message `@BotFather`.
   - Send `/newbot`, name your bot, and save the generated API token.
   - Send `/newapp` to set up your Telegram Mini App. Set the WebApp URL to your public domain (e.g. `https://vault.yourdomain.com`).

2. Create a Private Storage Channel:
   - Create a private channel in Telegram (e.g. "VaultCloud Storage").
   - Add your bot to the channel as an Administrator with permission to post messages.
   - Forward a message from the channel to `@userinfobot` or run `curl https://api.telegram.org/bot<TOKEN>/getUpdates` to get the channel chat ID (typically starts with `-100`).

3. Configure `.env`:
   ```ini
   PORT=8080
   HOST=0.0.0.0
   DEMO_MODE=false
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
   TELEGRAM_STORAGE_CHAT_ID=-1001234567890
   DATABASE_PATH=./data/vaultcloud.db
   APP_URL=https://vault.yourdomain.com
   ```

4. Run the application:
   ```bash
   npm start
   ```

The bot starts long polling automatically. Users can open the Mini App by sending `/start` or `/drive` to your bot.

---

## Running with Docker

1. Build and run using Docker Compose:
   ```bash
   docker compose up -d --build
   ```

2. Inspect container logs:
   ```bash
   docker compose logs -f
   ```

3. Stop the container:
   ```bash
   docker compose down
   ```
