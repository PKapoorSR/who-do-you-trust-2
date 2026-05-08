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
      subscribers: '8.35M',
      totalViews:  '1.75B',
      videoCount:  '617',
      liveLoaded:  false,
      raw: { subscribers: 8350000, views: 1754000000, videos: 617 }
    },
    togi: {
      subscribers: '740K',
      totalViews:  '85M',
      videoCount:  '312',
      liveLoaded:  false,
      raw: { subscribers: 740000, views: 85000000, videos: 312 }
    },
    bro: {
      subscribers: '2.5M',
      totalViews:  '500M',
      videoCount:  '356',
      liveLoaded:  false,
      raw: { subscribers: 2500000, views: 500000000, videos: 356 }
    },
    jpg: {
      subscribers: '450K+',
      totalViews:  'N/A',
      videoCount:  'N/A',
      liveLoaded:  false,
      raw: { subscribers: 450000, views: 0, videos: 0 }
    }
  };

  function fmt(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K';
    return String(n);
  }

  async function fetchChannel(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const stats = json.items?.[0]?.statistics;
    if (!stats) throw new Error('No statistics returned');
    const subs  = parseInt(stats.subscriberCount, 10);
    const views = parseInt(stats.viewCount, 10);
    const vids  = parseInt(stats.videoCount, 10);
    return {
      subscribers: fmt(subs),
      totalViews:  fmt(views),
      videoCount:  String(vids),
      liveLoaded:  true,
      raw: { subscribers: subs, views, videos: vids }
    };
  }

  async function init() {
    window.LIVE = JSON.parse(JSON.stringify(STATIC));

    const keys    = Object.keys(CHANNELS);
    const results = await Promise.allSettled(
      keys.map(k => fetchChannel(CHANNELS[k]))
    );

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        window.LIVE[keys[i]] = r.value;
      }
    });

    document.dispatchEvent(new Event('liveDataReady'));
  }

  init();
})();
