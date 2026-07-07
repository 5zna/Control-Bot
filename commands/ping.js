const { SlashCommandBuilder } = require('discord.js');
const { getUI } = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

  async execute(interaction) {
    const ui = getUI();
    const sent = await interaction.reply({ content: ui.commands.ping.pinging, fetchReply: true });
    await interaction.editReply(
      `${ui.commands.ping.pong}\nWebSocket: ${interaction.client.ws.ping}ms\nRoundtrip: ${sent.createdTimestamp - interaction.createdTimestamp}ms`
    );
  },
};