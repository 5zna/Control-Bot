const { EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execFilePromise = promisify(execFile);
const { getVideoInfo, PLATFORM_NAMES } = require('../utils/downloaders');
const { getUI } = require('../utils/storage');

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function isValidUrl(string) {
  try {
    const u = new URL(string);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const PLATFORM_PATTERNS = {
  youtube: /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)/,
  tiktok: /^https?:\/\/(www\.)?tiktok\.com\//,
  instagram: /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//,
  twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status(\/\d+)?(\/video\/\d+)?/,
  facebook: /^https?:\/\/(www\.)?(facebook\.com|fb\.com)\/(watch|reel|video)/,
};

async function downloadBuffer(videoUrl, sourceUrl) {
  const isYouTube = /youtube\.com|youtu\.be/.test(sourceUrl);
  if (isYouTube || videoUrl.endsWith('.m3u8')) {
    try {
      const ytDlp = path.join(__dirname, '..', 'yt-dlp.exe');
      const { stdout } = await execFilePromise(ytDlp, [
        '-f', 'best[ext=mp4]/best', '-o', '-', '--no-warnings', sourceUrl,
      ], { timeout: 120000, maxBuffer: MAX_FILE_SIZE, encoding: 'buffer' });
      return { buffer: stdout, error: null };
    } catch {
      return { buffer: null, error: getUI().messages.download.failed + 'هذا الرابط.' };
    }
  }
  const response = await axios({ method: 'get', url: videoUrl, responseType: 'stream', timeout: 30000 });
  const chunks = [];
  let size = 0;
  for await (const chunk of response.data) {
    size += chunk.length;
    if (size > MAX_FILE_SIZE) return { buffer: null, error: getUI().messages.errors.fileTooLarge };
    chunks.push(chunk);
  }
  return { buffer: Buffer.concat(chunks), error: null };
}

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('download_modal_')) return;

    const platform = interaction.customId.replace('download_modal_', '');
    const url = interaction.fields.getTextInputValue('download_url');
    const ui = getUI();

    if (!isValidUrl(url)) {
      await interaction.reply({ content: ui.messages.errors.invalidUrl, flags: MessageFlags.Ephemeral });
      return;
    }

    const pattern = PLATFORM_PATTERNS[platform];
    if (pattern && !pattern.test(url)) {
      const name = ui.platforms[platform]?.name || platform;
      await interaction.reply({
        content: `${ui.messages.download.wrongPlatform}${name}. تأكد من اختيار المنصة الصحيحة.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const info = await getVideoInfo(url, platform);

    if (!info) {
      const name = ui.platforms[platform]?.name || platform;
      await interaction.editReply({
        content: `${ui.messages.download.failed}${name}. تأكد من الرابط.\n(صور البروفايل والبانر غير مسموحة)`,
      });
      return;
    }

    const pEmoji = ui.platforms[platform]?.emoji || '';
    const pName = ui.platforms[platform]?.name || platform;
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`✅ ${pEmoji} ${info.title}`)
      .setDescription(`**المنصة:** ${pName}`)
      .setFooter({ text: ui.embeds.footer });

    if (info.thumbnail) embed.setThumbnail(info.thumbnail);

    await interaction.editReply({ content: ui.messages.download.fetching, embeds: [] });

    const { buffer, error } = await downloadBuffer(info.url, url);

    if (error) {
      await interaction.editReply({ content: `❌ ${error}\n🎥 **الرابط المباشر:** ${info.url}` });
      return;
    }

    const attachment = new AttachmentBuilder(buffer, { name: `video_${platform}.mp4` });

    try {
      await interaction.editReply({ content: null, files: [attachment] });
    } catch {
      await interaction.editReply({ content: `${ui.messages.download.directLink}${info.url}`, embeds: [embed] });
    }
  });
};
