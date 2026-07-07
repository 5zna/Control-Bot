const { MessageFlags, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { drawTimeline } = require('../utils/badgeCanvas');
const { getUI } = require('../utils/storage');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (!interaction.customId.startsWith('profile_modal_')) return;

    const type = interaction.customId.replace('profile_modal_', '');
    const userId = interaction.user.id;

    let manualDate = interaction.fields.getTextInputValue('start_date')?.trim();
    let parsedDate = null;
    if (manualDate) {
      const sep = manualDate.includes('-') ? '-' : manualDate.includes('/') ? '/' : '.';
      const parts = manualDate.split(sep).map(Number);
      if (parts.length === 3) {
        let y, m, d;
        if (parts[0] > 31) { y = parts[0]; m = parts[1]; d = parts[2]; }
        else { d = parts[0]; m = parts[1]; y = parts[2]; }
        if (y < 100) y += 2000;
        parsedDate = new Date(y, m - 1, d);
      }
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let user;
    let member;
    try {
      member = await interaction.guild.members.fetch(userId);
      user = member.user;
    } catch {
      try { user = await client.users.fetch(userId); } catch {
        await interaction.editReply({ content: getUI().messages.errors.userNotFound });
        return;
      }
    }

    const startDate = parsedDate || member?.premiumSince || new Date('2024-06-01');
    const boostDays = Math.max(0, Math.floor((Date.now() - startDate) / 86400000));
    const buf = await drawTimeline(boostDays, type === 'nitro_scale' ? 'nitro' : 'boost', startDate);
    await interaction.editReply({ content: `<@${userId}>`, files: [new AttachmentBuilder(buf, { name: 'badge_progress.png' })] });
  });
};
