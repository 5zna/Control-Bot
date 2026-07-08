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

function getPlatformHint(platform) {
  const hints = {
    youtube: 'youtube.com/*, youtu.be/*',
    tiktok: 'tiktok.com/*, vm.tiktok.com/*, vt.tiktok.com/*',
    instagram: 'instagram.com/*',
    twitter: 'twitter.com/*, x.com/*',
    facebook: 'facebook.com/*, fb.com/*, fb.watch/*',
  };
  return hints[platform] || platform;
}

function getYtDlpPath() {
  const exe = path.join(__dirname, '..', 'yt-dlp.exe');
  const fs = require('fs');
  if (fs.existsSync(exe)) return exe;
  return 'yt-dlp';
}

async function downloadBuffer(videoUrl, sourceUrl) {
  // نفضل yt-dlp -o - لأنه بيدعم أي رابط
  try {
    const ytDlp = getYtDlpPath();
    const { stdout } = await execFilePromise(ytDlp, [
      '-f', 'best[ext=mp4]/best', '-o', '-', '--no-warnings', sourceUrl,
    ], { timeout: 120000, maxBuffer: MAX_FILE_SIZE, encoding: 'buffer' });
    return { buffer: stdout, error: null };
  } catch {}
  // لو فشل yt-dlp، نجرب axios لو عندنا videoUrl مباشر
  if (videoUrl && videoUrl !== sourceUrl) {
    try {
      const response = await axios({ method: 'get', url: videoUrl, responseType: 'stream', timeout: 30000 });
      const chunks = [];
      let size = 0;
      for await (const chunk of response.data) {
        size += chunk.length;
        if (size > MAX_FILE_SIZE) return { buffer: null, error: getUI().messages.errors.fileTooLarge };
        chunks.push(chunk);
      }
      return { buffer: Buffer.concat(chunks), error: null };
    } catch {}
  }
  return { buffer: null, error: getUI().messages.download.failed + 'هذا الرابط.' };
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

    // Validation: الرابط لازم يكون من الموقع المختار
    const PLATFORM_PATTERNS = {
      youtube: /^https?:\/\/([^.]+\.)?(youtube\.com|youtu\.be)\//,
      tiktok: /^https?:\/\/([^.]+\.)?tiktok\.com\//,
      instagram: /^https?:\/\/([^.]+\.)?instagram\.com\//,
      twitter: /^https?:\/\/([^.]+\.)?(twitter\.com|x\.com)\//,
      facebook: /^https?:\/\/([^.]+\.)?(facebook\.com|fb\.com|fb\.watch)\//,
    };
    const pattern = PLATFORM_PATTERNS[platform];
    if (pattern && !pattern.test(url)) {
      await interaction.reply({
        content: `❌ الرابط لا ينتمي إلى ${ui.platforms[platform]?.name || platform}.\nالروابط المقبولة: ${getPlatformHint(platform)}`,
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
