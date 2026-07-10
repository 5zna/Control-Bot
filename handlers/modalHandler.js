const { EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execFilePromise = promisify(execFile);
const { getVideoInfo } = require('../utils/downloaders');
const { getUI } = require('../utils/storage');

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_BUFFER_SIZE = 200 * 1024 * 1024;

const PLATFORM_PATTERNS = {
  youtube: /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)(\/|$)/,
  tiktok: /^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com(\/|$)/,
  instagram: /^https?:\/\/(www\.|m\.)?instagram\.com\/(p|reel|tv|stories)\//,
  twitter: /^https?:\/\/(www\.|mobile\.)?(twitter\.com|x\.com|t\.co)(\/|$)/,
  facebook: /^https?:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.com|fb\.watch)(\/|$)/,
};

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
    youtube: 'youtube.com/*, youtu.be/*, m.youtube.com/*',
    tiktok: 'tiktok.com/*, vm.tiktok.com/*, vt.tiktok.com/*',
    instagram: 'instagram.com/* (reel, p, tv, stories)',
    twitter: 'twitter.com/*, x.com/*, t.co/*',
    facebook: 'facebook.com/*, fb.com/*, fb.watch/* (watch, reel, video, share, stories)',
  };
  return hints[platform] || platform;
}

function getYtDlpPath() {
  if (process.platform === 'win32') {
    const exe = path.join(__dirname, '..', 'yt-dlp.exe');
    console.log('[MH_PATH] checking exe:', exe, 'exists:', fs.existsSync(exe));
    if (fs.existsSync(exe)) return exe;
  }
  const local = path.join(__dirname, '..', 'yt-dlp');
  console.log('[MH_PATH] checking local:', local, 'exists:', fs.existsSync(local));
  if (fs.existsSync(local)) return local;
  console.log('[MH_PATH] falling back to yt-dlp in PATH');
  return 'yt-dlp';
}

function getCookiesFilePath() {
  const envPath = process.env.YTDLP_COOKIES_FILE?.trim();
  const localPath = path.join(__dirname, '..', 'cookies.txt');
  const candidates = [envPath, localPath].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function buildYtDlpArgs(sourceUrl, platform) {
  const args = ['--no-warnings', '--js-runtimes', 'node', '-o', '-'];
  const cookiesFile = getCookiesFilePath();

  if (cookiesFile) {
    args.push('--cookies', cookiesFile);
  }

  if (platform === 'youtube') {
    args.push('-f', 'best[ext=mp4]/bestvideo+bestaudio/best');
  } else {
    args.push('-f', 'best');
  }

  args.push(sourceUrl);
  return args;
}

function contentTypeToExtension(contentType) {
  const type = (contentType || '').toLowerCase();
  if (type.includes('jpeg')) return 'jpg';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('webm')) return 'webm';
  if (type.includes('quicktime')) return 'mov';
  if (type.includes('mpeg')) return 'mp4';
  if (type.includes('m4a')) return 'm4a';
  if (type.includes('mp3')) return 'mp3';
  return null;
}

async function detectFileExtension(buffer, contentType, sourceUrl, platform) {
  const headerExt = contentTypeToExtension(contentType);
  if (headerExt) return headerExt;

  try {
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(buffer);
    if (detected?.ext) return detected.ext;
  } catch {
    const sig = buffer.subarray(0, 16).toString('hex');
    if (sig.startsWith('1a45dfa3')) return 'webm';
    if (sig.startsWith('0000001c66747970') || sig.startsWith('66747970')) return 'mp4';
    if (sig.startsWith('494433') || sig.startsWith('fffb') || sig.startsWith('fff3')) return 'mp3';
    if (sig.startsWith('52494646')) return 'avi';
    if (sig.startsWith('00000020')) return 'mp4';
    if (buffer[0] === 0x1a && buffer[1] === 0x45) return 'webm';
    if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return 'mp4';
  }

  const pathMatch = sourceUrl?.toLowerCase().match(/\.([a-z0-9]{2,5})(?:\?|$)/);
  if (pathMatch) return pathMatch[1];

  if (platform === 'youtube') return 'mp4';
  if (platform === 'tiktok') return 'mp4';

  return 'mp4';
}

async function downloadBuffer(videoUrl, sourceUrl, platform) {
  try {
    const ytDlpPath = getYtDlpPath();
    const args = buildYtDlpArgs(sourceUrl, platform);
    console.log('[DL_BUF] ytDlp:', ytDlpPath);
    console.log('[DL_BUF] args:', args.join(' '));
    console.log('[DL_BUF] videoUrl:', videoUrl?.substring(0, 200));
    const { stdout, stderr } = await execFilePromise(ytDlpPath, args, {
      timeout: 120000,
      maxBuffer: MAX_BUFFER_SIZE,
      encoding: 'buffer',
    });

    console.log('[DL_BUF] stdout.length:', stdout?.length || 0);
    if (stderr?.length) console.log('[DL_BUF] stderr:', (Buffer.isBuffer(stderr) ? stderr.toString('utf8', 0, 300) : String(stderr)).substring(0, 300));

    if (!stdout || !stdout.length) {
      console.log('[DL_BUF] empty stdout');
      return { buffer: null, error: getUI().messages.download.failed + 'هذا الرابط.' };
    }

    return { buffer: stdout, error: null, contentType: null };
  } catch (err) {
    const errStderr = err.stderr ? (Buffer.isBuffer(err.stderr) ? err.stderr.toString('utf8', 0, 500) : String(err.stderr)) : '';
    console.error('[YTDLP_BUFFER_FAIL] message:', err.message);
    console.error('[YTDLP_BUFFER_FAIL] code:', err.code);
    console.error('[YTDLP_BUFFER_FAIL] errno:', err.errno);
    console.error('[YTDLP_BUFFER_FAIL] stderr:', errStderr);
    console.error('[YTDLP_BUFFER_FAIL] stack:', (err.stack || '').substring(0, 500));

    console.log('[DL_BUF] falling back to axios for:', videoUrl?.substring(0, 200));
    try {
      const response = await axios({
        method: 'get',
        url: videoUrl,
        responseType: 'stream',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': sourceUrl,
        },
      });

      console.log('[DL_BUF] axios status:', response.status, 'content-type:', response.headers['content-type']);

      const chunks = [];
      let size = 0;
      for await (const chunk of response.data) {
        size += chunk.length;
        if (size > MAX_FILE_SIZE) {
          console.log('[DL_BUF] file too large:', size);
          return { buffer: null, error: getUI().messages.errors.fileTooLarge };
        }
        chunks.push(chunk);
      }

      console.log('[DL_BUF] axios total size:', size);
      return {
        buffer: Buffer.concat(chunks),
        error: null,
        contentType: response.headers['content-type'] || null,
      };
    } catch (pipeErr) {
      console.error('[AXIOS_BUFFER_FAIL] message:', pipeErr.message);
      console.error('[AXIOS_BUFFER_FAIL] stack:', (pipeErr.stack || '').substring(0, 300));
      return { buffer: null, error: getUI().messages.download.failed + 'هذا الرابط.' };
    }
  }
}

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('download_modal_')) return;

    const platform = interaction.customId.replace('download_modal_', '');
    const url = interaction.fields.getTextInputValue('download_url');
    const ui = getUI();

    let cleanUrl = url
      .replace(/[\u200B-\u200D\uFEFF\u00A0\u2060\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/\r?\n/g, ' ')
      .trim();

    const urlMatch = cleanUrl.match(/https?:\/\/[^\s<>"']+/);
    if (urlMatch) cleanUrl = urlMatch[0];

    if (!isValidUrl(cleanUrl)) {
      await interaction.reply({ content: ui.messages.errors.invalidUrl, flags: MessageFlags.Ephemeral });
      return;
    }

    const pattern = PLATFORM_PATTERNS[platform];
    if (pattern && !pattern.test(cleanUrl)) {
      const name = ui.platforms[platform]?.name || platform;
      await interaction.reply({
        content: `${ui.messages.download.wrongPlatform}${name}. تأكد من اختيار المنصة الصحيحة.\nالروابط المقبولة: ${getPlatformHint(platform)}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const info = await getVideoInfo(cleanUrl, platform);

    if (!info || !info.url) {
      const name = ui.platforms[platform]?.name || platform;
      await interaction.editReply({
        content: `${ui.messages.download.failed}${name}. تأكد من الرابط.\n(صور البروفايل والبانر غير مسموحة)`,
      });
      return;
    }

    const pEmoji = ui.platforms[platform]?.emoji || '';
    const pName = ui.platforms[platform]?.name || platform;

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`${pEmoji} تأكيد التحميل`)
      .setDescription(`**العنوان:** ${info.title || 'Media'}\n**المنصة:** ${pName}`)
      .setFooter({ text: ui.embeds.footer });

    if (info.thumbnail) confirmEmbed.setThumbnail(info.thumbnail);

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_download')
        .setLabel('✅ تحميل')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('cancel_download')
        .setLabel('❌ إلغاء')
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });

    try {
      const replyMessage = await interaction.fetchReply();
      const buttonInteraction = await replyMessage.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id,
        time: 60000,
      });

      console.log('[DL_FLOW] button clicked:', buttonInteraction.customId, 'user:', buttonInteraction.user.id);

      if (buttonInteraction.customId === 'cancel_download') {
        await buttonInteraction.update({ content: '❌ تم إلغاء التحميل.', embeds: [], components: [] });
        return;
      }

      await buttonInteraction.update({ content: ui.messages.download.fetching, embeds: [], components: [] });

      console.log('[DL_FLOW] calling downloadBuffer with platform:', platform, 'sourceUrl:', cleanUrl);
      console.log('[DL_FLOW] info.url:', info.url?.substring(0, 200));

      const { buffer, error, contentType } = await downloadBuffer(info.url, cleanUrl, platform);

      console.log('[DL_FLOW] downloadBuffer result - buffer:', buffer?.length, 'error:', error, 'contentType:', contentType);

      if (error) {
        console.log('[DL_FLOW] download error, sending direct link');
        await buttonInteraction.editReply({ content: `❌ ${error}\n🎥 **الرابط المباشر:** ${info.url}` });
        return;
      }

      const ext = await detectFileExtension(buffer, contentType, info.url || cleanUrl, platform);
      console.log('[DL_FLOW] detected ext:', ext, 'buffer size:', buffer.length);

      const attachment = new AttachmentBuilder(buffer, { name: `media_${platform}.${ext}` });

      try {
        console.log('[DL_FLOW] sending file...');
        await buttonInteraction.editReply({ content: null, files: [attachment] });
        console.log('[DL_FLOW] file sent successfully');
      } catch (fileErr) {
        console.error('[DL_FLOW] file send failed:', fileErr.message, fileErr.code);
        const directEmbed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(`✅ ${pEmoji} ${info.title || 'Media'}`)
          .setDescription(`**المنصة:** ${pName}`)
          .setURL(cleanUrl)
          .setFooter({ text: ui.embeds.footer });

        if (info.thumbnail) directEmbed.setThumbnail(info.thumbnail);

        await buttonInteraction.editReply({ content: `${ui.messages.download.directLink}${info.url}`, embeds: [directEmbed] });
      }
    } catch (e) {
      console.log('[DL_FLOW] timeout or error:', e.message);
      await interaction.editReply({ content: '⏰ انتهت المهلة. أعد المحاولة من البداية.', embeds: [], components: [] });
    }
  });
};
