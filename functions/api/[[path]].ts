// ============================================================
// Universal API 代理（Pages Functions 版）—— 一个文件搞定所有 API
//
// 【原理】目标域名放在路径里, 代理自动转发:
//   /api/{目标域名}/{路径}  →  https://{目标域名}/{路径}
//   例: /api/api.picpi.top/v1/models → https://api.picpi.top/v1/models
//        /api/apihub.agnes-ai.com/v1/images/generations → https://apihub.agnes-ai.com/v1/images/generations
//
// 【前端渠道配置】
//   baseUrl = https://drawing.cc.cd/api/api.picpi.top          (picpi)
//   baseUrl = https://drawing.cc.cd/api/apihub.agnes-ai.com     (agnes)
//   或带 /v1 结尾的写法也兼容: https://drawing.cc.cd/api/apihub.agnes-ai.com/v1
//
// 【自动处理】
//   1. 响应补 CORS 头(解决 api.picpi.top 这类未开放 CORS 的服务)
//   2. 生图请求自动剥掉 response_format/output_format
//      (解决 agnes 这类 LiteLLM 图像模型不支持这两个参数的问题;
//       前端两种格式都能解析, 所以剥掉不影响任何服务)
//   3. 域名白名单: 环境变量 PROXY_ALLOWLIST 逗号分隔, 未设置用下方默认值
//
// 【以后加新 API 服务】只需在渠道里填 /api/{新域名}, 不用改本文件!
//   想限制可用域名 → Pages 设置里加环境变量 PROXY_ALLOWLIST=域1,域2
// ============================================================

const DEFAULT_ALLOWLIST = 'api.picpi.top,apihub.agnes-ai.com,api.zzzcoding.org,l0veyou.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1) 浏览器预检请求: 直接放行
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 2) 解析路径: /api/{host}/{path...}
  //    (本文件位于 functions/api/ 下, pathname 形如 /api/api.picpi.top/v1/models)
  const segments = url.pathname.split('/').filter(Boolean);
  segments.shift(); // 去掉 'api'
  const host = segments.shift();
  if (!host) {
    return json(400, { error: 'usage: /api/{target-host}/{path}' }, CORS_HEADERS);
  }

  // 3) host 合法性校验(防注入/SSRF): 只允许 域名[:端口] 形式
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$/i.test(host)) {
    return json(400, { error: 'invalid host: ' + host }, CORS_HEADERS);
  }

  // 4) 白名单检查(环境变量 PROXY_ALLOWLIST 优先, 未设置用默认)
  const allowlist = (env.PROXY_ALLOWLIST || DEFAULT_ALLOWLIST)
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allowlist.includes(host.toLowerCase())) {
    return json(403, { error: `host not allowed: ${host} (add to PROXY_ALLOWLIST if needed)` }, CORS_HEADERS);
  }

  // 5) 拼目标地址: https://{host}/{剩余路径}, 兜底补 /v1
  let path = '/' + segments.join('/');
  if (!path.startsWith('/v1')) path = '/v1' + path;
  const target = new URL('https://' + host + path);
  target.search = url.search; // 保留 query 参数

  // 6) 透传请求头(去掉 host/content-length, 保留 Authorization 等)
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.set('Origin', 'https://' + host);

  // 7) 生图请求: 自动剥掉很多中转站不支持的 response_format / output_format
  let body = request.body;
  if (request.method === 'POST' && path.includes('/images/generations')) {
    try {
      const jsonBody = await request.json();
      delete jsonBody.response_format;
      delete jsonBody.output_format;
      body = JSON.stringify(jsonBody);
      headers.set('content-type', 'application/json');
    } catch (e) {
      // body 不是 JSON(如 FormData) 时原样透传
    }
  }

  // 8) 转发并补 CORS 头
  const resp = await fetch(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : body,
  });

  const out = new Response(resp.body, resp);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    out.headers.set(k, v);
  }
  return out;
};

function json(status, obj, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
