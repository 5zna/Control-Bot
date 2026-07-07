const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  AttachmentBuilder, WebhookClient, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { getConfig, addPending, removePending, addServer, getPending, getServers, savePending, saveServers, getUI } = require('../utils/storage');

const SECTION_CHANNEL_KEY = {
  servers: 'serversChannelId',
  avatar: 'avtChannelId',
  other: 'otherChannelId',
};

async function validateWebhook(client, section) {
  const config = getConfig();
  const url = config.webhooks?.[section];
  if (!url) return null;
  try {
    const wh = new WebhookClient({ url });
    await wh.fetch();
    return url;
  } catch {
    delete config.webhooks[section];
    fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(config, null, 2), 'utf8');
    return null;
  }
}

async function getOrCreateWebhook(client, section) {
  const config = getConfig();
  const valid = await validateWebhook(client, section);
  if (valid) return valid;

  const channelKey = SECTION_CHANNEL_KEY[section] || `${section}ChannelId`;
  const channelId = config[channelKey];
  if (!channelId) return null;

  const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return null;

  try {
    const axios = require('axios');
    const avatarUrl = client.user.displayAvatarURL({ size: 1024, extension: 'png' });
    const res = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
    const avatarBase64 = `data:image/png;base64,${Buffer.from(res.data).toString('base64')}`;
    const webhook = await channel.createWebhook({
      name: client.user.displayName,
      avatar: avatarBase64,
    });
    config.webhooks = config.webhooks || {};
    config.webhooks[section] = webhook.url;
    fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(config, null, 2), 'utf8');
    return webhook.url;
  } catch (err) {
    console.error(`[WEBHOOK_CREATE] ${section}:`, err.message);
    return null;
  }
}

function buildServerActions(entry, ui) {
  const joinBtn = new ButtonBuilder()
    .setLabel(ui.buttons.joinServer)
    .setStyle(ButtonStyle.Link)
    .setURL(entry.inviteLink);

  const manageBtn = new ButtonBuilder()
    .setCustomId(`manage_${entry.id}`)
    .setLabel(ui.buttons.manage)
    .setStyle(ButtonStyle.Secondary);

  return [new ActionRowBuilder().addComponents(joinBtn, manageBtn)];
}

function buildServerPayload(entry, ui) {
  const bannerFile = new AttachmentBuilder(entry.bannerLink, { name: 'banner.png' });
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(`By <@${entry.userId}>`);

  return { embeds: [embed], components: buildServerActions(entry, ui), files: [bannerFile] };
}

function isManager(interaction, config) {
  const isOwner = interaction.user.id === interaction.guild.ownerId;
  const isManagerUser = (config.managerIds || []).includes(interaction.user.id);
  return isOwner || isManagerUser;
}

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    // Modal submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('publish_modal_')) {
      const type = interaction.customId.replace('publish_modal_', '');
      const ui = getUI();
      const config = getConfig();

      if (!config.pendingChannelId) {
        await interaction.reply({ content: ui.messages.publish.noPendingChannel, flags: MessageFlags.Ephemeral });
        return;
      }

      const pendingChannel = client.channels.cache.get(config.pendingChannelId)
        || await client.channels.fetch(config.pendingChannelId).catch(() => null);
      if (!pendingChannel) {
        await interaction.reply({ content: ui.messages.publish.noAccessChannel, flags: MessageFlags.Ephemeral });
        return;
      }

      const inviteLink = interaction.fields.getTextInputValue('invite_link').trim();

      // منع التكرار
      let guildId = null;
      try {
        const invite = await client.fetchInvite(inviteLink);
        guildId = invite?.guild?.id;
      } catch {}
      const allPending = getPending();
      const allServers = getServers();

      // شيك بالـ guildId للسيرفرات القديمة اللي معندهاش guildId
      if (guildId) {
        const oldPending = allPending.find(e => !e.guildId);
        const oldServer = allServers.find(s => !s.guildId);
        if (oldPending || oldServer) {
          // حاول تجيب الـ guildId للسيرفرات القديمة
          for (const e of allPending) {
            if (!e.guildId) {
              try { const inv = await client.fetchInvite(e.inviteLink); if (inv?.guild?.id === guildId) { e.guildId = guildId; savePending(allPending); } } catch {}
            }
          }
          for (const s of allServers) {
            if (!s.guildId) {
              try { const inv = await client.fetchInvite(s.inviteLink); if (inv?.guild?.id === guildId) { s.guildId = guildId; saveServers(allServers); } } catch {}
            }
          }
        }
      }

      const dup = guildId
        ? (allPending.find(e => e.guildId === guildId) || allServers.find(s => s.guildId === guildId))
        : (allPending.find(e => e.inviteLink === inviteLink) || allServers.find(s => s.inviteLink === inviteLink));
      if (dup) {
        await interaction.reply({ content: '❌ هذا السيرفر تم نشره أو تقديمه من قبل.', flags: MessageFlags.Ephemeral });
        return;
      }

      const entry = {
        id: crypto.randomUUID(),
        type,
        guildId,
        inviteLink,
        bannerLink: interaction.fields.getTextInputValue('banner_link'),
        userId: interaction.user.id,
        timestamp: new Date().toISOString(),
      };

      addPending(entry);

      const sectionLabel = (ui.publishSections[type]?.label) || type;
      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(`📢 طلب نشر ${sectionLabel}`)
        .setDescription(`**رابط السيرفر:** ${entry.inviteLink}`)
        .addFields(
          { name: 'مقدم الطلب', value: `<@${entry.userId}>`, inline: true },
          { name: 'القسم', value: sectionLabel, inline: true },
        )
        .setFooter({ text: `ID: ${entry.id}` })
        .setTimestamp();

      if (entry.bannerLink) embed.setImage(entry.bannerLink);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`publish_approve_${entry.id}`).setLabel(ui.buttons.approve.label).setStyle(ButtonStyle.Success).setEmoji(ui.buttons.approve.emoji),
        new ButtonBuilder().setCustomId(`publish_reject_${entry.id}`).setLabel(ui.buttons.reject.label).setStyle(ButtonStyle.Danger).setEmoji(ui.buttons.reject.emoji),
      );

      await pendingChannel.send({ embeds: [embed], components: [row] });
      const warningMsg = '⚠️ تنبيه: في حال خروجك من السيرفر، سيتم إلغاء نشر سيرفرك وحذفه تلقائياً.';
      await interaction.reply({ content: `${ui.messages.publish.submitted}\n${warningMsg}`, flags: MessageFlags.Ephemeral });
      await interaction.user.send({ embeds: [new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('⚠️ تنبيه هام بخصوص نشر سيرفرك')
        .setDescription(`تم استلام طلب نشر سيرفرك بنجاح.\n${warningMsg}`)
        .setFooter({ text: 'Rosa Server Control' })
      ] }).catch(() => {});
      return;
    }

    // Button clicks
    if (interaction.isButton() && interaction.customId.startsWith('publish_')) {
      const parts = interaction.customId.split('_');
      const action = parts[1];
      const entryId = parts.slice(2).join('_');
      const ui = getUI();
      const config = getConfig();
      const isOwner = interaction.user.id === interaction.guild.ownerId;
      const isManager = (config.managerIds || []).includes(interaction.user.id);

      if (!isOwner && !isManager) {
        await interaction.reply({ content: ui.messages.errors.noPermission, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferUpdate();

      const pending = getPending();
      const entry = pending.find(e => e.id === entryId);
      if (!entry) {
        await interaction.editReply({ content: ui.messages.publish.noLongerExists, components: [] });
        return;
      }

      if (action === 'approve') {
        const channelId = config[SECTION_CHANNEL_KEY[entry.type]];
        if (!channelId) {
          await interaction.editReply({ components: [], embeds: [], content: ui.messages.publish.noChannelConfig });
          return;
        }

        // التحقق من وجود العضو في السيرفر
        const member = await interaction.guild.members.fetch(entry.userId).catch(() => null);
        if (!member) {
          const ui2 = getUI();
          removePending(entryId);
          await interaction.editReply({ components: [], embeds: [], content: '❌ صاحب السيرفر ليس في الخادم، تم إلغاء النشر.' });
          return;
        }

        removePending(entryId);
        addServer({ ...entry, posted: true, postedAt: new Date().toISOString() });

        let payload;
        try {
          payload = buildServerPayload(entry, ui);
        } catch (err) {
          console.error('[BUILD_PAYLOAD]', err.message);
          await interaction.editReply({ components: [], embeds: [], content: `❌ فشل تجهيز البانر: ${err.message}` });
          return;
        }

        const webhookUrl = await getOrCreateWebhook(client, entry.type);
        let posted = false;
        let msg = null;

        if (webhookUrl) {
          try {
            const wh = new WebhookClient({ url: webhookUrl });
            msg = await wh.send(payload);
            posted = true;
          } catch (err) { console.error('[WEBHOOK_SEND]', err.message); }
        }

        if (!posted) {
          try {
            const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
            if (channel) { msg = await channel.send(payload); posted = true; }
          } catch (err) { console.error('[CHANNEL_SEND]', err.message); }
        }

        if (msg) {
          const servers = getServers();
          const srv = servers.find(s => s.id === entry.id);
          if (srv) { srv.messageId = msg.id; srv.channelId = msg.channelId || channelId; saveServers(servers); }
        }

        await interaction.editReply({ components: [], embeds: [], content: posted ? ui.messages.publish.approved : ui.messages.publish.approvedFail });

        const sectionLabel = (ui.publishSections[entry.type]?.label) || entry.type;
        const user = await client.users.fetch(entry.userId).catch(() => null);
        if (user) {
          await user.send({
            embeds: [new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle(ui.embeds.publish.approveTitle)
              .setDescription(`${ui.embeds.publish.approveDesc}${sectionLabel}.`)
              .setFooter({ text: ui.embeds.footer })],
          }).catch(() => {});
        }
      } else if (action === 'reject') {
        removePending(entryId);
        await interaction.editReply({ components: [], embeds: [], content: ui.messages.publish.rejected });

        const user = await client.users.fetch(entry.userId).catch(() => null);
        if (user) {
          await user.send({
            embeds: [new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle(ui.embeds.publish.rejectTitle)
              .setDescription(ui.embeds.publish.rejectDesc)
              .setFooter({ text: ui.embeds.footer })],
          }).catch(() => {});
        }
      }
    }

    // Manage button → show edit/delete options
    if (interaction.isButton() && interaction.customId.startsWith('manage_')) {
      const serverId = interaction.customId.replace('manage_', '');
      const ui = getUI();
      const config = getConfig();
      if (!isManager(interaction, config)) {
        await interaction.reply({ content: ui.messages.errors.noPermission, flags: MessageFlags.Ephemeral });
        return;
      }

      const servers = getServers();
      const server = servers.find(s => s.id === serverId);
      if (!server) {
        await interaction.reply({ content: ui.messages.publish.notFound, flags: MessageFlags.Ephemeral });
        return;
      }

      const editBtn = new ButtonBuilder()
        .setCustomId(`edit_${serverId}`)
        .setLabel(ui.buttons.edit.label)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(ui.buttons.edit.emoji);

      const alertBtn = new ButtonBuilder()
        .setCustomId(`alert_${serverId}`)
        .setLabel(ui.buttons.alert.label)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(ui.buttons.alert.emoji);

      const deleteBtn = new ButtonBuilder()
        .setCustomId(`dlt_${serverId}`)
        .setLabel(ui.buttons.delete.label)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(ui.buttons.delete.emoji);

      await interaction.reply({ components: [new ActionRowBuilder().addComponents(editBtn, alertBtn, deleteBtn)], flags: MessageFlags.Ephemeral });
      return;
    }

    // Alert button → DM submitter
    if (interaction.isButton() && interaction.customId.startsWith('alert_')) {
      const serverId = interaction.customId.replace('alert_', '');
      const ui = getUI();
      const config = getConfig();
      if (!isManager(interaction, config)) {
        await interaction.reply({ content: ui.messages.errors.noPermission, flags: MessageFlags.Ephemeral });
        return;
      }

      const servers = getServers();
      const server = servers.find(s => s.id === serverId);
      if (!server) {
        await interaction.reply({ content: ui.messages.publish.notFound, flags: MessageFlags.Ephemeral });
        return;
      }

      const user = await client.users.fetch(server.userId).catch(() => null);
      if (!user) {
        await interaction.reply({ content: ui.messages.publish.cannotDm, flags: MessageFlags.Ephemeral });
        return;
      }

      const alertEmbed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(ui.embeds.publish.alertTitle)
        .setDescription(ui.embeds.publish.alertDesc)
        .setFooter({ text: ui.embeds.footer })
        .setTimestamp();

      try {
        await user.send({ embeds: [alertEmbed] });
        await interaction.reply({ content: ui.messages.publish.alertSent, flags: MessageFlags.Ephemeral });
      } catch {
        await interaction.reply({ content: ui.messages.publish.cannotDm, flags: MessageFlags.Ephemeral });
      }
      return;
    }

    // Edit button → show modal
    if (interaction.isButton() && interaction.customId.startsWith('edit_') && !interaction.customId.startsWith('edit_server_')) {
      const serverId = interaction.customId.replace('edit_', '');
      const ui = getUI();
      const config = getConfig();
      if (!isManager(interaction, config)) {
        await interaction.reply({ content: ui.messages.errors.noPermission, flags: MessageFlags.Ephemeral });
        return;
      }

      const servers = getServers();
      const server = servers.find(s => s.id === serverId);
      if (!server) {
        await interaction.reply({ content: ui.messages.publish.notFound, flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`edit_server_${serverId}`)
        .setTitle(ui.embeds.publish.editTitle);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('edit_invite').setLabel(ui.modals.publish.inviteLabel).setStyle(TextInputStyle.Short).setValue(server.inviteLink).setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('edit_banner').setLabel(ui.modals.publish.bannerLabel).setStyle(TextInputStyle.Short).setValue(server.bannerLink).setRequired(true),
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    // Delete button → remove entry + delete message
    if (interaction.isButton() && interaction.customId.startsWith('dlt_')) {
      const serverId = interaction.customId.replace('dlt_', '');
      const ui = getUI();
      const config = getConfig();
      if (!isManager(interaction, config)) {
        await interaction.reply({ content: ui.messages.errors.noPermission, flags: MessageFlags.Ephemeral });
        return;
      }

      const servers = getServers();
      const idx = servers.findIndex(s => s.id === serverId);
      if (idx === -1) {
        await interaction.reply({ content: ui.messages.publish.notFound, flags: MessageFlags.Ephemeral });
        return;
      }

      const deletedServer = servers[idx];
      servers.splice(idx, 1);
      saveServers(servers);

      if (deletedServer.messageId) {
        const webhookUrl = config.webhooks?.[deletedServer.type];
        if (webhookUrl) {
          try {
            const wh = new WebhookClient({ url: webhookUrl });
            await wh.deleteMessage(deletedServer.messageId);
          } catch (err) { console.error('[DELETE_WEBHOOK_MSG]', err.message); }
        }
      }

      await interaction.reply({ content: ui.messages.publish.deleted, flags: MessageFlags.Ephemeral });
      return;
    }

    // Edit server modal submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('edit_server_')) {
      const serverId = interaction.customId.replace('edit_server_', '');
      const ui = getUI();
      const config = getConfig();
      if (!isManager(interaction, config)) {
        await interaction.reply({ content: ui.messages.errors.noPermission, flags: MessageFlags.Ephemeral });
        return;
      }

      const servers = getServers();
      const server = servers.find(s => s.id === serverId);
      if (!server) {
        await interaction.reply({ content: ui.messages.publish.notFound, flags: MessageFlags.Ephemeral });
        return;
      }

      server.inviteLink = interaction.fields.getTextInputValue('edit_invite');
      server.bannerLink = interaction.fields.getTextInputValue('edit_banner');
      saveServers(servers);

      if (server.messageId && server.channelId) {
        try {
          const webhookUrl = getConfig().webhooks?.[server.type];
          if (webhookUrl) {
            const wh = new WebhookClient({ url: webhookUrl });
            const payload = buildServerPayload(server, ui);
            await wh.editMessage(server.messageId, payload);
          }
        } catch (err) { console.error('[EDIT_MSG]', err.message); }
      }

      await interaction.reply({ content: ui.messages.publish.updated, flags: MessageFlags.Ephemeral });
      return;
    }
  });
};
