/*
 * 自托管访客统计前端
 * 数据源：同源 /api/count（Cloudflare Worker + KV）
 * 替代不稳定的不蒜子公共服务（busuanzi.ibruce.info）
 */
(function () {
  'use strict';

  var API = '/api/count';
  var UV_FLAG = '_my_uv=1';

  function el(id) { return document.getElementById(id); }

  function fmt(n) {
    n = Number(n) || 0;
    return n.toLocaleString('en-US');
  }

  function setText(id, v) {
    var node = el(id);
    if (node) node.textContent = fmt(v);
  }

  function req(params, cb) {
    fetch(API + '?' + params, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && typeof d.value !== 'undefined') cb(d.value); })
      .catch(function () { /* 静默失败，不影响页面 */ });
  }

  // 站点 PV：每次页面加载 +1
  req('action=hit&type=site_pv', function (v) { setText('busuanzi_value_site_pv', v); });

  // 页面 PV：按路径区分（首页 /、文章 /posts/xxx/）
  var path = location.pathname;
  req('action=hit&type=page_pv&path=' + encodeURIComponent(path), function (v) {
    setText('busuanzi_value_page_pv', v);
  });

  // 站点 UV：cookie 去重（1 天记一次）
  if (document.cookie.indexOf(UV_FLAG) === -1) {
    req('action=hit&type=site_uv', function (v) { setText('busuanzi_value_site_uv', v); });
    var exp = new Date(Date.now() + 86400000).toUTCString();
    document.cookie = '_my_uv=1; expires=' + exp + '; path=/';
  } else {
    req('action=get&type=site_uv', function (v) { setText('busuanzi_value_site_uv', v); });
  }
})();
