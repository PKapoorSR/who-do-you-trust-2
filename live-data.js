(() => {
  'use strict';

  const API_KEY = 'AIzaSyBJQHa73h1b7Jbza76pgUsm8Ds9fcLUG48';

  const CHANNELS = {
    jeff: 'UC68TLK0mAEzUyHx5x5k-S1Q',
    bro:  'UCduKuJToxWPizJ7I2E6n1kA',
    togi: 'UCb2y3fAB0mt6Chk7fTko7eg',
  };

  const STATIC = {
    jeff: {
      subscribers: '8.35M', totalViews: '1.75B', videoCount: '617',
      avgViewsPerVideo: '—', likeRate: '—', avgDurationMin: '—',
      videosPerMonth: '—', channelStarted: '2014', postingConsistency: '—',
      topVideo: null, liveLoaded: false,
      raw: { subscribers: 8350000, views: 1754000000, videos: 617 }
    },
    togi: {
      subscribers: '1.03M', totalViews: '47.2M', videoCount: '43',
      avgViewsPerVideo: '—', likeRate: '—', avgDurationMin: '—',
      videosPerMonth: '—', channelStarted: '2023', postingConsistency: '—',
      topVideo: null, liveLoaded: false,
      raw: { subscribers: 1030000, views: 47212521, videos: 43 }
    },
    bro: {
      subscribers: '2.5M', totalViews: '500M', videoCount: '356',
      avgViewsPerVideo: '—', likeRate: '—', avgDurationMin: '—',
      videosPerMonth: '—', channelStarted: '2012', postingConsistency: '—',
      topVideo: null, liveLoaded: false,
      raw: { subscribers: 2500000, views: 500000000, videos: 356 }
    },
    jpg: {
      subscribers: '3.6M+', totalViews: 'N/A', videoCount: 'N/A',
      avgViewsPerVideo: 'N/A', likeRate: 'N/A', avgDurationMin: 'N/A',
      videosPerMonth: 'N/A', channelStarted: '2021', postingConsistency: 'N/A',
      topVideo: null, liveLoaded: false,
      raw: { subscribers: 3600000, views: 0, videos: 0 }
    }
  };

  async function fetchWithTimeout(url, ms = 8000) {
    const ctrl = new AbortController();
    const id   = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  function fmt(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K';
    return String(n);
  }

  function parseDuration(iso) {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
  }

  function calcConsistency(dates) {
    if (dates.length < 2) return '—';
    const gaps = [];
    for (let i = 0; i < dates.length - 1; i++) {
      gaps.push((dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24));
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const std  = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
    const label = std < 3 ? 'Very Regular' : std < 7 ? 'Regular' : std < 14 ? 'Moderate' : 'Irregular';
    return `${label} (±${std.toFixed(1)}d)`;
  }

  async function fetchChannelStats(channelId) {
    // channel stats + snippet (publishedAt) + contentDetails (uploads playlist)
    const chanRes = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&id=${channelId}&key=${API_KEY}`
    );
    if (!chanRes.ok) throw new Error(`HTTP ${chanRes.status}`);
    const chanJson = await chanRes.json();
    const item = chanJson.items?.[0];
    if (!item) throw new Error('No channel data');

    const stats             = item.statistics;
    const publishedAt       = item.snippet.publishedAt;
    const uploadsPlaylistId = item.contentDetails.relatedPlaylists.uploads;
    const subs  = parseInt(stats.subscriberCount, 10);
    const views = parseInt(stats.viewCount, 10);
    const vids  = parseInt(stats.videoCount, 10);

    // recent 50 videos — need snippet for publishedAt (posting consistency)
    const plRes = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${API_KEY}`
    );
    if (!plRes.ok) throw new Error(`Playlist HTTP ${plRes.status}`);
    const plJson = await plRes.json();
    const items  = plJson.items || [];
    const videoIds      = items.map(i => i.contentDetails.videoId);
    const uploadDates   = items.map(i => new Date(i.contentDetails.videoPublishedAt || i.snippet.publishedAt));

    // batch video stats + duration
    let likeRate = '—', avgDurationMin = '—';
    if (videoIds.length > 0) {
      const vidRes = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds.join(',')}&key=${API_KEY}`
      );
      if (vidRes.ok) {
        const vidJson = await vidRes.json();
        const videos  = vidJson.items || [];
        let totalLikes = 0, totalVidViews = 0, totalDuration = 0, n = 0;
        videos.forEach(v => {
          totalVidViews += parseInt(v.statistics.viewCount  || 0, 10);
          totalLikes    += parseInt(v.statistics.likeCount  || 0, 10);
          totalDuration += parseDuration(v.contentDetails.duration);
          n++;
        });
        if (totalVidViews > 0) likeRate = (totalLikes / totalVidViews * 100).toFixed(1) + '%';
        if (n > 0) avgDurationMin = Math.round(totalDuration / n / 60) + ' min';
      }
    }

    const ageMonths         = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const videosPerMonth    = (vids / ageMonths).toFixed(1);
    const channelStarted    = new Date(publishedAt).getFullYear().toString();
    const postingConsistency = calcConsistency(uploadDates);

    const avatar = item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '';

    return {
      subscribers: fmt(subs), totalViews: fmt(views), videoCount: String(vids),
      avgViewsPerVideo: fmt(Math.round(views / vids)),
      likeRate, avgDurationMin, videosPerMonth, channelStarted, postingConsistency,
      avatar, liveLoaded: true,
      raw: { subscribers: subs, views, videos: vids }
    };
  }

  async function fetchTopVideo(channelId) {
    // search is 100 quota units — returns all-time most-viewed video
    const searchRes = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=viewCount&type=video&maxResults=1&key=${API_KEY}`
    );
    if (!searchRes.ok) throw new Error(`Search HTTP ${searchRes.status}`);
    const searchJson = await searchRes.json();
    const hit = searchJson.items?.[0];
    if (!hit) return null;

    const videoId   = hit.id.videoId;
    const title     = hit.snippet.title;
    const thumbnail = hit.snippet.thumbnails.medium?.url || hit.snippet.thumbnails.default?.url;

    // get exact view count
    const statsRes  = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${API_KEY}`
    );
    let views = '—';
    if (statsRes.ok) {
      const statsJson = await statsRes.json();
      const count = parseInt(statsJson.items?.[0]?.statistics?.viewCount || 0, 10);
      if (count) views = fmt(count) + ' views';
    }

    return { videoId, title, thumbnail, views, url: `https://www.youtube.com/watch?v=${videoId}` };
  }

  async function fetchCreator(key, channelId) {
    const [statsResult, topResult] = await Promise.allSettled([
      fetchChannelStats(channelId),
      fetchTopVideo(channelId)
    ]);
    const base     = statsResult.status === 'fulfilled' ? statsResult.value : { liveLoaded: false };
    const topVideo = topResult.status  === 'fulfilled' ? topResult.value  : null;
    return { ...STATIC[key], ...base, topVideo };
  }

  async function fetchTikTokStats() {
    const res = await fetchWithTimeout(
      'https://countik.com/api/userinfo/name/jpgcoaching'
    );
    if (!res.ok) throw new Error(`countik HTTP ${res.status}`);
    const j = await res.json();
    const fans      = parseInt(j.fans      || 0, 10);
    const heart     = parseInt(j.heart     || 0, 10);
    const video     = parseInt(j.video     || 0, 10);
    const following = parseInt(j.following || 0, 10);
    if (!fans) throw new Error('No follower data returned');
    const avgLikes  = video > 0 ? fmt(Math.round(heart / video)) : '—';
    const ageMonths = (Date.now() - new Date('2021-01-01').getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const vpm       = video > 0 ? (video / ageMonths).toFixed(1) : '—';
    const avatar = j.photo || j.avatar || j.avatarLarger || '';

    return {
      subscribers:      fmt(fans),
      totalViews:       fmt(heart),
      videoCount:       video     ? String(video)     : '—',
      avgLikesPerVideo: avgLikes,
      videosPerMonth:   vpm,
      following:        following ? fmt(following)    : '—',
      avatar,           liveLoaded: true,
      raw: { subscribers: fans, views: heart, videos: video }
    };
  }

  async function init() {
    window.LIVE = JSON.parse(JSON.stringify(STATIC));

    const ytKeys = Object.keys(CHANNELS);
    const [ytResults, [ttResult]] = await Promise.all([
      Promise.allSettled(ytKeys.map(k => fetchCreator(k, CHANNELS[k]))),
      Promise.allSettled([fetchTikTokStats()])
    ]);

    ytResults.forEach((r, i) => {
      if (r.status === 'fulfilled') window.LIVE[ytKeys[i]] = r.value;
    });

    if (ttResult.status === 'fulfilled') {
      window.LIVE.jpg = { ...window.LIVE.jpg, ...ttResult.value };
    }

    document.dispatchEvent(new Event('liveDataReady'));
  }

  init();
})();
