const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getUI } = require('../utils/storage');

module.exports = {
  customId: 'menu2',

  async execute(interaction) {
    const value = interaction.values[0];
    const ui = getUI();
    const label = ui.publishSections[value]?.label || value;

    const modal = new ModalBuilder()
      .setCustomId(`publish_modal_${value}`)
      .setTitle(`${ui.modals.publish.title}${label}`);

    const inviteInput = new TextInputBuilder()
      .setCustomId('invite_link')
      .setLabel(ui.modals.publish.inviteLabel)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(ui.modals.publish.invitePlaceholder)
      .setRequired(true);

    const bannerInput = new TextInputBuilder()
      .setCustomId('banner_link')
      .setLabel(ui.modals.publish.bannerLabel)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(ui.modals.publish.bannerPlaceholder)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(inviteInput), new ActionRowBuilder().addComponents(bannerInput));
    await interaction.showModal(modal);
  },
};
