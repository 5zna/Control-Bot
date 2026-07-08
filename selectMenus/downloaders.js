const { execFile } = require('child_process');
const { promisify } = require('util');

const execFilePromise = promisify(execFile);

const PLATFORM_NAMES = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitter: 'Twitter / X',
  facebook: 'Facebook',
};

function getYtDlpPath() {
  const path = require('path');
  const exe = path.join(__dirname, '..', 'yt-dlp.exe');
  const fs = require('fs');
  if (fs.existsSync(exe)) return exe;
  return 'yt-dlp';
}

async function getYouTubeInfo(url) {
  try {
    const ytDlp = getYtDlpPath();
    const { stdout: title } = await execFilePromise(ytDlp, [
      '--print', 'title',
      '--no-warnings',
      url,
    ], { timeout: 15000 });
    const match = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/|v\/)([a-zA-Z0-9_-]{11})/);
    return {
      platform: 'youtube',
      title: title.trim(),
      url: url,
      thumbnail: match ? `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg` : null,
    };
  } catch {
    return null;
  }
}

async function getGenericInfo(url, platform) {
  try {
    const ytDlp = getYtDlpPath();
    const [dlResult, titleResult] = await Promise.allSettled([
      execFilePromise(ytDlp, ['--get-url', '-f', 'best', '--no-warnings', url], { timeout: 20000 }),
      execFilePromise(ytDlp, ['--print', 'title', '--no-warnings', url], { timeout: 15000 }),
    ]);
    const dlUrl = dlResult.status === 'fulfilled' ? dlResult.value.stdout.trim().split('\n')[0] : null;
    const title = titleResult.status === 'fulfilled' ? titleResult.value.stdout.trim() : `${platform} Video`;
    return { platform, title, url: dlUrl || url, thumbnail: null };
  } catch {
    return null;
  }
}

async function getVideoInfo(url, platform) {
  if (platform === 'youtube') return getYouTubeInfo(url);
  return getGenericInfo(url, platform);
}

module.exports = { getVideoInfo, PLATFORM_NAMES };
