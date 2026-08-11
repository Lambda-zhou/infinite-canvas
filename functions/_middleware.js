// Cloudflare Pages 认证中间件 (Pages Functions)
// 保护 infinite-canvas-b51.pages.dev 源站 + drawing.cc.cd
// 放置位置: GitHub 仓库根目录 functions/_middleware.js
// 密钥优先级: Pages 环境变量 AUTH_TOKEN (Secret) > 下方默认值

const DEFAULT_AUTH_TOKEN = 'PsWxlhs04VTPVMwTgk8Qn3sOmPtZOLS2uhMjcHGPl0Q=';
const COOKIE_NAME = 'drawing_auth_token';

export async function onRequest(context) {
  const { request, next, env } = context;
  // 密钥：Pages 环境变量/Secret 为主，未设置回退默认值
  const AUTH_TOKEN = env.AUTH_TOKEN || DEFAULT_AUTH_TOKEN;
  const url = new URL(request.url);

  // ---- POST /login: 校验密钥并设置 Cookie ----
  if (url.pathname === '/login' && request.method === 'POST') {
    const formData = await request.formData();
    const token = formData.get('token');

    if (token === AUTH_TOKEN) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': `${COOKIE_NAME}=${AUTH_TOKEN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
        }
      });
    }
    // 密钥错误
    return new Response(getLoginHTML(true), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // ---- GET /login: 显示登录页 ----
  if (url.pathname === '/login') {
    return new Response(getLoginHTML(false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // ---- 其他路径: 验证 Cookie ----
  const cookies = request.headers.get('Cookie') || '';
  const authCookie = cookies.split(';').find(c => c.trim().startsWith(`${COOKIE_NAME}=`));
  // 注意: 用 indexOf('=')+1 而非 split('=')[1]，避免 base64 密钥末尾 = 被截断
  const cookieValue = authCookie ? authCookie.slice(authCookie.indexOf('=') + 1).trim() : null;

  if (cookieValue === AUTH_TOKEN) {
    // 已登录，放行到静态资源/页面
    return next();
  }

  // 未登录，跳转登录页
  return new Response(null, {
    status: 302,
    headers: { 'Location': '/login' }
  });
}

function getLoginHTML(isError) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Drawing Canvas - 认证</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #e2e8f0;
    }
    .card {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 16px;
      padding: 48px 40px;
      width: 360px;
      backdrop-filter: blur(10px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    }
    h1 {
      font-size: 20px;
      text-align: center;
      margin-bottom: 8px;
      color: #f8fafc;
    }
    p.sub {
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
      margin-bottom: 32px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 13px;
      color: #cbd5e1;
      margin-bottom: 8px;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px 14px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 8px;
      color: #f8fafc;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="password"]:focus {
      border-color: #6366f1;
    }
    .error {
      display: none;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      text-align: center;
    }
    .error.show { display: block; }
    button {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }
    button:hover { opacity: 0.9; }
    button:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔐 Drawing Canvas</h1>
    <p class="sub">请输入访问密钥</p>
    ${isError ? '<div class="error show">密钥错误，请重试</div>' : '<div class="error">密钥错误，请重试</div>'}
    <form method="POST" action="/login">
      <div class="form-group">
        <label for="token">密钥</label>
        <input type="password" id="token" name="token" required autofocus>
      </div>
      <button type="submit">登 录</button>
    </form>
  </div>
</body>
</html>`;
}
