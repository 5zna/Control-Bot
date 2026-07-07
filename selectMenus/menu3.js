const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getUI } = require('../utils/storage');

module.exports = {
  customId: 'menu3',

  async execute(interaction) {
    const type = interaction.values[0];
    const ui = getUI();
    const modal = new ModalBuilder()
      .setCustomId(`profile_modal_${type}`)
      .setTitle(type === 'nitro_scale' ? ui.modals.profile.nitroTitle : ui.modals.profile.boostTitle);

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('start_date')
          .setLabel(ui.modals.profile.dateLabel)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(ui.modals.profile.datePlaceholder)
          .setRequired(true),
      ),
    );

    await interaction.showModal(modal);
  },
};
