/* Shared helpers used by every page. Plain JS, no build step, no framework. */

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
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

/**
 * Ensures the visitor is logged in (and onboarded, unless the current
 * page is allowed to skip that check). Redirects otherwise.
 * Returns the current user object.
 */
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

/** Bottom navigation matching the mockups.
 *  Icons: ? (Home/Questions), = (Classes), person silhouette (Profile)
 */
function renderBottomNav(active) {
  // active: 'home' | 'classes' | 'profile'
  const host = document.getElementById("bottomNavHost") || document.body;
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

/** Legacy top nav kept for secondary pages (question, classroom, etc.) */
function renderNav(activeHref) {
  const host = document.getElementById("navHost");
  if (!host) return;
  host.innerHTML = `
    <header class="navbar">
      <h1 class="brand">Curiodromia</h1>
      <nav>
        <a href="/home.html" data-href="/home.html">Home</a>
        <a href="/classrooms.html" data-href="/classrooms.html">Classes</a>
      </nav>
      <div class="nav-user">
        <a href="/profile.html" id="navProfileLink" title="Your profile">
          <img class="avatar-sm" id="navAvatar" src="/img/default-avatar.svg" alt="" />
        </a>
        <button type="button" class="ghost small" id="navLogout">Log out</button>
      </div>
    </header>`;

  host.querySelectorAll("nav a").forEach((a) => {
    if (a.dataset.href === activeHref) a.classList.add("active");
  });

  document.getElementById("navLogout").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    location.href = "/index.html";
  });

  api("/api/me").then(({ user }) => {
    if (user && user.avatar_url) document.getElementById("navAvatar").src = user.avatar_url;
    if (user) document.getElementById("navProfileLink").href = `/profile.html?id=${user.id}`;
  });
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}
