<img height="78px" src="https://cdn.jsdelivr.net/gh/shrkwy/content.host@master/img/oxycors/logo.png" alt="oxycors" />

 Sick of having to deal with those annoying CORS issues when you try to stream your M3U8/HLS files? Let **oxycors** handle the headache—seamless streaming starts here! 🎥✨

 Here's a lightweight Next.js-based CORS proxy for HLS manifests, segments, YouTube livestreams, and more.


## 🧪 Quick Colab Demo

<a href="https://colab.research.google.com/gist/shrkwy/7ebf0b7cb6cfd7f67077842ddac69e05/oxycors_testing.ipynb" target="_parent"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>

Try out oxycors directly in Google Colab—no setup required! This notebook runs the oxycors server using "npm run dev" and provides a publically accessible link to use.

---

## 🚀 Quick Start

1. **Clone the repo**

   ```bash
   git clone https://github.com/shrkwy/oxycors.git
   cd oxycors
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run locally**
   ; Before starting, set your environment variables (see [Environment Variables](#-environment-variables)).

   ```bash
   npm run dev
   # or
   yarn dev
   ```
   `(By default PORT: 6028)`
   
   Browse 👉 [http://localhost:6028](http://localhost:6028) to test the proxy interface (`src/app/page.tsx`).

---

## 📡 Direct Usage (API Endpoints)

<div style="display:flex; gap:2rem; flex-wrap:wrap;">

**Available Endpoints**

* `/api/proxy/manifest`
* `/api/proxy/segment`
* `/api/proxy/youtube`

**URL Parameters**

* `url` (required) — the original resource URL to proxy (HLS manifest, segment, static file, or YouTube link).

> **Tip:** URL‑encode to prevent incompatibility issues.

</div>

### 👩‍💻 How to use it

For example, to proxy this HLS manifest:

```
https://example.com/live/stream.m3u8
```

1. (Optional) URL‑encode:

   ```
   https%3A%2F%2Fexample.com%2Flive%2Fstream.m3u8
   ```
2. Request via **manifest** endpoint:

   ```
   https://your-domain.com/api/proxy/manifest?url=https%3A%2F%2Fexample.com%2Flive%2Fstream.m3u8
   ```
3. Load into your HLS player (HLS.js example):

   ```js
   const hls = new Hls();
   hls.loadSource('https://your-domain.com/api/proxy/manifest?url=...');
   hls.attachMedia(videoElement);
   ```

---

## 🧠 How It Works

| Endpoint              | Parameters | Purpose                                    | Mechanism                                                                                   |
| --------------------- | ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `/api/proxy/manifest` | `url`      | Provide HLS manifest with proxied elements | • Fetches the HLS manifest from the provided URL                                            |
|                       |            |                                            | • Parses & rewrites segment and sub‑manifest URLs to route through the proxy                |
|                       |            |                                            | • Returns the modified manifest                                                             |
| `/api/proxy/segment`  | `url`      | Proxy segments & static files              | • Fetches media segments (`.ts`, `.m4s`) or static resources (`.jpg`, `.css`, `.mp4`, etc.) |
|                       |            |                                            | • Pipes data directly to the client via proxy                                               |
| `/api/proxy/youtube`  | `url`      | Proxy YouTube livestreams                  | • Extracts live YouTube stream’s HLS manifest                                               |
|                       |            |                                            | • Proxies the manifest and media segments using the above endpoints                         |
|                       |            |                                            | • Will only work if all the functions are handled by the same server                        |

> The homepage (`/`) demo interface (`src/app/page.tsx`) lets you test your proxy server live.

---

## ☁️ Deploy Anywhere

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https://github.com/shrkwy/oxycors)
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/shrkwy/oxycors)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/shrkwy/oxycors)
[![Deploy to Railway](https://railway.app/button.svg)](https://railway.app/new/template?repo=https://github.com/shrkwy/oxycors)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://dashboard.render.com/deploy?repo=https://github.com/shrkwy/oxycors)

---

## 📁 Environment Variables

* **`NEXT_PUBLIC_URL`**
  Declare your Host (e.g. `https://my-oxycors-app.service.app`).

* **`RUNTIME`**
  Mention the runtime to execute proxy functions with; either `nodejs` or `edge`. Will fallback to "edge" if undeclared.

* **`ALLOWED_ORIGINS`**
  ⚠️JSON array of allowed origins (origins that can use your proxy service). If undeclared, all origins are allowed access. Include `""` to permit the homepage:

  ```json
  ["", "https://example1.app", "https://example2.app"]
  ```

---

## 🙌 Contributing

Love it? 🧡 Found a bug? 🐞 PRs and feature requests are welcome!

1. Fork 🔀
2. Branch 🌱
3. Commit 📂
4. PR 🔍

Feel free to contribute in any manner!

---

> © 2025 **oxycors** — backend with Next.js, and built for frictionless streaming. 🎉
