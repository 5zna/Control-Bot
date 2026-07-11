const { EmbedBuilder, WebhookClient, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { getConfig, getServers, saveServers, getPending, removePending, getUI } = require('../utils/storage');

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

async function postServer(client, server) {
  const config = getConfig();
  let webhookUrl = config.webhooks?.[server.type];

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
    const servers = await getServers();
    const srv = servers.find(s => s.id === server.id);
    if (srv) {
      srv.messageId = msg.id;
      srv.channelId = msg.channelId;
      await saveServers(servers);
    }
    return true;
  } catch (err) {
    console.error('[POST_SCHEDULER]', err.message);
    return false;
  }
}

module.exports = (client) => {
  client.on('guildMemberRemove', async (member) => {
    try {
      const allSrv = await getServers();
      const servers = allSrv.filter(s => s.posted && s.userId === member.id);
      const allPend = await getPending();
      const pending = allPend.filter(e => e.userId === member.id);
      if (servers.length === 0 && pending.length === 0) return;
      const ids = servers.map(s => s.id);
      for (const e of pending) await removePending(e.id);
      for (const srv of servers) {
        if (srv.channelId && srv.messageId) {
          try {
            const ch = await client.channels.fetch(srv.channelId);
            if (ch) {
              const msg = await ch.messages.fetch(srv.messageId).catch(() => null);
              if (msg) await msg.delete();
            }
          } catch {}
        }
      }
      const all = await getServers();
      await saveServers(all.filter(s => !ids.includes(s.id)));
    } catch (err) {
      console.error('[GUILD_MEMBER_REMOVE]', err);
    }
  });

  client.once('clientReady', async () => {
    try {
      await ensureWebhooks(client);
    } catch (err) {
      console.error('[ENSURE_WEBHOOKS]', err);
    }

    let posting = false;

    const runCycle = async () => {
      if (posting) return;
      posting = true;
      try {
        const guild = client.guilds.cache.first();
        const config = getConfig();

        let servers = (await getServers()).filter(s => s.posted);
        const toRemove = [];

        for (const server of servers) {
          if (guild) {
            try {
              await guild.members.fetch(server.userId);
            } catch {
              toRemove.push(server.id);
              if (server.channelId && server.messageId) {
                try {
                  const ch = await client.channels.fetch(server.channelId);
                  if (ch) {
                    const msg = await ch.messages.fetch(server.messageId).catch(() => null);
                    if (msg) await msg.delete();
                  }
                } catch {}
              }
            }
          }
        }

        if (toRemove.length > 0) {
          const all = await getServers();
          await saveServers(all.filter(s => !toRemove.includes(s.id)));
          servers = servers.filter(s => !toRemove.includes(s.id));
        }

        for (const server of servers) {
          await postServer(client, server);
          if (servers.indexOf(server) < servers.length - 1) {
            await new Promise(r => setTimeout(r, POST_GAP));
          }
        }
      } catch (err) {
        console.error('[RUN_CYCLE]', err);
      }
      posting = false;
    };

    setInterval(runCycle, CYCLE_INTERVAL);
  });
};
