/*
 * 自托管访客统计前端
 * 数据源：同源 /api/count（Cloudflare Worker + KV）
 * 替代不稳定的不蒜子公共服务（busuanzi.ibruce.info）
 *
 * 职责：取数填充 + 中文标签 + 域名白名单（本地预览不显示）+ 超时移除
 */
(function () {
  'use strict';

  var API = '/api/count';
  var UV_FLAG = '_my_uv=1';
  // 放行规则：本站主域 313270009.xyz 下的任意子域名（blog / shop / www / ...）均显示统计，
  // 再加上 GitHub Pages 默认域名。新增子域名无需改这里，只要该子域名已加 CF 路由
  // <sub>.313270009.xyz/api/* → site-counter 即可。计数后端按 hostname 隔离，各子域名互不串味。
  function isAllowedHost(host) {
    if (host === 'ljy313270009.github.io') return true;
    return host === '313270009.xyz' || host.endsWith('.313270009.xyz');
  }

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
      .catch(function () { /* 静默失败，由超时逻辑兜底 */ });
  }

  var box = document.querySelector('.busuanzi-count');

  // 本地预览（localhost 等）或不在放行域名内，不显示统计
  if (!box || !isAllowedHost(location.hostname)) {
    if (box && box.parentNode) box.parentNode.removeChild(box);
    return;
  }

  // ---- 取数填充 ----
  req('action=hit&type=site_pv', function (v) { setText('busuanzi_value_site_pv', v); });

  var path = location.pathname;
  req('action=hit&type=page_pv&path=' + encodeURIComponent(path), function (v) {
    setText('busuanzi_value_page_pv', v);
  });

  if (document.cookie.indexOf(UV_FLAG) === -1) {
    req('action=hit&type=site_uv', function (v) { setText('busuanzi_value_site_uv', v); });
    var exp = new Date(Date.now() + 86400000).toUTCString();
    document.cookie = '_my_uv=1; expires=' + exp + '; path=/';
  } else {
    req('action=get&type=site_uv', function (v) { setText('busuanzi_value_site_uv', v); });
  }

  // ---- 数据填好后加中文标签；任一指标取到即保留容器，全失败才移除 ----
  function decorate(wrap, prefix, suffix) {
    if (!wrap) return;
    wrap.insertBefore(document.createTextNode(prefix), wrap.firstChild);
    wrap.appendChild(document.createTextNode(suffix));
  }

  var waited = 0, uvDone = false, pvDone = false;
  var timer = setInterval(function () {
    waited += 1;
    var uv = el('busuanzi_value_site_uv');
    var pv = el('busuanzi_value_site_pv');
    if (uv && uv.textContent && uv.textContent !== '-' && !uvDone) {
      decorate(uv.parentNode, '本站访客数 ', ' 人'); uvDone = true;
    }
    if (pv && pv.textContent && pv.textContent !== '-' && !pvDone) {
      decorate(pv.parentNode, '本站总访问量 ', ' 次'); pvDone = true;
    }
    if ((uvDone && pvDone) || waited > 40) {
      clearInterval(timer);
      // 一个都没取到才移除容器，避免单点请求失败导致整块消失
      if (!uvDone && !pvDone && box.parentNode) box.parentNode.removeChild(box);
    }
  }, 250);
})();
