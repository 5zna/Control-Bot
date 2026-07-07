const fs = require('fs');
const path = require('path');
const { REST, Routes, MessageFlags } = require('discord.js');
const { getUI } = require('../utils/storage');

module.exports = (client) => {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
    }
  }

  client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const ui = getUI();
    client.user.setPresence({ activities: [{ name: ui.activity, type: 3 }], status: 'online' });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      const route = process.env.GUILD_ID
        ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
        : Routes.applicationCommands(process.env.CLIENT_ID);
      await rest.put(route, { body: commands });
    } catch (error) {
      console.error(error);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      const msg = { content: getUI().messages.errors.commandError, flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  });
};
