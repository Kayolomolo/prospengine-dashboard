/* ===== ProspEngine — front-end logic (live API, EN/NL) ===== */
const API = window.PROSP_API || "";
const T = (k) => (window.t ? window.t(k) : k);

/* ---------- API helpers ---------- */
async function apiGet(path, token) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(API + path, { headers });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
  return r.json();
}
async function apiPost(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(API + path, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.status);
  return data;
}
const initials = (n) => (n || "?").slice(0, 2).toUpperCase();

/* ---------- Reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* ---------- Count-up ---------- */
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

/* ---------- Feature card glow ---------- */
document.querySelectorAll(".feature").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
  });
});

/* ---------- Toast ---------- */
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2400);
}

/* =====================================================
   LANDING — echte serverteller
===================================================== */
const stripEls = document.querySelectorAll(".stat-strip [data-count]");
if (stripEls.length) {
  apiGet("/api/data").then((d) => {
    const members = d.members || {};
    const seasonNo = String(d.season?.number ?? "1");
    const ss = (d.season_stats || {})[seasonNo] || {};
    let tournaments = 0;
    Object.values(ss).forEach((s) => { tournaments += (s.tournaments_played || 0); });
    const vals = [
      d.server?.member_count || Object.keys(members).length,
      Object.keys(members).length,
      tournaments,
      99,
    ];
    stripEls.forEach((el, i) => countUp(el, vals[i] ?? 0));
  }).catch(() => {
    stripEls.forEach((el) => (el.textContent = "—"));
  });
}

/* =====================================================
   FEATURE-IDS (moeten matchen met data.json "features")
===================================================== */
const FEATURE_IDS = [
  { id: "verificatie", icon: "🛡️" },
  { id: "rank",        icon: "⭐" },
  { id: "toernooi",    icon: "🏆" },
  { id: "elo",         icon: "📈" },
  { id: "weekly",      icon: "📅" },
  { id: "lfg",         icon: "🎮" },
  { id: "clips",       icon: "🎬" },
  { id: "challenge",   icon: "⚔️" },
  { id: "poll",        icon: "📊" },
  { id: "warnings",    icon: "⚠️" },
  { id: "birthday",    icon: "🎂" },
  { id: "profile",     icon: "🪪" },
  { id: "giveaway",    icon: "🎁" },
  { id: "training",    icon: "🎯" },
  { id: "quotes",      icon: "💬" },
  { id: "leveling",    icon: "🆙" },
  { id: "minigames",   icon: "🕹️" },
];

/* =====================================================
   DASHBOARD — echte login + feature toggles
===================================================== */
const loginView = document.getElementById("loginView");
if (loginView) {
  const dashView = document.getElementById("dashView");
  const grid = document.getElementById("toggleGrid");
  const TOKEN_KEY = "prosp_token";
  let token = localStorage.getItem(TOKEN_KEY) || null;

  function renderToggles(features) {
    grid.innerHTML = "";
    FEATURE_IDS.forEach((f) => {
      const on = features[f.id] !== false; // default aan
      const card = document.createElement("div");
      card.className = "toggle-card" + (on ? " on" : "");
      card.innerHTML = `
        <div class="t-icon">${f.icon}</div>
        <div class="t-body"><b>${T("feat." + f.id + ".t")}</b><small>${T("feat." + f.id + ".d")}</small></div>
        <label class="switch">
          <input type="checkbox" data-id="${f.id}" ${on ? "checked" : ""}/>
          <span class="slider"></span>
        </label>`;
      grid.appendChild(card);
    });
    grid.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("change", () => {
        inp.closest(".toggle-card").classList.toggle("on", inp.checked);
        document.getElementById("saveStatus").textContent = T("dash.saveStatusUnsaved");
      });
    });
  }

  function currentFeatureState() {
    const f = {};
    grid.querySelectorAll("input").forEach((inp) => { f[inp.dataset.id] = inp.checked; });
    return f;
  }

  async function openDashboard() {
    loginView.style.display = "none";
    dashView.style.display = "block";
    try {
      const s = await apiGet("/api/settings", token);
      document.getElementById("serverLabel").textContent = localStorage.getItem("prosp_user") || "server";
      renderToggles(s.features || {});
    } catch (err) {
      if (String(err).includes("401")) { logout(); return; }
      grid.innerHTML = `<p style="color:var(--muted)">${T("dash.loadError")}${err}</p>`;
    }
  }

  if (token) openDashboard();

  // taalwissel: toggles opnieuw tekenen met behoud van standen
  document.addEventListener("langchange", () => {
    if (grid && grid.querySelector("input")) renderToggles(currentFeatureState());
  });

  document.getElementById("loginBtn").addEventListener("click", async () => {
    const username = document.getElementById("serverId").value.trim();
    const pass = document.getElementById("pass").value;
    const err = document.getElementById("loginError");
    const btn = document.getElementById("loginBtn");
    err.textContent = ""; btn.textContent = T("dash.loggingIn"); btn.disabled = true;
    try {
      const res = await apiPost("/api/admin/login", { username, password: pass });
      token = res.token;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem("prosp_user", res.username || username);
      await openDashboard();
    } catch (e) {
      err.textContent = String(e).replace("Error: ", "");
    } finally {
      btn.textContent = T("dash.loginBtn"); btn.disabled = false;
    }
  });
  document.getElementById("pass").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("loginBtn").click();
  });

  document.getElementById("saveBtn").addEventListener("click", async () => {
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;
    try {
      await apiPost("/api/features", { features: currentFeatureState() }, token);
      document.getElementById("saveStatus").textContent = T("dash.saveStatusSaved");
      showToast(T("dash.toastSaved"));
    } catch (e) {
      showToast("⚠️ " + String(e).replace("Error: ", ""));
    } finally { btn.disabled = false; }
  });

  function logout() { localStorage.removeItem(TOKEN_KEY); location.reload(); }
  document.getElementById("logoutBtn2")?.addEventListener("click", (e) => { e.preventDefault(); logout(); });
}

/* =====================================================
   STATS — echte spelers + leaderboard uit /api/data
===================================================== */
const searchInput = document.getElementById("playerSearch");
if (searchInput) {
  const resultBox = document.getElementById("playerResult");
  const lb = document.getElementById("leaderboard");
  let PLAYERS = [];

  const ratio = (p) => { const g = p.wins + p.losses; return g ? Math.round((p.wins / g) * 100) : 0; };

  function renderPlayer(p) {
    const r = ratio(p);
    const av = p.avatar
      ? `<img src="${p.avatar}" alt="" style="width:84px;height:84px;border-radius:20px;object-fit:cover;box-shadow:var(--shadow-glow)" />`
      : `<div class="avatar">${initials(p.name)}</div>`;
    return `
    <div class="player-card reveal in">
      <div class="player-top">
        ${av}
        <div>
          <h2>${p.name}</h2>
          <span class="rank-badge">🏅 ${p.rank}</span>
        </div>
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
      <div class="bar-row">
        <div class="bar-label"><span>${T("stats.winrate")}</span><span>${r}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${r}%"></div></div>
      </div>
      <div class="bar-row">
        <div class="bar-label"><span>${T("stats.xpToNext")}</span><span>${p.xp} ${T("stats.xp")}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(p.xp % 100, 100)}%"></div></div>
      </div>
    </div>`;
  }

  function search() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { resultBox.innerHTML = ""; return; }
    const p = PLAYERS.find((x) => x.name.toLowerCase().includes(q));
    resultBox.innerHTML = p
      ? renderPlayer(p)
      : `<div class="player-card"><p style="text-align:center;color:var(--muted)">${T("stats.notFound")} "<b>${searchInput.value}</b>".</p></div>`;
  }
  document.getElementById("searchBtn").addEventListener("click", search);
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });

  function buildLeaderboard() {
    const medal = ["gold", "silver", "bronze"];
    lb.querySelectorAll(".lb-row:not(.head)").forEach((n) => n.remove());
    PLAYERS.slice().sort((a, b) => b.elo - a.elo).forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "lb-row";
      row.style.cursor = "pointer";
      const av = p.avatar
        ? `<img src="${p.avatar}" alt="" style="width:34px;height:34px;border-radius:9px;object-fit:cover" />`
        : `<span class="av">${initials(p.name)}</span>`;
      row.innerHTML = `
        <div class="pos ${medal[i] || ""}">${i + 1}</div>
        <div class="pname">${av}${p.name}</div>
        <div style="font-weight:800;color:var(--blue-bright)">${p.elo}</div>
        <div class="col-hide">${p.wins}</div>
        <div>${ratio(p)}%</div>`;
      row.addEventListener("click", () => { searchInput.value = p.name; search(); window.scrollTo({ top: 0, behavior: "smooth" }); });
      lb.appendChild(row);
    });
  }

  // taalwissel: leaderboard + spelerkaart opnieuw tekenen
  document.addEventListener("langchange", () => {
    if (PLAYERS.length) { buildLeaderboard(); if (searchInput.value.trim()) search(); }
  });

  apiGet("/api/data").then((d) => {
    const members = d.members || {};
    const seasonNo = String(d.season?.number ?? "1");
    const ss = (d.season_stats || {})[seasonNo] || {};
    PLAYERS = Object.entries(members).map(([id, m]) => {
      const s = ss[id] || {};
      return {
        id, name: m.name, avatar: m.avatar, rank: m.rank || "Unranked",
        elo: m.elo || 0, level: m.level || 0, xp: m.xp || 0,
        wins: s.wins || 0, losses: s.losses || 0,
        tournaments_won: s.tournaments_won || 0, tournaments_played: s.tournaments_played || 0,
      };
    });
    if (!PLAYERS.length) {
      resultBox.innerHTML = `<div class="player-card"><p style="text-align:center;color:var(--muted)">${T("stats.noPlayers")}</p></div>`;
      return;
    }
    buildLeaderboard();
    searchInput.value = PLAYERS.slice().sort((a, b) => b.elo - a.elo)[0].name;
    search();
  }).catch((err) => {
    resultBox.innerHTML = `<div class="player-card"><p style="text-align:center;color:var(--muted)">${T("stats.noConnection")}<br /><small>${err}</small></p></div>`;
  });
}
