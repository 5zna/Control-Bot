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
