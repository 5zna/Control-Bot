const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const { BOOSTER_TIERS, NITRO_TIERS } = require('./profiles');

const BOOSTER_ICONS = {
  30: '51040c70d4f20a921ad6674ff86fc95c',
  60: '0e4080d1d333bc7ad29ef6528b6f2fb7',
  91: '72bed924410c304dbe3d00a6e593ff59',
  183: 'df199d2050d3ed4ebf84d64ae83989f8',
  273: '996b3e870e8a22ce519b3a50e6bdd52f',
  365: '991c9f39ee33d7537d9f408c3e53141e',
  456: 'cb3ae83c15e970e8f3d410bc62cb8b99',
  548: '7142225d31238f6387d9f09efaa02759',
  730: 'ec92202290b48d0879b7413d2dde3bab',
};

const NITRO_ICONS = {
  0: '2ba85e8026a8614b640c2837bcdfe21b',
  30: '4f33c4a9c64ce221936bd256c356f91f',
  91: '4514fab914bdbfb4ad2fa23df76121a6',
  183: '2895086c18d5531d499862e41d1155a6',
  365: '0334688279c8359120922938dcb1d6f8',
  730: '0d61871f72bb9a33a7ae568c1fb4f20a',
  1095: '11e2d339068b55d3a506cff34d3780f3',
  1825: 'cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4',
  2190: '5b154df19c53dce2af92c9b61e6be5e2',
};

const CACHE = {};

async function getIcon(url) {
  if (CACHE[url]) return CACHE[url];
  try {
    const res = await axios({ method: 'get', url, responseType: 'arraybuffer', timeout: 5000 });
    const img = await loadImage(Buffer.from(res.data));
    CACHE[url] = img;
    return img;
  } catch {
    return null;
  }
}

function getMilestone(days, milestones) {
  if (days <= 0) {
    return { current: milestones[0], next: milestones[1] || null, progress: 0, remaining: milestones[1]?.days || 0 };
  }
  let current = milestones[0];
  let next = null;
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (days >= milestones[i].days) {
      current = milestones[i];
      next = milestones[i + 1] || null;
      break;
    }
  }
  const range = next ? next.days - current.days : 1;
  const progress = next ? Math.min((days - current.days) / range, 1) : 1;
  const remaining = next ? Math.max(0, next.days - days) : 0;
  return { current, next, progress, remaining };
}

async function drawTimeline(days, type, startDate) {
  const tiers = type === 'nitro' ? NITRO_TIERS : BOOSTER_TIERS;
  const icons = type === 'nitro' ? NITRO_ICONS : BOOSTER_ICONS;
  const milestone = getMilestone(days, tiers);
  const { current, next, progress, remaining } = milestone;

  const count = tiers.length;
  const iconSize = 40;
  const gap = 14;
  const padX = 20;
  const width = count * iconSize + (count - 1) * gap + padX * 2;
  const height = 210;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  ctx.textAlign = 'center';

  // Title
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText(type === 'nitro' ? 'Nitro Badge' : 'Boost Badge', width / 2, 24);

  // Date
  if (startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText(`منذ ${dd}-${mm}-${yyyy}`, width / 2, 40);
    }
  }

  // Icons row
  const rowY = 56;
  const startX = padX;

  for (let i = 0; i < count; i++) {
    const x = startX + i * (iconSize + gap);
    const earned = days >= tiers[i].days;

    const hash = icons[tiers[i].days];
    if (!hash) continue;
    const img = await getIcon(`https://cdn.discordapp.com/badge-icons/${hash}.png`);
    if (!img) continue;

    ctx.save();
    ctx.globalAlpha = earned ? 1 : 0.26;
    ctx.beginPath();
    ctx.arc(x + iconSize / 2, rowY + iconSize / 2, iconSize / 2 + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + iconSize / 2, rowY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, rowY, iconSize, iconSize);
    ctx.restore();
  }

  // Progress bar aligned with icon centers
  const barY = 114;
  const barH = 8;
  const barX = startX + iconSize / 2;
  const barW = (count - 1) * (iconSize + gap);
  const segW = iconSize + gap;
  const mainColor = type === 'nitro' ? '#f472b6' : '#a855f7';

  // Current milestone index
  let mi = count - 1;
  for (let i = count - 1; i >= 0; i--) {
    if (days >= tiers[i].days) { mi = i; break; }
  }

  const earnedW = mi * segW;

  // Bar bg
  ctx.fillStyle = '#3f3f46';
  roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fill();

  // Earned fill (up to current milestone center)
  if (earnedW > 1) {
    ctx.fillStyle = mainColor;
    roundRect(ctx, barX, barY, earnedW, barH, barH / 2);
    ctx.fill();
  }

  // Progress within current tier
  if (mi < count - 1) {
    const pw = segW * progress;
    if (pw > 1) {
      ctx.fillStyle = mainColor;
      ctx.globalAlpha = progress > 0.95 ? 1 : 0.3;
      roundRect(ctx, barX + earnedW, barY, pw, barH, barH / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Markers at each icon center
  for (let i = 0; i < count; i++) {
    const mx = barX + i * segW;
    const earned = days >= tiers[i].days;
    ctx.beginPath();
    ctx.arc(mx, barY + barH / 2, earned ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = earned ? '#ffffff' : '#6b7280';
    ctx.fill();
  }

  if (next) {
    // Next badge icon
    const nh = icons[next.days];
    let drew = false;
    if (nh) {
      const img = await getIcon(`https://cdn.discordapp.com/badge-icons/${nh}.png`);
      if (img) {
        const s = 36;
        const cx = width / 2;
        const ny = 148;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, ny + s / 2, s / 2 + 1, 0, Math.PI * 2);
        ctx.fillStyle = '#a1a1aa';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, ny + s / 2, s / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, cx - s / 2, ny, s, s);
        ctx.restore();
        drew = true;
      }
    }
    if (!drew) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText(next.label, width / 2, 162);
    }

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(`بعد ${fmtDays(remaining)}`, width / 2, 196);
  } else {
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#57F287';
    ctx.fillText('🎉 أقصى تطور', width / 2, 162);
  }

  return canvas.toBuffer();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fmtDays(days) {
  if (days <= 0) return '0';
  const m = Math.floor(days / 30);
  const d = days % 30;
  const parts = [];
  if (m > 0) parts.push(`${m} شهر`);
  if (d > 0) parts.push(`${d} يوم`);
  return parts.join(' و ');
}

module.exports = { drawTimeline };
