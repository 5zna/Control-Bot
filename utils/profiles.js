// Booster badge tiers (based on boost streak days)
const BOOSTER_TIERS = [
  { days: 0, label: 'Boost جديد', icon: '', next: 30 },
  { days: 30, label: 'شهر', icon: '', next: 60 },
  { days: 60, label: 'شهرين', icon: '', next: 91 },
  { days: 91, label: '٣ شهور', icon: '', next: 183 },
  { days: 183, label: '٦ شهور', icon: '', next: 273 },
  { days: 273, label: '٩ شهور', icon: '', next: 365 },
  { days: 365, label: 'سنة', icon: '', next: 456 },
  { days: 456, label: 'سنة و٣ شهور', icon: '', next: 548 },
  { days: 548, label: 'سنة و٦ شهور', icon: '', next: 730 },
  { days: 730, label: '💎 سنتين', icon: '', next: null },
];

// Nitro badge tiers (based on subscription days)
const NITRO_TIERS = [
  { days: 0, label: 'Default', icon: '🔘', next: 30 },
  { days: 30, label: 'Bronze', icon: '🥉', next: 91 },
  { days: 91, label: 'Silver', icon: '🥈', next: 183 },
  { days: 183, label: 'Gold', icon: '🥇', next: 365 },
  { days: 365, label: 'Platinum', icon: '💿', next: 730 },
  { days: 730, label: 'Diamond', icon: '💎', next: 1095 },
  { days: 1095, label: 'Emerald', icon: '🟩', next: 1825 },
  { days: 1825, label: 'Ruby', icon: '🔴', next: 2190 },
  { days: 2190, label: 'Fire', icon: '🔥', next: null },
];

// Reverse lookup: icon hash → days threshold (from profile badges API)
const BOOSTER_ICONS_BY_HASH = {
  '51040c70d4f20a921ad6674ff86fc95c': 0,
  '0e4080d1d333bc7ad29ef6528b6f2fb7': 30,
  '72bed924410c304dbe3d00a6e593ff59': 60,
  'df199d2050d3ed4ebf84d64ae83989f8': 91,
  '996b3e870e8a22ce519b3a50e6bdd52f': 183,
  '991c9f39ee33d7537d9f408c3e53141e': 273,
  'cb3ae83c15e970e8f3d410bc62cb8b99': 365,
  '7142225d31238f6387d9f09efaa02759': 456,
  'ec92202290b48d0879b7413d2dde3bab': 548,
};

const NITRO_DAYS_BY_HASH = {
  '2ba85e8026a8614b640c2837bcdfe21b': 0,
  '4f33c4a9c64ce221936bd256c356f91f': 30,
  '4514fab914bdbfb4ad2fa23df76121a6': 91,
  '2895086c18d5531d499862e41d1155a6': 183,
  '0334688279c8359120922938dcb1d6f8': 365,
  '0d61871f72bb9a33a7ae568c1fb4f20a': 730,
  '11e2d339068b55d3a506cff34d3780f3': 1095,
  'cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4': 1825,
  '5b154df19c53dce2af92c9b61e6be5e2': 2190,
};

function getCurrentMilestone(days, milestones) {
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

function buildProgressBar(value, length = 12) {
  const filled = Math.round(value * length);
  return '▰'.repeat(Math.min(filled, length)) + '▱'.repeat(Math.max(length - filled, 0));
}

function formatDuration(days) {
  if (days <= 0) return '0';
  const months = Math.floor(days / 30);
  const d = days % 30;
  let parts = [];
  if (months > 0) parts.push(`${months} شهر`);
  if (d > 0) parts.push(`${d} يوم`);
  return parts.join(' و ') || 'أقل من يوم';
}

module.exports = {
  BOOSTER_TIERS,
  NITRO_TIERS,
  BOOSTER_ICONS_BY_HASH,
  NITRO_DAYS_BY_HASH,
  getCurrentMilestone,
  buildProgressBar,
  formatDuration,
};
