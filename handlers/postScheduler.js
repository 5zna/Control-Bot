const { EmbedBuilder, WebhookClient, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { getConfig, getServers, getUI } = require('../utils/storage');

const CYCLE_INTERVAL = 30 * 60 * 1000;
const POST_GAP = 5 * 60 * 1000;

const SECTION_CHANNEL_KEY = {
  servers: 'serversChannelId',
  avatar: 'avtChannelId',
  other: 'otherChannelId',
};

async function ensureWebhooks(client) {
  const config = getConfig();
  const webhooks = config.webhooks || {};
  const sections = ['servers', 'avatar', 'other'];

  for (const section of sections) {
    const key = SECTION_CHANNEL_KEY[section] || `${section}ChannelId`;
    const channelId = config[key];
    if (!channelId) continue;
    if (webhooks[section]) continue;

    const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
    if (!channel) continue;

    try {
      const axios = require('axios');
      const avatarUrl = client.user.displayAvatarURL({ size: 1024, extension: 'png' });
      const res = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
      const avatarBase64 = `data:image/png;base64,${Buffer.from(res.data).toString('base64')}`;
      const webhook = await channel.createWebhook({
        name: client.user.displayName,
        avatar: avatarBase64,
      });
      webhooks[section] = webhook.url;
    } catch (err) {
      console.error(`[WEBHOOK_CREATE] ${section}:`, err.message);
    }
  }

  config.webhooks = webhooks;
  fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(config, null, 2), 'utf8');
}

async function getValidWebhook(client, server, config) {
  const url = config.webhooks?.[server.type];
  if (!url) return null;
  try {
    const wh = new WebhookClient({ url });
    await wh.fetch();
    return url;
  } catch {
    delete config.webhooks[server.type];
    fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(config, null, 2), 'utf8');
    return null;
  }
}

async function postServer(client, server) {
  const config = getConfig();
  let webhookUrl = await getValidWebhook(client, server, config);

  if (!webhookUrl) {
    const key = SECTION_CHANNEL_KEY[server.type] || `${server.type}ChannelId`;
    const channelId = config[key];
    if (!channelId) return false;

    const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return false;

    try {
      const ax = require('axios');
      const avatarUrl = client.user.displayAvatarURL({ size: 1024, extension: 'png' });
      const img = await ax.get(avatarUrl, { responseType: 'arraybuffer' });
      const avatarBase64 = `data:image/png;base64,${Buffer.from(img.data).toString('base64')}`;
      const webhook = await channel.createWebhook({
        name: client.user.displayName,
        avatar: avatarBase64,
      });
      webhookUrl = webhook.url;
      config.webhooks = config.webhooks || {};
      config.webhooks[server.type] = webhookUrl;
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(config, null, 2), 'utf8');
    } catch {
      return false;
    }
  }

  const ui = getUI();
  const bannerFile = new AttachmentBuilder(server.bannerLink, { name: 'banner.png' });
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(`By <@${server.userId}>`);

  const joinBtn = new ButtonBuilder()
    .setLabel(ui.buttons.joinServer)
    .setStyle(ButtonStyle.Link)
    .setURL(server.inviteLink);

  const manageBtn = new ButtonBuilder()
    .setCustomId(`manage_${server.id}`)
    .setLabel(ui.buttons.manage)
    .setStyle(ButtonStyle.Secondary);

  try {
    const wh = new WebhookClient({ url: webhookUrl });
    const msg = await wh.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(joinBtn, manageBtn)],
      files: [bannerFile],
    });
    // Update messageId/channelId in servers.json
    const servers = getServers();
    const srv = servers.find(s => s.id === server.id);
    if (srv) {
      srv.messageId = msg.id;
      srv.channelId = msg.channelId;
      const { saveServers } = require('../utils/storage');
      saveServers(servers);
    }
    return true;
  } catch (err) {
    console.error('[POST_SCHEDULER]', err.message);
    return false;
  }
}

module.exports = (client) => {
  client.once('clientReady', async () => {
    await ensureWebhooks(client);

    let posting = false;

    const runCycle = async () => {
      if (posting) return;
      posting = true;

      const servers = getServers().filter(s => s.posted);
      for (const server of servers) {
        await postServer(client, server);
        if (servers.indexOf(server) < servers.length - 1) {
          await new Promise(r => setTimeout(r, POST_GAP));
        }
      }

      posting = false;
    };

    setInterval(runCycle, CYCLE_INTERVAL);
  });
};
