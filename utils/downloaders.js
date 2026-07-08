const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');

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
  return path.join(__dirname, '..', 'yt-dlp.exe');
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
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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
