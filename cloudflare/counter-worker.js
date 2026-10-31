/**
 * 自托管访客统计 · Cloudflare Worker（经典 Service Worker 格式，兼容性最好）
 *
 * 部署步骤（在 Cloudflare 面板）：
 * 1. 建一个 KV namespace，记下它的 ID
 * 2. 新建 / 编辑一个 Worker，把本文件内容粘贴进去
 * 3. 在 Worker 的「Settings → Variables → KV Namespace Bindings」里，
 *    添加一个绑定：Variable name = COUNTER，Value = 上面建的 namespace
 * 4. 在「Workers & Pages → 你的域名 blog.313270009.xyz → Workers Routes」里，
 *    添加路由：Route = blog.313270009.xyz/api/* ，Service = 这个 Worker
 *    （这样 /api/count 走 Worker，其余路径仍由 GitHub Pages 经 CF 代理）
 *
 * 接口：
 *   GET /api/count?action=hit&type=site_pv
 *   GET /api/count?action=hit&type=page_pv&path=/posts/xxx/
 *   GET /api/count?action=hit&type=site_uv
 *   GET /api/count?action=get&type=site_uv
 * 返回：{ "type": "...", "value": 123 }
 */

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  const type = url.searchParams.get('type');       // site_pv | page_pv | site_uv
  const action = url.searchParams.get('action');   // hit | get
  const path = url.searchParams.get('path') || '/';

  if (!type) {
    return new Response(JSON.stringify({ error: 'missing type' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  // 页面 PV 按路径区分；站点 PV / UV 用固定 key
  const key = type === 'page_pv' ? 'pv:' + path : type;
  let val = parseInt(await COUNTER.get(key) || '0', 10);

  if (action === 'hit') {
    val += 1;
    // 异步写回，不阻塞响应
    event.waitUntil(COUNTER.put(key, String(val)));
  }

  return new Response(JSON.stringify({ type, value: val }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    }
  });
}
