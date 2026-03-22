const CACHE_NAME = 'star-tarot-cache-v1';

// 核心框架文件（必须成功缓存，否则 PWA 安装失败）
const CORE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './canvas.js',
    './manifest.json'
];

// 1. 安装阶段：强缓存代码，静默缓存 78 张卡牌
self.addEventListener('install', event => {
    // 跳过等待，强制立刻接管浏览器
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            // A. 强制缓存核心文件 (HTML, CSS, JS)
            await cache.addAll(CORE_ASSETS);
            console.log('[SW] 核心框架已缓存');

            // B. 动态生成并静默缓存 78 张牌面 (0.jpg 到 77.jpg)
            // 使用独立 fetch 捕获，确保某一张图缺失不会导致整个 PWA 安装崩溃
            const cardUrls = Array.from({length: 78}, (_, i) => `./assets/cards/${i}.jpg`);
            cardUrls.forEach(url => {
                fetch(url).then(response => {
                    if (response.ok) cache.put(url, response);
                }).catch(() => {
                    console.warn(`[SW] 图片 ${url} 缓存失败，但不影响核心运行`);
                });
            });
        })
    );
});

// 2. 激活阶段：清理旧版本垃圾缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] 清理旧缓存:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    // 立即接管所有打开的页面
    self.clients.claim();
});

// 3. 拦截网络请求：Cache-First (缓存优先策略，实现断网可用)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // 命中缓存，直接返回本地极速加载 (0ms 延迟)
            if (cachedResponse) {
                return cachedResponse;
            }

            // 未命中缓存，去网络请求，并将其存入缓存以备下次使用
            return fetch(event.request).then(networkResponse => {
                // 确保响应有效
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                
                // 克隆响应流并存入缓存
                let responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // 如果断网且没有缓存，可以在这里返回一个默认的离线 fallback 页面或图片
                console.error('[SW] 离线且未命中缓存:', event.request.url);
            });
        })
    );
});