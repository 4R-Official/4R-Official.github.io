const crypto = require('crypto');

// B站公开的安卓客户端 appkey（仅用于只读接口签名）
const APP_KEY = '1d8b6e7d45233436';
const APP_SECRET = '560c52ccd288fed045859ed18bffd973';
const MID = '694649512'; // 4R_ 的 B站 UID
const UA = 'Mozilla/5.0 BiliDroid/7.39.0 (bbcallen@gmail.com) os/android model/PC mobi_app/android build/7390300 channel/bili innerVer/7390310 osVer/10 network/2';
const PAGE_SIZE = 30;

// 内存缓存，减少对 B站接口的请求频率（容器存活期间有效）
let cache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000; // 10 分钟

function buildSignedQuery(params) {
  // app 接口签名：参数按 key 字典序排列，拼接后追加 appsecret 做 md5
  const sortedKeys = Object.keys(params).sort();
  const raw = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
  const sign = crypto.createHash('md5').update(raw + APP_SECRET, 'utf8').digest('hex');
  const query = sortedKeys
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');
  return `${query}&sign=${sign}`;
}

async function fetchVideosFromBilibili() {
  const params = {
    vmid: MID,
    ps: PAGE_SIZE,
    pn: 1,
    order: 'pubdate',
    mobi_app: 'android',
    platform: 'android',
    appkey: APP_KEY,
    ts: Math.floor(Date.now() / 1000),
    version: '7.39.0',
    build: '7390300',
  };
  const url = `https://app.bilibili.com/x/v2/space/archive/cursor?${buildSignedQuery(params)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`bilibili HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`bilibili code ${json.code}: ${json.message || ''}`);

  const items = (json.data && json.data.item) || [];
  return items
    .filter((it) => it && (it.bvid || it.param))
    .map((it) => ({
      bvid: it.bvid || '',
      aid: it.param || '',
      title: it.title || '未命名',
      pic: String(it.cover || '').replace(/^http:\/\//, 'https://'),
      url: it.bvid
        ? `https://www.bilibili.com/video/${it.bvid}`
        : `https://www.bilibili.com/video/av${it.param}`,
    }));
}

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  const now = Date.now();

  // 命中缓存直接返回
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'public, max-age=600' },
      body: JSON.stringify({ success: true, cached: true, videos: cache.data }),
    };
  }

  try {
    const videos = await fetchVideosFromBilibili();
    if (!videos.length) throw new Error('empty video list');
    cache = { data: videos, ts: now };
    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'public, max-age=600' },
      body: JSON.stringify({ success: true, cached: false, videos }),
    };
  } catch (error) {
    // 接口异常时：若有旧缓存则继续用旧缓存，否则返回 success:false（前端保留静态胶片）
    if (cache.data) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, cached: true, stale: true, videos: cache.data }),
      };
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, message: String(error.message || error), videos: [] }),
    };
  }
};
