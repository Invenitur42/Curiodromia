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
  const d = new Date(iso.replace(" ", "T") + "Z");
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return Math.floor(secs / 60) + "m ago";
  if (secs < 86400) return Math.floor(secs / 3600) + "h ago";
  return Math.floor(secs / 86400) + "d ago";
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

function renderNav(activeHref) {
  const host = document.getElementById("navHost");
  if (!host) return;
  host.innerHTML = `
    <header class="navbar">
      <h1 class="brand">Agora<span>.</span></h1>
      <nav>
        <a href="/home.html" data-href="/home.html">Home</a>
        <a href="/classrooms.html" data-href="/classrooms.html">Classrooms</a>
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
