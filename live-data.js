(() => {
  'use strict';

  const API_KEY = 'AIzaSyBJQHa73h1b7Jbza76pgUsm8Ds9fcLUG48';

  const CHANNELS = {
    jeff: 'UC68TLK0mAEzUyHx5x5k-S1Q',
    bro:  'UCduKuJToxWPizJ7I2E6n1kA',
    togi: 'UCG-leaV0PnqbS-48KqPtduw',
  };

  const STATIC = {
    jeff: {
      subscribers: '8.35M', totalViews: '1.75B', videoCount: '617',
      avgViewsPerVideo: '—', likeRate: '—', avgDurationMin: '—',
      videosPerMonth: '—', channelStarted: '2014',
      liveLoaded: false,
      raw: { subscribers: 8350000, views: 1754000000, videos: 617 }
    },
    togi: {
      subscribers: '740K', totalViews: '85M', videoCount: '312',
      avgViewsPerVideo: '—', likeRate: '—', avgDurationMin: '—',
      videosPerMonth: '—', channelStarted: '2021',
      liveLoaded: false,
      raw: { subscribers: 740000, views: 85000000, videos: 312 }
    },
    bro: {
      subscribers: '2.5M', totalViews: '500M', videoCount: '356',
      avgViewsPerVideo: '—', likeRate: '—', avgDurationMin: '—',
      videosPerMonth: '—', channelStarted: '2012',
      liveLoaded: false,
      raw: { subscribers: 2500000, views: 500000000, videos: 356 }
    },
    jpg: {
      subscribers: '3.6M+', totalViews: 'N/A', videoCount: 'N/A',
      avgViewsPerVideo: 'N/A', likeRate: 'N/A', avgDurationMin: 'N/A',
      videosPerMonth: 'N/A', channelStarted: '2021',
      liveLoaded: false,
      raw: { subscribers: 3600000, views: 0, videos: 0 }
    }
  };

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

  async function fetchChannelFull(channelId) {
    // 1 — channel statistics + snippet (for publishedAt) + contentDetails (for uploads playlist)
    const chanRes = await fetch(
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

    // 2 — most recent 50 video IDs from uploads playlist
    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${API_KEY}`
    );
    if (!plRes.ok) throw new Error(`Playlist HTTP ${plRes.status}`);
    const plJson  = await plRes.json();
    const videoIds = (plJson.items || []).map(i => i.contentDetails.videoId);

    // 3 — batch video statistics + duration
    let likeRate = '—', avgDurationMin = '—';
    if (videoIds.length > 0) {
      const vidRes = await fetch(
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

    // channel age → videos per month
    const ageMonths      = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const videosPerMonth = (vids / ageMonths).toFixed(1);
    const channelStarted = new Date(publishedAt).getFullYear().toString();

    return {
      subscribers:      fmt(subs),
      totalViews:       fmt(views),
      videoCount:       String(vids),
      avgViewsPerVideo: fmt(Math.round(views / vids)),
      likeRate,
      avgDurationMin,
      videosPerMonth,
      channelStarted,
      liveLoaded: true,
      raw: { subscribers: subs, views, videos: vids }
    };
  }

  async function init() {
    window.LIVE = JSON.parse(JSON.stringify(STATIC));

    const keys    = Object.keys(CHANNELS);
    const results = await Promise.allSettled(
      keys.map(k => fetchChannelFull(CHANNELS[k]))
    );

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') window.LIVE[keys[i]] = r.value;
    });

    document.dispatchEvent(new Event('liveDataReady'));
  }

  init();
})();
