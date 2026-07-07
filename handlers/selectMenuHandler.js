const { MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getUI } = require('../utils/storage');

module.exports = (client) => {
  const menusPath = path.join(__dirname, '..', 'selectMenus');
  if (!fs.existsSync(menusPath)) return;
  const menuFiles = fs.readdirSync(menusPath).filter(f => f.endsWith('.js'));

  for (const file of menuFiles) {
    const menu = require(path.join(menusPath, file));
    if ('customId' in menu && 'execute' in menu) {
      client.selectMenus.set(menu.customId, menu);
    }
  }

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    const menu = client.selectMenus.get(interaction.customId);
    if (!menu) return;

    try {
      await menu.execute(interaction, client);
      if (interaction.message?.editable) {
        try {
          await interaction.message.edit({ content: interaction.message.content, embeds: interaction.message.embeds, components: interaction.message.components });
        } catch {}
      }
    } catch (error) {
      console.error(error);
      const msg = { content: getUI().messages.errors.menuError, flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  });
};
