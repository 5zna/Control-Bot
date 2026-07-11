const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const execFilePromise = promisify(execFile);

const PLATFORM_NAMES = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitter: 'Twitter / X',
  facebook: 'Facebook',
};

function getYtDlpPath() {
  if (process.platform === 'win32') {
    const exe = path.join(__dirname, '..', 'yt-dlp.exe');
    console.log('[YT_PATH] checking exe:', exe, 'exists:', fs.existsSync(exe));
    if (fs.existsSync(exe)) return exe;
  }
  const local = path.join(__dirname, '..', 'yt-dlp');
  console.log('[YT_PATH] checking local:', local, 'exists:', fs.existsSync(local));
  if (fs.existsSync(local)) return local;
  console.log('[YT_PATH] falling back to yt-dlp in PATH');
  return 'yt-dlp';
}

async function getYouTubeInfo(url) {
  try {
    const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (!match) return null;
    const ytDlp = getYtDlpPath();
    console.log('[YT_CMD] path:', ytDlp, 'url:', url?.substring(0, 100));
    const { stdout: title, stderr: titleErr } = await execFilePromise(ytDlp, [
      '--print', 'title',
      '--no-warnings',
      url,
    ], { timeout: 15000 });
    console.log('[YT_CMD] title len:', title?.length, 'stderr len:', titleErr?.length);
    console.log('[YT_INFO] title:', title?.trim());
    console.log('[YT_INFO] titleStderr:', titleErr?.substring(0, 300));
    const { stdout: dlUrl, stderr: dlUrlErr } = await execFilePromise(ytDlp, [
      '--get-url',
      '-f', 'best[height<=720]',
      '--no-warnings',
      url,
    ], { timeout: 15000 });
    console.log('[YT_CMD] dlUrl len:', dlUrl?.length, 'stderr len:', dlUrlErr?.length);
    console.log('[YT_INFO] dlUrl:', dlUrl?.trim());
    console.log('[YT_INFO] dlUrlStderr:', dlUrlErr?.substring(0, 300));
    return {
      platform: 'youtube',
      title: title.trim(),
      url: dlUrl.trim(),
      thumbnail: `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`,
    };
  } catch (err) {
    console.error('[YOUTUBE_INFO_FAIL] message:', err.message);
    console.error('[YOUTUBE_INFO_FAIL] code:', err.code);
    console.error('[YOUTUBE_INFO_FAIL] stderr:', (err.stderr || '').substring(0, 500));
    console.error('[YOUTUBE_INFO_FAIL] stack:', err.stack?.substring(0, 500));
    console.error('[YOUTUBE_INFO_FAIL] cmd:', err.cmd || err.syscall || '');
    return null;
  }
}

async function getInstagramInfo(url) {
  try {
    const ytDlp = getYtDlpPath();
    const { stdout: dlUrl } = await execFilePromise(ytDlp, [
      '--get-url', '-f', 'best', '--no-warnings', url,
    ], { timeout: 15000 });
    const { stdout: title } = await execFilePromise(ytDlp, [
      '--print', 'title', '--no-warnings', url,
    ], { timeout: 15000 });
    return {
      platform: 'instagram',
      title: title.trim(),
      url: dlUrl.trim(),
      thumbnail: null,
    };
  } catch (err) {
    console.error('[INSTAGRAM_INFO_FAIL]', err.message);
    return null;
  }
}

async function getTikTokInfo(url) {
  try {
    const { data } = await axios.post('https://www.tikwm.com/api/', { url, hd: 1 }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (data.code !== 0) return null;
    const videoUrl = data.data.hdplay || data.data.play;
    return {
      platform: 'tiktok',
      title: data.data.title || 'TikTok Video',
      url: videoUrl,
      thumbnail: data.data.cover,
    };
  } catch (err) {
    console.error('[TIKTOK_INFO_FAIL]', err.message);
    return null;
  }
}

async function getTwitterInfo(url) {
  try {
    const ytDlp = getYtDlpPath();
    const { stdout: dlUrl } = await execFilePromise(ytDlp, [
      '--get-url', '--no-warnings', url,
    ], { timeout: 15000 });
    const firstUrl = dlUrl.trim().split('\n')[0];
    const { stdout: title } = await execFilePromise(ytDlp, [
      '--print', 'title', '--no-warnings', url,
    ], { timeout: 15000 });
    return {
      platform: 'twitter',
      title: title.trim(),
      url: firstUrl,
      thumbnail: null,
    };
  } catch (err) {
    console.error('[TWITTER_INFO_FAIL]', err.message);
    return null;
  }
}

async function getFacebookInfo(url) {
  try {
    const ytDlp = getYtDlpPath();
    const { stdout: dlUrl } = await execFilePromise(ytDlp, [
      '--get-url', '--no-warnings', url,
    ], { timeout: 15000 });
    const { stdout: title } = await execFilePromise(ytDlp, [
      '--print', 'title', '--no-warnings', url,
    ], { timeout: 15000 });
    const firstUrl = dlUrl.trim().split('\n')[0];
    return {
      platform: 'facebook',
      title: title.trim(),
      url: firstUrl,
      thumbnail: null,
    };
  } catch (err) {
    console.error('[FACEBOOK_INFO_FAIL]', err.message);
    return null;
  }
}

async function getVideoInfo(url, platform) {
  switch (platform) {
    case 'youtube': return getYouTubeInfo(url);
    case 'instagram': return getInstagramInfo(url);
    case 'tiktok': return getTikTokInfo(url);
    case 'twitter': return getTwitterInfo(url);
    case 'facebook': return getFacebookInfo(url);
    default: return null;
  }
}

module.exports = { getVideoInfo, PLATFORM_NAMES };
