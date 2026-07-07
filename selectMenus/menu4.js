const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getUI } = require('../utils/storage');

module.exports = {
  customId: 'menu4',

  async execute(interaction) {
    const value = interaction.values[0];
    const ui = getUI();

    if (value === 'avatar_banner') {
      const m = ui.modals.image.avatarBanner;
      const modal = new ModalBuilder().setCustomId('image_avatar_banner').setTitle(m.title);
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('user_id').setLabel(m.userLabel).setStyle(TextInputStyle.Short).setPlaceholder(m.userPlaceholder).setRequired(true),
      ));
      await interaction.showModal(modal);
      return;
    }

    if (value === 'colorize') {
      const m = ui.modals.image.colorize;
      const modal = new ModalBuilder().setCustomId('image_colorize').setTitle(m.title);
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('image_url').setLabel(m.urlLabel).setStyle(TextInputStyle.Short).setPlaceholder(m.urlPlaceholder).setRequired(true),
      ));
      await interaction.showModal(modal);
      return;
    }

    if (value === 'bw') {
      const m = ui.modals.image.bw;
      const modal = new ModalBuilder().setCustomId('image_bw').setTitle(m.title);
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('image_url').setLabel(m.urlLabel).setStyle(TextInputStyle.Short).setPlaceholder(m.urlPlaceholder).setRequired(true),
      ));
      await interaction.showModal(modal);
      return;
    }

   
    if (value === 'remove_bg') {
      const m = ui.modals.image.removeBg;
      const modal = new ModalBuilder().setCustomId('image_remove_bg').setTitle(m.title);
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('image_url').setLabel(m.urlLabel).setStyle(TextInputStyle.Short).setPlaceholder(m.urlPlaceholder).setRequired(true),
      ));
      await interaction.showModal(modal);
      return;
    }

    if (value === 'change_color') {
      const m = ui.modals.image.changeColor;
      const modal = new ModalBuilder().setCustomId('image_change_color').setTitle(m.title);
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('image_url').setLabel(m.urlLabel).setStyle(TextInputStyle.Short).setPlaceholder(m.urlPlaceholder).setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('hex_color').setLabel(m.hexLabel).setStyle(TextInputStyle.Short).setPlaceholder(m.hexPlaceholder).setRequired(true),
        ),
      );
      await interaction.showModal(modal);
      return;
    }

  },
};
