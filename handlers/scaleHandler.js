const { EmbedBuilder, MessageFlags } = require('discord.js');

const NITRO_NAMES = {
  null: 'لا يوجد',
  1: 'Nitro Classic',
  2: 'Nitro',
  3: 'Nitro Basic',
};

// Booster badge milestones (from Discord article)
const BOOST_MILESTONES = [
  { days: 0, label: 'بداية الـ Boost', next: 'شهر' },
  { days: 30, label: 'شهر', next: 'شهرين' },
  { days: 60, label: 'شهرين', next: '٦ شهور' },
  { days: 183, label: '٦ شهور', next: 'سنة' },
  { days: 365, label: 'سنة', next: 'سنتين' },
  { days: 730, label: 'سنتين', next: null },
];

// Nitro badge milestones (from Discord article)
const NITRO_MILESTONES = [
  { days: 0, label: 'بداية الاشتراك', next: 'شهر' },
  { days: 30, label: 'شهر', next: 'سنة' },
  { days: 365, label: 'سنة', next: 'سنتين' },
  { days: 730, label: 'سنتين', next: '٣ سنين' },
  { days: 1095, label: '٣ سنين', next: '٥ سنين' },
  { days: 1825, label: '٥ سنين', next: '١٠ سنين' },
  { days: 3650, label: '١٠ سنين', next: '١٥ سنة' },
  { days: 5475, label: '١٥ سنة', next: null },
];

function getMilestone(days, milestones) {
  let current = milestones[0];
  let nextMilestone = null;
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (days >= milestones[i].days) {
      current = milestones[i];
      nextMilestone = milestones[i + 1] || null;
      break;
    }
  }
  const nextDays = nextMilestone ? nextMilestone.days : current.days;
  const range = nextDays - current.days;
  const progress = range > 0 ? (days - current.days) / range : 1;
  const remaining = nextMilestone ? Math.max(0, nextMilestone.days - days) : 0;
  return { current, next: nextMilestone, progress: Math.min(progress, 1), remaining };
}

function progressBar(value, length = 10) {
  const filled = Math.round(value * length);
  return '🟩'.repeat(Math.min(filled, length)) + '⬛'.repeat(Math.max(length - filled, 0));
}

function formatTime(remaining) {
  if (remaining <= 0) return '';
  const months = Math.floor(remaining / 30);
  const days = remaining % 30;
  let text = '';
  if (months > 0) text += `${months} شهر `;
  if (days > 0) text += `${days} يوم`;
  return text.trim();
}

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('scale_modal_')) return;

    const type = interaction.customId.replace('scale_modal_', '');
    const userId = interaction.fields.getTextInputValue('user_id').trim();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let user;
    let member = null;
    const targetGuildId = process.env.GUILD_ID || interaction.guildId;
    try {
      const targetGuild = await client.guilds.fetch(targetGuildId);
      member = await targetGuild.members.fetch(userId);
      user = member.user;
    } catch {
      try {
        user = await client.users.fetch(userId, { force: true });
      } catch {
        await interaction.editReply({ content: '❌ لم يتم العثور على العضو. تأكد من الآيدي.' });
        return;
      }
    }

    if (type === 'nitro_scale') {
      // Use interaction user data if checking self (API doesn't expose premium_type for others)
      const premiumType = userId === interaction.user.id && interaction.member?.user?.premiumType
        ? interaction.member.user.premiumType
        : user.premiumType;
      const nitroName = NITRO_NAMES[premiumType] || 'لا يوجد';

      let desc = `**المستخدم:** <@${userId}>\n**نوع النيترو:** ${nitroName}`;

      if (premiumType) {
        desc += '\n\n⚠️ Discord لا يوفر مدة اشتراك النيترو عبر الـ API.';
        desc += '\nللتحقق من تطور الشارة:';
        desc += '\n• **ديسكتوب:** hover على الشارة في البروفايل';
        desc += '\n• **موبايل:** الإعدادات ← إدارة النيترو';
        desc += '\n\n**مراحل تطور شارة النيترو:**';
        desc += '\nشهر ← سنة ← سنتين ← ٣ سنين ← ٥ سنين ← ١٠ سنين ← ١٥ سنة';
      } else {
        desc += '\n\n❌ العضو ليس لديه اشتراك نيترو.';
      }

      const embed = new EmbedBuilder()
        .setColor(premiumType ? 0x57f287 : 0x808080)
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .setTitle('🏅 مقياس شارة النيترو')
        .setDescription(desc)
        .setFooter({ text: 'Rosa Server Control' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Post Scale - Booster badge evolution
    const premiumSince = member?.premiumSince ?? null;
    if (!member || !premiumSince) {
      await interaction.editReply({ content: `❌ <@${userId}> لا يوجد لديه Boost نشط في السيرفر المحدد داخل \`.env\`، لذلك لا يوجد تاريخ \`since\` لعرضه.` });
      return;
    }

    const createdAt = user.createdAt;
    const accountAge = Math.floor((Date.now() - createdAt) / 86400000);
    const joinDate = member.joinedAt;
    const serverDays = joinDate ? Math.floor((Date.now() - joinDate) / 86400000) : null;
    const boostDays = Math.floor((Date.now() - premiumSince) / 86400000);

    let desc = `**المستخدم:** <@${userId}>\n`;
    desc += `**تاريخ إنشاء الحساب:** <t:${Math.floor(createdAt / 1000)}:D>\n`;
    desc += `**عمر الحساب:** ${accountAge} يوم\n`;
    desc += `**تاريخ دخول السيرفر:** ${joinDate ? `<t:${Math.floor(joinDate / 1000)}:D>` : 'غير معروف'}\n`;
    if (serverDays) desc += `**مدة التواجد:** ${serverDays} يوم\n`;

    // Booster badge evolution
    const milestone = getMilestone(boostDays, BOOST_MILESTONES);

    desc += `\n**🖤 Booster Badge Evolution:**`;
    desc += `\n━━━━━━━━━━━━━━━━━━`;
    desc += `\nبدأ الـ Boost منذ: <t:${Math.floor(premiumSince / 1000)}:D>`;
    desc += `\nمدة الـ Boost: **${Math.floor(boostDays / 30)} شهر** (${boostDays} يوم)`;
    desc += `\nالمرحلة الحالية: **${milestone.current.label}**`;
    desc += `\nالتقدم: ${progressBar(milestone.progress)} **${Math.round(milestone.progress * 100)}%**`;

    if (milestone.next) {
      const remaining = formatTime(milestone.remaining);
      desc += `\n━━━━━━━━━━━━━━━━━━`;
      desc += `\n**المرحلة القادمة:** ${milestone.next.label}`;
      desc += `\n**المتبقي:** ${remaining}`;
      if (milestone.remaining > 0) {
        const evolveAt = Date.now() + milestone.remaining * 86400000;
        desc += `\n**تاريخ التطور:** <t:${Math.floor(evolveAt / 1000)}:R>`;
      }
    } else {
      desc += '\n━━━━━━━━━━━━━━━━━━';
      desc += '\n🎉 **تم الوصول لأقصى تطور للشارة!**';
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
      .setTitle('📏 مقياس البوستات')
      .setDescription(desc)
      .setFooter({ text: 'Rosa Server Control' });

    await interaction.editReply({ embeds: [embed] });
  });
};
