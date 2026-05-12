// ====== 新闻抓取脚本（由 GitHub Actions 每小时自动运行）======
const fs = require('fs');

const CATEGORIES = {
  hot:    { name: '热点', lid: '2511', icon: '🔥' },
  china:  { name: '国内', lid: '2510', icon: '🇨🇳' },
  finance:{ name: '财经', lid: '2509', icon: '💰' }
};

async function fetchSinaNews(lid, num = 25) {
  try {
    const url = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=${lid}&k=&num=${num}&page=1`;
    const resp = await fetch(url);
    const json = await resp.json();
    const data = (json.result && json.result.data) || [];
    return data.map(item => ({
      title: item.title || '',
      intro: (item.intro || item.summary || '').replace(/<[^>]*>/g, '').substring(0, 100),
      url: item.wapurl || item.url || '',
      time: item.ctime || item.mtime || item.intime || '',
      source: '新浪新闻'
    }));
  } catch (e) {
    console.error('新浪新闻获取失败:', e.message);
    return [];
  }
}

async function fetch36krNews() {
  try {
    const resp = await fetch('https://36kr.com/feed');
    const xml = await resp.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const c = match[1];
      const title = (c.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
      const link = (c.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '';
      const desc = ((c.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '').replace(/<[^>]*>/g, '').substring(0, 100);
      if (title && link) {
        items.push({ title: title.trim(), intro: desc.trim(), url: link.trim(), time: '', source: '36氪' });
      }
    }
    return items;
  } catch (e) {
    console.error('36氪获取失败:', e.message);
    return [];
  }
}

(async () => {
  console.log('开始抓取新闻...');
  const result = {};

  for (const [key, cat] of Object.entries(CATEGORIES)) {
    console.log(`  抓取: ${cat.name}`);
    result[key] = await fetchSinaNews(cat.lid);
  }

  // 热点额外加 36kr
  console.log('  抓取: 36氪');
  const krNews = await fetch36krNews();
  if (krNews.length > 0) {
    result.hot = [...krNews.slice(0, 5), ...result.hot];
  }

  const output = {
    updated: new Date().toISOString(),
    categories: CATEGORIES,
    news: result
  };

  fs.writeFileSync('news.json', JSON.stringify(output, null, 2), 'utf-8');
  console.log('新闻抓取完成！总计: ' +
    Object.values(result).reduce((sum, arr) => sum + arr.length, 0) + ' 条');
})();
