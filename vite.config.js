import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';
import { pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFileToProcessEnv(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf-8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // "..." 또는 '...'로 감싼 값 제거
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) process.env[key] = value;
    });
  } catch {
    /* ignore */
  }
}

// Vite는 import.meta.env에는 VITE_*를 중심으로 주입하지만, server-side api는
// process.env.SUPABASE_*를 직접 읽는다. 그래서 dev 서버 시작 시점에 로컬 env를 주입한다.
loadEnvFileToProcessEnv(path.join(__dirname, '.env'));
loadEnvFileToProcessEnv(path.join(__dirname, '.env.local'));

export default defineConfig({
  root: '.',
  // dist를 file://로 열거나 서브패스에 올릴 때 /assets 404 방지 (상대 경로로 빌드)
  base: './',
  publicDir: 'public',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        login: path.resolve(__dirname, 'login.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  plugins: [
    {
      name: 'bps-api-middleware',
      configureServer(server) {
        // Vite 기본 loadEnv는 VITE_ 접두사만 노출한다. `/api/*` 핸들러는 SUPABASE_SERVICE_ROLE_KEY 등
        // 비‑VITE 키가 필요하므로, dev 서버 기동 시 .env / .env.local 전체를 process.env에 합친다.
        // (prefix `''` → `key.startsWith('')`가 항상 true라 파싱된 모든 키가 포함됨)
        const envDir = server.config.envDir
          ? path.resolve(server.config.root, server.config.envDir)
          : server.config.root;
        Object.assign(process.env, loadEnv(server.config.mode, envDir, ''));

        // `api/*.js`는 Cloudflare Workers 스타일(`export default { fetch(request) { ... } }`)로 작성됨.
        // Vite dev 서버에서 `/api/*`를 실제로 실행하지 않고 파일 소스가 그대로 서빙되는 문제가 있어,
        // 여기서 `/api/...` 요청을 대응 JS 모듈의 `fetch()`로 라우팅한다.
        server.middlewares.use('/api', async (req, res, next) => {
          try {
            const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
            const pathname = url.pathname; // e.g. /api/auth/profile-status

            const apiSubPath = pathname.replace(/^\/api\//, ''); // auth/profile-status
            const modulePath = path.join(__dirname, 'api', `${apiSubPath}.js`);
            if (!fs.existsSync(modulePath)) return next();

            // Request body를 buffer로 읽어서 workers-style 모듈에 넘긴다.
            let bodyBuffer = undefined;
            if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
              const chunks = [];
              await new Promise((resolve, reject) => {
                req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                req.on('end', resolve);
                req.on('error', reject);
              });
              bodyBuffer = Buffer.concat(chunks);
            }

            const request = new Request(url.toString(), {
              method: req.method,
              headers: req.headers,
              body: bodyBuffer,
            });

            const mod = await import(pathToFileURL(modulePath).href);
            if (!mod || !mod.default || typeof mod.default.fetch !== 'function') {
              res.statusCode = 500;
              res.setHeader('content-type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ ok: false, error: 'Invalid api module' }));
              return;
            }

            const workerRes = await mod.default.fetch(request);
            res.statusCode = workerRes.status || 200;

            // Headers 복사
            workerRes.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });

            const text = await workerRes.text();
            res.end(text);
          } catch (e) {
            // dev에서 문제 원인 파악을 위해 JSON 에러로 반환
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                ok: false,
                error: e?.message || String(e),
              })
            );
          }
        });
      },
    },
  ],
});
