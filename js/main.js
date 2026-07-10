/* ===== ProspEngine — front-end logic (live API, per server, EN/NL) ===== */
const API = window.PROSP_API || "";
const AUTH = window.PROSP_AUTH;
const T = (k) => (window.t ? window.t(k) : k);

/* ---------- publieke API helper (geen login nodig, wel ?guild) ---------- */
async function publicGet(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
  return r.json();
}
const initials = (n) => (n || "?").slice(0, 2).toUpperCase();
const withGuild = (path) => {
  const gid = AUTH && AUTH.getGuild();
  return gid ? `${path}${path.includes("?") ? "&" : "?"}guild=${gid}` : path;
};

/* ---------- Reveal / count-up / glow / toast ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

function countUp(el, target) {
  let cur = 0; const step = Math.max(1, target / 60);
  const tick = () => {
    cur += step;
    if (cur >= target) { el.textContent = target.toLocaleString(); return; }
    el.textContent = Math.floor(cur).toLocaleString();
    requestAnimationFrame(tick);
  };
  tick();
}
document.querySelectorAll(".feature").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
  });
});
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2400);
}

/* =====================================================
   LANDING — serverteller (eerste server, publiek)
===================================================== */
const stripEls = document.querySelectorAll(".stat-strip [data-count]");
if (stripEls.length) {
  publicGet("/api/data").then((d) => {
    const members = d.members || {};
    const seasonNo = String(d.season?.number ?? "1");
    const ss = (d.season_stats || {})[seasonNo] || {};
    let tournaments = 0;
    Object.values(ss).forEach((s) => { tournaments += (s.tournaments_played || 0); });
    const vals = [d.server?.member_count || Object.keys(members).length, Object.keys(members).length, tournaments, 99];
    stripEls.forEach((el, i) => countUp(el, vals[i] ?? 0));
  }).catch(() => stripEls.forEach((el) => (el.textContent = "—")));
}

/* =====================================================
   SERVER-BAR: Discord-login + server-kiezer (gedeeld)
   Rendert in #serverBar; roept onSelect(guildId) aan.
===================================================== */
async function initServerBar(barId, onSelect) {
  const bar = document.getElementById(barId);
  if (!bar) return;

  if (!AUTH || !AUTH.isLoggedIn()) {
    bar.innerHTML = `<div class="server-bar-inner">
      <span class="sb-hint">${T("auth.loginPrompt")}</span>
      <a class="btn btn-primary" id="discordLoginBtn">${T("auth.login")}</a>
    </div>`;
    const btn = document.getElementById("discordLoginBtn");
    if (btn) btn.href = AUTH ? AUTH.loginUrl() : "#";
    onSelect(null);
    return;
  }

  bar.innerHTML = `<div class="server-bar-inner"><span class="sb-hint">${T("auth.loading")}</span></div>`;
  let guilds;
  try {
    guilds = await AUTH.myGuilds();
  } catch (e) {
    if (String(e).includes("401")) { renderLoggedOut(); return; }
    bar.innerHTML = `<div class="server-bar-inner"><span class="sb-hint">${e}</span></div>`;
    return;
  }

  function renderLoggedOut() {
    AUTH.clearToken();
    initServerBar(barId, onSelect);
  }

  if (!guilds.length) {
    bar.innerHTML = `<div class="server-bar-inner">
      <span class="sb-hint">${T("auth.noServers")}</span>
      <button class="btn btn-ghost" id="logoutBtn">${T("auth.logout")}</button>
    </div>`;
    document.getElementById("logoutBtn").addEventListener("click", renderLoggedOut);
    onSelect(null);
    return;
  }

  // huidige selectie bepalen
  let current = AUTH.getGuild();
  if (!guilds.some((g) => g.id === current)) { current = guilds[0].id; AUTH.setGuild(current); }

  const options = guilds.map((g) =>
    `<option value="${g.id}" ${g.id === current ? "selected" : ""}>${g.name}</option>`).join("");
  bar.innerHTML = `<div class="server-bar-inner">
    <label class="sb-label">${T("auth.server")}</label>
    <select id="serverSelect" class="sb-select">${options}</select>
    <button class="btn btn-ghost" id="logoutBtn">${T("auth.logout")}</button>
  </div>`;

  document.getElementById("serverSelect").addEventListener("change", (e) => {
    AUTH.setGuild(e.target.value);
    onSelect(e.target.value);
  });
  document.getElementById("logoutBtn").addEventListener("click", renderLoggedOut);
  onSelect(current);
}

/* =====================================================
   FEATURE-IDS (matchen met data.json "features")
===================================================== */
const FEATURE_IDS = [
  { id: "verificatie", icon: "🛡️" }, { id: "rank", icon: "⭐" }, { id: "toernooi", icon: "🏆" },
  { id: "elo", icon: "📈" }, { id: "weekly", icon: "📅" }, { id: "lfg", icon: "🎮" },
  { id: "clips", icon: "🎬" }, { id: "challenge", icon: "⚔️" }, { id: "poll", icon: "📊" },
  { id: "warnings", icon: "⚠️" }, { id: "birthday", icon: "🎂" }, { id: "profile", icon: "🪪" },
  { id: "giveaway", icon: "🎁" }, { id: "training", icon: "🎯" }, { id: "quotes", icon: "💬" },
  { id: "leveling", icon: "🆙" }, { id: "minigames", icon: "🕹️" },
];

/* =====================================================
   DASHBOARD — Discord-login + per-server feature toggles
===================================================== */
const dashView = document.getElementById("dashView");
if (dashView && document.getElementById("toggleGrid")) {
  const grid = document.getElementById("toggleGrid");
  let currentGuild = null;

  function renderToggles(features) {
    grid.innerHTML = "";
    FEATURE_IDS.forEach((f) => {
      const on = features[f.id] !== false;
      const card = document.createElement("div");
      card.className = "toggle-card" + (on ? " on" : "");
      card.innerHTML = `
        <div class="t-icon">${f.icon}</div>
        <div class="t-body"><b>${T("feat." + f.id + ".t")}</b><small>${T("feat." + f.id + ".d")}</small></div>
        <label class="switch"><input type="checkbox" data-id="${f.id}" ${on ? "checked" : ""}/><span class="slider"></span></label>`;
      grid.appendChild(card);
    });
    grid.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("change", () => {
        inp.closest(".toggle-card").classList.toggle("on", inp.checked);
        document.getElementById("saveStatus").textContent = T("dash.saveStatusUnsaved");
      });
    });
  }
  const currentFeatureState = () => {
    const f = {};
    grid.querySelectorAll("input").forEach((inp) => { f[inp.dataset.id] = inp.checked; });
    return f;
  };

  function renderShareLink(gid) {
    const el = document.getElementById("shareLink");
    if (!el) return;
    if (!gid) { el.style.display = "none"; return; }
    const url = `${location.origin}${location.pathname.replace(/dashboard\.html$/, "stats.html")}?server=${gid}`;
    el.style.display = "";
    el.innerHTML = `<span class="share-label">${T("dash.shareLabel")}</span>
      <input class="share-input" id="shareInput" readonly value="${url}" />
      <button class="btn btn-ghost" id="copyShareBtn">${T("dash.copy")}</button>`;
    document.getElementById("copyShareBtn").addEventListener("click", () => {
      const inp = document.getElementById("shareInput");
      inp.select();
      navigator.clipboard?.writeText(inp.value);
      showToast(T("dash.copied"));
    });
  }

  async function loadServer(gid) {
    currentGuild = gid;
    const saveBar = document.querySelector(".save-bar");
    renderShareLink(gid);
    if (!gid) { grid.innerHTML = `<p style="color:var(--muted)">${T("dash.pickServer")}</p>`; if (saveBar) saveBar.style.display = "none"; return; }
    if (saveBar) saveBar.style.display = "";
    grid.innerHTML = `<p style="color:var(--muted)">${T("auth.loading")}</p>`;
    try {
      const s = await AUTH.apiGet(withGuild("/api/settings"));
      renderToggles(s.features || {});
      document.getElementById("saveStatus").textContent = T("dash.saveStatus");
    } catch (e) {
      grid.innerHTML = `<p style="color:var(--muted)">${T("dash.loadError")}${e}</p>`;
    }
  }

  initServerBar("serverBar", loadServer);
  document.addEventListener("langchange", () => { if (grid.querySelector("input")) renderToggles(currentFeatureState()); });

  document.getElementById("saveBtn").addEventListener("click", async () => {
    if (!currentGuild) return;
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;
    try {
      await AUTH.apiPost(withGuild("/api/features"), { features: currentFeatureState() });
      document.getElementById("saveStatus").textContent = T("dash.saveStatusSaved");
      showToast(T("dash.toastSaved"));
    } catch (e) {
      showToast("⚠️ " + String(e).replace("Error: ", ""));
    } finally { btn.disabled = false; }
  });
}

/* =====================================================
   STATS — per-server spelers + leaderboard
===================================================== */
const searchInput = document.getElementById("playerSearch");
if (searchInput) {
  const resultBox = document.getElementById("playerResult");
  const lb = document.getElementById("leaderboard");
  const lbWrap = document.getElementById("lbWrap");
  const searchWrap = document.querySelector(".search-box");
  let PLAYERS = [];

  const ratio = (p) => { const g = p.wins + p.losses; return g ? Math.round((p.wins / g) * 100) : 0; };

  function renderPlayer(p) {
    const r = ratio(p);
    const av = p.avatar
      ? `<img src="${p.avatar}" alt="" style="width:84px;height:84px;border-radius:20px;object-fit:cover;box-shadow:var(--shadow-glow)" />`
      : `<div class="avatar">${initials(p.name)}</div>`;
    return `<div class="player-card reveal in">
      <div class="player-top">${av}
        <div><h2>${p.name}</h2><span class="rank-badge">🏅 ${p.rank}</span></div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-size:34px;font-weight:900;color:var(--blue-bright)">${p.elo}</div>
          <div style="color:var(--muted);font-size:13px">${T("stats.eloRating")}</div>
        </div>
      </div>
      <div class="player-grid">
        <div class="mini-stat"><div class="v green">${p.wins}</div><div class="k">${T("stats.winsLabel")}</div></div>
        <div class="mini-stat"><div class="v red">${p.losses}</div><div class="k">${T("stats.losses")}</div></div>
        <div class="mini-stat"><div class="v blue">Lvl ${p.level}</div><div class="k">${T("stats.level")}</div></div>
        <div class="mini-stat"><div class="v">${p.tournaments_won}</div><div class="k">${T("stats.tournaments")}</div></div>
      </div>
      <div class="bar-row"><div class="bar-label"><span>${T("stats.winrate")}</span><span>${r}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${r}%"></div></div></div>
      <div class="bar-row"><div class="bar-label"><span>${T("stats.xpToNext")}</span><span>${p.xp} ${T("stats.xp")}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(p.xp % 100, 100)}%"></div></div></div>
    </div>`;
  }

  function search() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { resultBox.innerHTML = ""; return; }
    const p = PLAYERS.find((x) => x.name.toLowerCase().includes(q));
    resultBox.innerHTML = p ? renderPlayer(p)
      : `<div class="player-card"><p style="text-align:center;color:var(--muted)">${T("stats.notFound")} "<b>${searchInput.value}</b>".</p></div>`;
  }
  document.getElementById("searchBtn").addEventListener("click", search);
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });

  function buildLeaderboard() {
    const medal = ["gold", "silver", "bronze"];
    lb.querySelectorAll(".lb-row:not(.head)").forEach((n) => n.remove());
    PLAYERS.slice().sort((a, b) => b.elo - a.elo).forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "lb-row"; row.style.cursor = "pointer";
      const av = p.avatar
        ? `<img src="${p.avatar}" alt="" style="width:34px;height:34px;border-radius:9px;object-fit:cover" />`
        : `<span class="av">${initials(p.name)}</span>`;
      row.innerHTML = `<div class="pos ${medal[i] || ""}">${i + 1}</div>
        <div class="pname">${av}${p.name}</div>
        <div style="font-weight:800;color:var(--blue-bright)">${p.elo}</div>
        <div class="col-hide">${p.wins}</div><div>${ratio(p)}%</div>`;
      row.addEventListener("click", () => { searchInput.value = p.name; search(); window.scrollTo({ top: 0, behavior: "smooth" }); });
      lb.appendChild(row);
    });
  }
  document.addEventListener("langchange", () => { if (PLAYERS.length) { buildLeaderboard(); if (searchInput.value.trim()) search(); } });

  function showStatsUI(show) {
    [searchWrap, lbWrap].forEach((el) => { if (el) el.style.display = show ? "" : "none"; });
  }

  async function loadServer(gid) {
    if (!gid) {
      showStatsUI(false);
      resultBox.innerHTML = `<div class="player-card"><p style="text-align:center;color:var(--muted)">${T("stats.loginPrompt")}</p></div>`;
      return;
    }
    showStatsUI(true);
    resultBox.innerHTML = "";
    try {
      const d = await publicGet(`/api/data?guild=${encodeURIComponent(gid)}`);
      const badge = document.getElementById("statsServerBadge");
      if (badge) {
        badge.innerHTML = d.server?.icon
          ? `<img src="${d.server.icon}" alt="" /> ${d.server?.name || ""}`
          : `🎮 ${d.server?.name || ""}`;
        badge.style.display = d.server?.name ? "" : "none";
      }
      const members = d.members || {};
      const seasonNo = String(d.season?.number ?? "1");
      const ss = (d.season_stats || {})[seasonNo] || {};
      PLAYERS = Object.entries(members).map(([id, m]) => {
        const s = ss[id] || {};
        return { id, name: m.name, avatar: m.avatar, rank: m.rank || "Unranked",
          elo: m.elo || 0, level: m.level || 0, xp: m.xp || 0,
          wins: s.wins || 0, losses: s.losses || 0,
          tournaments_won: s.tournaments_won || 0, tournaments_played: s.tournaments_played || 0 };
      });
      if (!PLAYERS.length) {
        resultBox.innerHTML = `<div class="player-card"><p style="text-align:center;color:var(--muted)">${T("stats.noPlayers")}</p></div>`;
        buildLeaderboard(); return;
      }
      buildLeaderboard();
      searchInput.value = PLAYERS.slice().sort((a, b) => b.elo - a.elo)[0].name;
      search();
    } catch (err) {
      resultBox.innerHTML = `<div class="player-card"><p style="text-align:center;color:var(--muted)">${T("stats.noConnection")}<br /><small>${err}</small></p></div>`;
    }
  }

  // Publieke per-server link: stats.html?server=<guildId> toont direct die server (geen login/kiezer).
  const urlServer = new URLSearchParams(location.search).get("server");
  if (urlServer) {
    const bar = document.getElementById("serverBar");
    if (bar) bar.style.display = "none";
    loadServer(urlServer);
  } else {
    initServerBar("serverBar", loadServer);
  }
}
