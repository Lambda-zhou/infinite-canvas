// ============================================================
// picpi CORS 代理（Pages Functions 版）
// 适用: 你的 drawing.cc.cd 是 Cloudflare Pages 项目
// 用法: 把本文件放到 Pages 项目根目录的 functions/api/[[path]].ts
//       然后重新部署 Pages（git push / wrangler pages deploy / 控制台上传均可）
// 效果: /api/* 由本 Function 接管 → 转发 https://api.picpi.top/v1/*
//       其他路径照常走静态页面, 互不干扰
// 前端渠道配置: baseUrl = https://drawing.cc.cd/api
// ============================================================

const UPSTREAM = 'https://api.picpi.top'; // 目标上游(可改)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const url = new URL(request.url);

  // 1) 浏览器预检请求: 直接放行
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 2) 路径转换: /api/xxx → /v1/xxx （去掉 /api 前缀, 兜底补 /v1）
  let path = url.pathname.replace(/^\/api/, '') || '/';
  if (!path.startsWith('/')) path = '/' + path;
  if (!path.startsWith('/v1')) path = '/v1' + path;

  const target = new URL(UPSTREAM + path);
  target.search = url.search; // 保留 query 参数

  // 3) 透传请求头(去掉 host, 保留 Authorization 等), body 原样转发
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('Origin', UPSTREAM); // 让上游看到同源请求

  const resp = await fetch(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
  });

  // 4) 响应补 CORS 头后返回
  const out = new Response(resp.body, resp);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    out.headers.set(k, v);
  }
  return out;
};
