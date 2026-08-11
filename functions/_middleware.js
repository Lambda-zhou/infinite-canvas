// Cloudflare Worker 认证层
// Worker名称: still-feather-a7c4
// 部署域名: drawing.cc.cd
// 目标Pages: infinite-canvas-b51.pages.dev

// 默认密钥（仅当Worker未设置 AUTH_TOKEN 环境变量/Secret 时生效）
const DEFAULT_AUTH_TOKEN = 'PsWxlhs04VTPVMwTgk8Qn3sOmPtZOLS2uhMjcHGPl0Q=';
const DEFAULT_PAGES_URL = 'https://infinite-canvas-b51.pages.dev';
const COOKIE_NAME = 'drawing_auth_token';

export default {
  async fetch(request, env) {
    // 密钥优先级：Worker环境变量/Secret 为主，未设置时回退到默认值
    const AUTH_TOKEN = env.AUTH_TOKEN || DEFAULT_AUTH_TOKEN;
    const PAGES_URL = env.PAGES_URL || DEFAULT_PAGES_URL;

    const url = new URL(request.url);
    
    // 登录页面逻辑
    if (url.pathname === '/login' && request.method === 'POST') {
      const formData = await request.formData();
      const token = formData.get('token');
      
      if (token === AUTH_TOKEN) {
        // 验证成功，设置Cookie并重定向到首页
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/',
            'Set-Cookie': `${COOKIE_NAME}=${AUTH_TOKEN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
          }
        });
      } else {
        // 验证失败，返回登录页面并显示错误
        return new Response(getLoginHTML(true), {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }
    
    // 检查Cookie认证
    const cookies = request.headers.get('Cookie') || '';
    const authCookie = cookies.split(';').find(c => c.trim().startsWith(`${COOKIE_NAME}=`));
    const cookieValue = authCookie ? authCookie.slice(authCookie.indexOf('=') + 1).trim() : null;
    
    if (cookieValue === AUTH_TOKEN) {
      // 认证通过，转发到Pages
      const pagesUrl = new URL(request.url);
      pagesUrl.protocol = 'https:';
      pagesUrl.host = new URL(PAGES_URL).host;
      
      const pagesRequest = new Request(pagesUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
      });
      
      const response = await fetch(pagesRequest);
      
      // 返回响应（保留原始Headers）
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } else {
      // 未认证，返回登录页面
      if (url.pathname === '/login' && request.method === 'GET') {
        return new Response(getLoginHTML(false), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      } else {
        // 其他路径重定向到登录页
        return new Response(null, {
          status: 302,
          headers: { 'Location': '/login' }
        });
      }
    }
  }
};

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
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0A0D12 0%, #161D2B 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #E9E9EB;
    }
    .container {
      width: 100%;
      max-width: 420px;
      padding: 2rem;
    }
    .card {
      background: #0F131C;
      border-radius: 16px;
      padding: 3rem 2.5rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }
    .subtitle {
      color: #8E8E93;
      font-size: 0.9375rem;
      margin-bottom: 2rem;
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: #C7C7CC;
    }
    input[type="password"] {
      width: 100%;
      padding: 0.875rem 1rem;
      background: #1E2636;
      border: 1px solid #2C3544;
      border-radius: 8px;
      color: #E9E9EB;
      font-size: 1rem;
      transition: all 0.2s;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #38BDF8;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
    }
    .error {
      color: #FF453A;
      font-size: 0.875rem;
      margin-top: 0.5rem;
      display: ${isError ? 'block' : 'none'};
    }
    button {
      width: 100%;
      padding: 0.875rem;
      background: #38BDF8;
      color: #0A0D12;
      border: none;
      border-radius: 999px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    button:hover {
      background: #52C7FA;
      transform: translateY(-1px);
    }
    button:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Drawing Canvas</h1>
      <p class="subtitle">请输入访问密钥</p>
      <form method="POST" action="/login">
        <div class="form-group">
          <label for="token">密钥</label>
          <input type="password" id="token" name="token" required autofocus>
          <div class="error">密钥错误，请重试</div>
        </div>
        <button type="submit">登录</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}
