const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const { getUI } = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('إرسال لوحة التحكم الرئيسية'),

  async execute(interaction) {
    const ui = getUI();
    if (interaction.user.id !== interaction.guild.ownerId) {
      await interaction.reply({ content: ui.commands.panel.noPermission, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const banner = new AttachmentBuilder(ui.banner.url, { name: 'banner.png' });

    const toOpt = (k, v) => ({ label: v.label, description: v.description, value: k, emoji: v.emoji });

    const menu1 = new StringSelectMenuBuilder()
      .setCustomId('download_menu')
      .setPlaceholder(ui.menus.download.placeholder)
      .addOptions(Object.entries(ui.menus.download.options).map(([k, v]) => toOpt(k, v)));

    const menu2 = new StringSelectMenuBuilder()
      .setCustomId('menu2')
      .setPlaceholder(ui.menus.publish.placeholder)
      .addOptions(Object.entries(ui.menus.publish.options).map(([k, v]) => toOpt(k, v)));

    const menu3 = new StringSelectMenuBuilder()
      .setCustomId('menu3')
      .setPlaceholder(ui.menus.scale.placeholder)
      .addOptions(Object.entries(ui.menus.scale.options).map(([k, v]) => toOpt(k, v)));

    const menu4 = new StringSelectMenuBuilder()
      .setCustomId('menu4')
      .setPlaceholder(ui.menus.image.placeholder)
      .addOptions(Object.entries(ui.menus.image.options).map(([k, v]) => toOpt(k, v)));

    const rows = [menu1, menu2, menu3, menu4].map(m => new ActionRowBuilder().addComponents(m));
    try {
      await interaction.channel.send({ files: [banner], components: rows });
    } catch {
      await interaction.editReply({ content: ui.commands.panel.noSendPermission });
      return;
    }
    await interaction.editReply({ content: ui.commands.panel.sent });
  },
};
