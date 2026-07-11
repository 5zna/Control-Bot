process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('[UNCAUGHT_EXCEPTION]', err, origin);
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
  console.error('[UNCAUGHT_EXCEPTION_MONITOR]', err, origin);
});

require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { connectDatabase } = require('./utils/database');

async function ensureYtDlp() {
  const isWin = process.platform === 'win32';
  const dest = path.join(__dirname, isWin ? 'yt-dlp.exe' : 'yt-dlp');

  async function verifyBinary() {
    if (!fs.existsSync(dest)) return false;
    if (isWin) return true;
    try {
      fs.accessSync(dest, fs.constants.X_OK);
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const { stdout } = await promisify(execFile)(dest, ['--version'], { timeout: 10000 });
      if (stdout?.trim()) { console.log('[YTDLP] Existing binary OK:', stdout.trim()); return true; }
    } catch (e) { console.log('[YTDLP] Binary check failed:', e.message); }
    return false;
  }

  if (await verifyBinary()) return;

  console.log('[YTDLP] Downloading fresh binary...');
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  const binary = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binary}`;
  const writer = fs.createWriteStream(dest);
  const axios = require('axios');
  const res = await axios({ method: 'get', url, responseType: 'stream', timeout: 60000 });
  res.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  if (!isWin) fs.chmodSync(dest, 0o755);
  console.log('[YTDLP] Done.');
}

(async () => {
  await ensureYtDlp();
  await connectDatabase();
})().catch(err => {
  console.error('[STARTUP]', err);
  process.exit(1);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.selectMenus = new Collection();

const handlersPath = path.join(__dirname, 'handlers');
const handlerFiles = fs.readdirSync(handlersPath).filter(f => f.endsWith('.js'));

for (const file of handlerFiles) {
  require(path.join(handlersPath, file))(client);
}

const RESTART_INTERVAL = 10 * 60 * 60 * 1000; // 10 hours

client.once('ready', () => {
  client.user.setPresence({ activities: [{ name: 'Rosa Server Control', type: 3 }], status: 'online' });
  console.log(`[RESTART] Scheduled restart in ${RESTART_INTERVAL / 1000 / 60 / 60}h`);
  setTimeout(() => {
    console.log('[RESTART] Exiting for restart...');
    process.exit(0);
  }, RESTART_INTERVAL);
});

client.login(process.env.DISCORD_TOKEN);
