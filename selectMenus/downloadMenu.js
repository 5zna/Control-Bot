const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getUI } = require('../utils/storage');

module.exports = {
  customId: 'download_menu',

  async execute(interaction) {
    const platform = interaction.values[0];
    const ui = getUI();
    const modal = new ModalBuilder()
      .setCustomId(`download_modal_${platform}`)
      .setTitle(ui.modals.download.title);

    const urlInput = new TextInputBuilder()
      .setCustomId('download_url')
      .setLabel(ui.modals.download.label)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(ui.modals.download.placeholders[platform] || ui.modals.download.placeholders.fallback)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
    await interaction.showModal(modal);
  },
};
