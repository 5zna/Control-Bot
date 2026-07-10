const fs = require('fs');
const path = require('path');
const Pending = require('../models/Pending');
const Server = require('../models/Server');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

const DEFAULT_UI = {
  banner: { url: 'https://i.ibb.co/7xxT9bR1/Rosa-Server-Control.png' },
  activity: 'Rosa Server Control',
  commands: {
    panel: {
      name: 'panel',
      description: 'إرسال لوحة التحكم الرئيسية',
      noPermission: '❌ هذا الأمر متاح فقط لصاحب السيرفر.',
      noSendPermission: '❌ ليس لدي صلاحية إرسال الرسائل في هذه القناة.',
      sent: '✅ تم إرسال لوحة التحكم',
    },
    ping: {
      name: 'ping',
      description: 'Replies with Pong!',
      pinging: 'Pinging...',
      pong: 'Pong! 🏓',
    },
  },
  menus: {
    download: {
      placeholder: '📥 تحميل',
      options: {
        youtube: { label: 'YouTube', description: 'تحميل فيديوهات يوتيوب', emoji: '▶️' },
        tiktok: { label: 'TikTok', description: 'تحميل فيديوهات تيك توك', emoji: '🎵' },
        twitter: { label: 'Twitter / X', description: 'تحميل فيديوهات تويتر', emoji: '🐦' },
      },
    },
    publish: {
      placeholder: '📢 نشر سيرفرك',
      options: {
        servers: { label: 'سيرفرات', description: 'نشر سيرفرك', emoji: '🌐' },
        avatar: { label: 'افاتار', description: 'أفاتارات', emoji: '🖼️' },
        other: { label: 'اخرى', description: 'خيارات أخرى', emoji: '📌' },
      },
    },
    scale: {
      placeholder: '📏 مقياس البوست والشارات',
      options: {
        booster: { label: 'شارة الـ Boost', description: 'تطور شارة Boost السيرفر', emoji: '🖤' },
        nitro: { label: 'شارة الـ Nitro', description: 'تطور شارة Nitro', emoji: '🌟' },
      },
    },
    image: {
      placeholder: '🖼️ تعديل الصور',
      options: {
        avatar_banner: { label: 'عرض افاتار/بانر', description: 'جلب افاتار وبانر أي عضو', emoji: '👤' },
        colorize: { label: 'Colorize', description: 'تلوين الصورة', emoji: '🎨' },
        bw: { label: 'أبيض وأسود', description: 'تحويل الصورة للأبيض والأسود', emoji: '⚫' },
        change_color: { label: 'تغيير اللون', description: 'تغيير لون الصورة', emoji: '🌈' },
        remove_bg: { label: 'إزالة الخلفية', description: 'إزالة خلفية الصورة', emoji: '🔲' },
      },
    },
  },
  modals: {
    download: {
      title: 'تحميل - أدخل الرابط',
      label: 'رابط الفيديو',
      placeholders: {
        youtube: 'https://www.youtube.com/watch?v=...',
        tiktok: 'https://www.tiktok.com/@user/video/...',
        twitter: 'https://x.com/user/status/...',
        fallback: 'أدخل الرابط هنا',
      },
    },
    publish: {
      title: '📢 نشر ',
      inviteLabel: 'رابط السيرفر',
      invitePlaceholder: 'https://discord.gg/...',
      bannerLabel: 'رابط البانر',
      bannerPlaceholder: 'https://...',
    },
    profile: {
      nitroTitle: 'مقياس النيترو',
      boostTitle: 'مقياس البوستات',
      dateLabel: 'تاريخ البداية (YYYY-MM-DD)',
      datePlaceholder: 'مثال: 2024-06-01 (اتركه فارغاً للافتراضي)',
    },
    image: {
      avatarBanner: { title: '👤 عرض افاتار/بانر', userLabel: 'Discord User ID', userPlaceholder: 'أدخل آيدي العضو' },
      colorize: { title: '🎨 Colorize', urlLabel: 'رابط الصورة', urlPlaceholder: 'رابط صورة مباشر' },
      bw: { title: '⚫ أبيض وأسود', urlLabel: 'رابط الصورة', urlPlaceholder: 'رابط صورة مباشر' },
      removeBg: { title: '🔲 إزالة الخلفية', urlLabel: 'رابط الصورة', urlPlaceholder: 'رابط صورة مباشر' },
      changeColor: { title: '🌈 تغيير اللون', urlLabel: 'رابط الصورة', urlPlaceholder: 'رابط صورة مباشر', hexLabel: 'اللون (Hex)', hexPlaceholder: '#ff0000' },
    },
  },
  messages: {
    errors: {
      userNotFound: '❌ لم يتم العثور على العضو.',
      imageFetchFailed: '❌ فشل تحميل الصور.',
      imageProcessingFailed: '❌ فشل معالجة الصورة.',
      invalidHex: '❌ لون غير صالح. استخدم Hex مثل #ff0000',
      sessionExpired: '❌ انتهت الجلسة. أعد المحاولة من البداية.',
      invalidUrl: '❌ الرابط غير صالح. أدخل رابط فيديو صحيح.',
      fileTooLarge: '❌ الملف كبير جداً (أكثر من 25MB)',
      noPermission: '❌ ليس لديك صلاحية.',
      commandError: 'There was an error executing this command.',
      menuError: 'There was an error handling this menu.',
    },
    download: {
      fetching: '⏳ جاري تحميل الفيديو...',
      watchLink: '🎥 **رابط المشاهدة:** ',
      directLink: '🎥 **رابط التحميل:** ',
      failed: '❌ تعذر تحميل الفيديو من ',
      wrongPlatform: '❌ هذا الرابط ليس من ',
    },
    publish: {
      submitted: '✅ تم إرسال طلبك للمراجعة.',
      approved: '✅ تمت الموافقة والنشر.',
      approvedFail: '❌ تمت الموافقة ولكن فشل النشر. تأكد من صلاحيات البوت.',
      rejected: '❌ تم الرفض.',
      deleted: '🗑️ تم حذف السيرفر.',
      updated: '✅ تم تحديث السيرفر.',
      alertSent: '✅ تم إرسال التنبيه للمستخدم.',
      notFound: '❌ السيرفر غير موجود.',
      noLongerExists: '❌ هذا الطلب لم يعد موجوداً.',
      noPendingChannel: '❌ قناة المراجعة غير محددة.',
      noAccessChannel: '❌ لا يمكن الوصول لقناة المراجعة.',
      noChannelConfig: '❌ لم يتم تحديد قناة النشر لهذا القسم.',
      cannotDm: '❌ تعذر إرسال الرسالة للمستخدم.',
    },
  },
  embeds: {
    footer: 'Rosa Server Control',
    publish: {
      approveTitle: '✅ تمت الموافقة على طلب نشر سيرفرك',
      approveDesc: 'تم نشر سيرفرك في قسم ',
      rejectTitle: '❌ تم رفض طلب نشر سيرفرك',
      rejectDesc: 'للأسف، لم تتم الموافقة على طلبك.',
      alertTitle: '🔔 تنبيه بخصوص سيرفرك',
      alertDesc: 'مرحباً، تم إرسال هذا التنبيه لإبلاغك بأن أحد روابط سيرفرك قد تكون منتهية الصلاحية. يرجى التحقق من الرابط والبانر وإذا لزم الأمر تواصل مع الإدارة لتحديثها.',
      editTitle: 'تعديل السيرفر',
    },
  },
  buttons: {
    joinServer: 'انضم للسيرفر',
    manage: 'إدارة',
    approve: { label: 'موافقة', emoji: '✅' },
    reject: { label: 'رفض', emoji: '❌' },
    edit: { label: 'تعديل', emoji: '✏️' },
    alert: { label: 'تنبيه', emoji: '🔔' },
    delete: { label: 'حذف', emoji: '🗑️' },
  },
  platforms: {
    youtube: { name: 'YouTube', emoji: '▶️' },
    tiktok: { name: 'TikTok', emoji: '🎵' },
    twitter: { name: 'Twitter/X', emoji: '🐦' },
  },
  publishSections: {
    servers: { label: '🌐 سيرفرات', match: 'servers' },
    avatar: { label: '🖼️ افاتار', match: 'avatar' },
    other: { label: '📌 اخرى', match: 'other' },
  },
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

let uiCache = null;

function getUI() {
  if (uiCache) return uiCache;
  const config = getConfig();
  uiCache = deepMerge(DEFAULT_UI, config.ui || {});
  return uiCache;
}

function readJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getConfig() {
  return readJson(CONFIG_PATH, {});
}

async function getPending() {
  return Pending.find().lean();
}

async function savePending(entries) {
  await Pending.deleteMany({});
  if (entries.length > 0) await Pending.insertMany(entries);
}

async function getServers() {
  return Server.find().lean();
}

async function saveServers(entries) {
  await Server.deleteMany({});
  if (entries.length > 0) await Server.insertMany(entries);
}

async function addPending(entry) {
  await Pending.create(entry);
}

async function removePending(id) {
  await Pending.deleteOne({ id });
}

async function addServer(entry) {
  await Server.create(entry);
}

module.exports = { getConfig, getPending, savePending, getServers, saveServers, addPending, removePending, addServer, getUI };
