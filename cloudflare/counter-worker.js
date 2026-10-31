/**
 * 自托管访客统计 · Cloudflare Worker（经典格式，多站点共用）
 *
 * 设计目标：
 * - 一个 Worker + 一个 KV，服务账户下任意子域名（blog / shop / ...）
 * - 计数 key 按 hostname 隔离，各站点统计互不干扰、不会串味
 * - 接口与前端 source/js/my-counter.js 完全兼容
 *
 * 部署：
 * 1. 建一个 KV namespace（变量名 COUNTER），记下它的 ID
 * 2. 上传本文件为一个 Worker（如 site-counter），绑定 COUNTER
 * 3. 在每个需要统计的子域名上加路由 <sub>.313270009.xyz/api/* → 该 Worker
 * 4. 前端 my-counter.js 的 HOSTS 白名单加入该子域名即可
 *
 * 接口：
 *   GET /api/count?action=hit&type=site_pv
 *   GET /api/count?action=hit&type=page_pv&path=/posts/xxx/
 *   GET /api/count?action=hit&type=site_uv
 *   GET /api/count?action=get&type=site_uv
 * 返回：{ "type": "...", "value": 123 }
 *
 * 说明：
 * - site_pv：站点总浏览量（每次页面加载 +1）
 * - site_uv：站点独立访客（前端按天去重 cookie，每日首访 +1）
 * - page_pv ：单页浏览量（按 归一化路径 隔离）
 * 以上均带 hostname 前缀，多子域名各自独立计数。
 */

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  const host = url.hostname;                       // 如 blog.313270009.xyz
  const type = url.searchParams.get('type');       // site_pv | page_pv | site_uv
  const action = url.searchParams.get('action');   // hit | get
  let path = url.searchParams.get('path') || '/';
  // 路径归一化：去掉 index.html、去掉尾部斜杠，避免同页被拆成多次计数
  path = path.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';

  if (!type) return json({ error: 'missing type' }, 400);

  // 各站点按 hostname 隔离，子域名之间统计互不串味
  let key;
  if (type === 'page_pv')      key = 'pv:'  + host + ':' + path;
  else if (type === 'site_uv') key = 'uv:'  + host;       // 独立访客（前端按天去重）
  else                         key = 'spv:' + host;       // 站点总浏览量

  let val = parseInt(await COUNTER.get(key) || '0', 10);

  if (action === 'hit') {
    val += 1;
    // 异步写回，不阻塞响应
    event.waitUntil(COUNTER.put(key, String(val)));
  }

  return json({ type, value: val });
}
