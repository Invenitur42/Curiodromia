/* Shared helpers used by every page. Plain JS, no build step, no framework. */

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: opts.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).replace(" ", "T") + (String(iso).endsWith("Z") ? "" : "Z"));
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return Math.floor(secs / 60) + "m ago";
  if (secs < 86400) return Math.floor(secs / 3600) + "h ago";
  if (secs < 604800) return Math.floor(secs / 86400) + "d ago";
  return Math.floor(secs / 604800) + "w ago";
}

async function requireSession({ allowPreOnboarding = false } = {}) {
  const { user, needsOnboarding } = await api("/api/me");
  if (!user) {
    location.href = "/index.html";
    throw new Error("redirecting");
  }
  if (needsOnboarding && !allowPreOnboarding) {
    location.href = "/onboarding.html";
    throw new Error("redirecting");
  }
  return user;
}

/** Centered brand logo bar used across main app pages */
function renderTopLogo() {
  if (document.querySelector(".top-logo-bar")) return;
  const bar = document.createElement("div");
  bar.className = "top-logo-bar";
  bar.innerHTML = `<a href="/home.html" class="logo-script" aria-label="Curiodromia home">Curiodromia</a>`;
  document.body.prepend(bar);
}

/** Bottom navigation matching the mockups */
function renderBottomNav(active) {
  const existing = document.querySelector(".bottom-nav");
  if (existing) existing.remove();

  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "Main");
  nav.innerHTML = `
    <a href="/home.html" class="${active === "home" ? "active" : ""}" title="Home" aria-label="Home">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5c0-1.5 1.2-2.5 2.5-2.5s2.5 1 2.5 2.5c0 1.2-.8 1.8-1.5 2.3-.7.5-1 1-1 1.7v.5"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/></svg>
    </a>
    <a href="/classrooms.html" class="${active === "classes" ? "active" : ""}" title="Classes" aria-label="Classes">
      <svg viewBox="0 0 24 24"><path d="M5 8h14M5 12h14M5 16h14"/></svg>
    </a>
    <a href="/profile.html" class="${active === "profile" ? "active" : ""}" title="Profile" aria-label="Profile">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>
    </a>
  `;
  document.body.appendChild(nav);
}

/**
 * Left-edge pull-tab back button for second-level pages.
 * @param {string} [fallback='/home.html']
 */
function renderBackPullTab(fallback = "/home.html") {
  if (document.querySelector(".back-pulltab")) return;
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "back-pulltab";
  tab.setAttribute("aria-label", "Go back");
  tab.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  `;
  tab.addEventListener("click", () => {
    if (window.history.length > 1) history.back();
    else location.href = fallback;
  });
  document.body.appendChild(tab);
}

/** Legacy top nav for secondary pages */
function renderNav(activeHref) {
  renderTopLogo();
  renderBackPullTab(activeHref || "/home.html");
  const host = document.getElementById("navHost");
  if (host) host.innerHTML = ""; // logo bar replaces old navbar
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

/** Render media attachment HTML for feeds and detail pages */
function renderMediaBlock(mediaType, mediaUrl, { large = false } = {}) {
  if (!mediaUrl || !mediaType) return "";
  const cls = large ? "media-block media-block--large" : "media-block";
  if (mediaType === "image") {
    return `<div class="${cls}"><img src="${escapeHtml(mediaUrl)}" alt="Attached image" loading="lazy" /></div>`;
  }
  if (mediaType === "video") {
    return `<div class="${cls}"><video src="${escapeHtml(mediaUrl)}" controls playsinline preload="metadata"></video></div>`;
  }
  if (mediaType === "audio") {
    return `
      <div class="${cls} audio-player">
        <div class="audio-player-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <audio src="${escapeHtml(mediaUrl)}" controls preload="metadata"></audio>
      </div>`;
  }
  return "";
}
