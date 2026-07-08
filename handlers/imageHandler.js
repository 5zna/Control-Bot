const { AttachmentBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const { getUI } = require('../utils/storage');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    const customId = interaction.customId;
    const ui = getUI();
    const errImg = ui.messages.errors.imageProcessingFailed;
    const errUser = ui.messages.errors.userNotFound;

    // ── Avatar / Banner ──
    if (customId === 'image_avatar_banner') {
      const userId = interaction.fields.getTextInputValue('user_id').trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      let user;
      try {
        user = await client.users.fetch(userId, { force: true });
      } catch {
        await interaction.editReply(errUser);
        return;
      }

      const avatarUrl = user.displayAvatarURL({ size: 1024, extension: 'png' });
      const bannerUrl = user.bannerURL({ size: 1024, extension: 'png' });
      const files = [];

      try {
        const av = await axios({ url: avatarUrl, responseType: 'arraybuffer', timeout: 10000 });
        files.push(new AttachmentBuilder(Buffer.from(av.data), { name: 'avatar.png' }));
      } catch {}

      if (bannerUrl) {
        try {
          const bn = await axios({ url: bannerUrl, responseType: 'arraybuffer', timeout: 10000 });
          files.push(new AttachmentBuilder(Buffer.from(bn.data), { name: 'banner.png' }));
        } catch {}
      }

      if (!files.length) {
        await interaction.editReply(ui.messages.errors.imageFetchFailed);
        return;
      }

      await interaction.editReply({ content: `<@${userId}>`, files });
      return;
    }

    // ── Black & White ──
    if (customId === 'image_bw') {
      const url = interaction.fields.getTextInputValue('image_url').trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const img = await loadImg(url);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < d.data.length; i += 4) {
          const g = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3;
          d.data[i] = d.data[i + 1] = d.data[i + 2] = g;
        }
        ctx.putImageData(d, 0, 0);
        await interaction.editReply({ files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'bw.png' })] });
      } catch { await interaction.editReply(errImg); }
      return;
    }

    // ── Remove Background ──
    if (customId === 'image_remove_bg') {
      const imgUrl = interaction.fields.getTextInputValue('image_url').trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const img = await loadImg(imgUrl);
        const maxDim = 1200;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const pngBuf = canvas.toBuffer('image/png');
        const params = new URLSearchParams();
        params.append('image_file_b64', pngBuf.toString('base64'));
        params.append('size', 'auto');
        const res = await axios.post('https://api.remove.bg/v1.0/removebg', params.toString(),
          {
            headers: {
              'X-Api-Key': process.env.REMOVEBG_KEY,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            responseType: 'arraybuffer',
            timeout: 30000,
          },
        );
        await interaction.editReply({ files: [new AttachmentBuilder(Buffer.from(res.data), { name: 'no-bg.png' })] });
      } catch (e) {
        console.error('[removebg]', e?.response?.status, e?.message);
        await interaction.editReply('❌ فشلت إزالة الخلفية. تأكد من صحة الرابط ومن أن API key شغال.');
      }
      return;
    }

    // ── Colorize (Warm Tone) ──
    if (customId === 'image_colorize') {
      const url = interaction.fields.getTextInputValue('image_url').trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const img = await loadImg(url);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < d.data.length; i += 4) {
          d.data[i] = Math.min(255, d.data[i] * 1.4);
          d.data[i + 1] = Math.min(255, d.data[i + 1] * 0.85);
          d.data[i + 2] = Math.min(255, Math.max(0, d.data[i + 2] * 0.5));
        }
        ctx.putImageData(d, 0, 0);
        await interaction.editReply({ files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'colorize.png' })] });
      } catch (e) {
        console.error('[colorize]', e?.message || e);
        await interaction.editReply(errImg);
      }
      return;
    }

    // ── Change Color ──
    if (customId === 'image_change_color') {
      const url = interaction.fields.getTextInputValue('image_url').trim();
      const hex = interaction.fields.getTextInputValue('hex_color').trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const color = hexToRgb(hex);
      if (!color) {
        await interaction.editReply(ui.messages.errors.invalidHex);
        return;
      }

      try {
        const img = await loadImg(url);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < d.data.length; i += 4) {
          const avg = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3;
          d.data[i] = avg * (color.r / 255);
          d.data[i + 1] = avg * (color.g / 255);
          d.data[i + 2] = avg * (color.b / 255);
        }
        ctx.putImageData(d, 0, 0);
        await interaction.editReply({ files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'color_changed.png' })] });
      } catch {
        await interaction.editReply(errImg);
      }
      return;
    }

  });
};

async function loadImg(url) {
  const src = url.includes('cdn.discordapp.com') ? url.replace(/\.\w+(\?|$)/, '.png$1') : url;
  const res = await axios({ url: src, responseType: 'arraybuffer', timeout: 15000, maxContentLength: 10 * 1024 * 1024 });
  const img = await loadImage(Buffer.from(res.data));
  if (img.width > 2000 || img.height > 2000) throw new Error('Image too large');
  return img;
}

function hexToRgb(hex) {
  const m = hex.replace('#', '').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
