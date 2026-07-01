const GITHUB_DATA_URL = "https://raw.githubusercontent.com/Kayolomolo/prospengine-dashboard/main/data.json";
const NGROK_API_URL = PROSPENGINE_CONFIG.NGROK_BASE + "/api/data";
const LOCAL_API_URL = PROSPENGINE_CONFIG.LOCAL_BASE + "/api/data";

let data = null;

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getRankClass(rank) {
    if (rank.includes("Supersonic")) return "ssl";
    if (rank.includes("Grand Champion")) return "gc";
    if (rank.includes("Champion")) return "champ";
    if (rank.includes("Diamond")) return "diamond";
    if (rank.includes("Platinum")) return "plat";
    if (rank.includes("Gold")) return "gold";
    if (rank.includes("Silver")) return "silver";
    if (rank.includes("Bronze")) return "bronze";
    return "unranked";
}

function getEloRank(elo) {
    if (elo >= 2000) return "Grandmaster";
    if (elo >= 1800) return "Master";
    if (elo >= 1600) return "Expert";
    if (elo >= 1400) return "Veteran";
    if (elo >= 1200) return "Advanced";
    if (elo >= 1000) return "Beginner";
    return "Newcomer";
}

function getLevelRole(level) {
    if (level >= 50) return "👑 Legend";
    if (level >= 30) return "💎 Elite";
    if (level >= 20) return "🔥 Veteran";
    if (level >= 10) return "⭐ Regular";
    if (level >= 5) return "🌱 Rookie";
    return "—";
}

function getMedal(index) {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}.`;
}

// Fills in safe defaults for any field the API response might be missing,
// so a backend change or partial response can't crash the whole dashboard.
function normalizeData(raw) {
    if (!raw || typeof raw !== "object") raw = {};
    return {
        server: {
            name: raw.server?.name ?? "Unknown Server",
            icon: raw.server?.icon ?? null,
            member_count: Number.isFinite(raw.server?.member_count) ? raw.server.member_count : 0,
        },
        season: {
            number: raw.season?.number ?? 1,
            start: raw.season?.start ?? new Date().toISOString(),
        },
        elo: (raw.elo && typeof raw.elo === "object") ? raw.elo : {},
        season_stats: (raw.season_stats && typeof raw.season_stats === "object") ? raw.season_stats : {},
        levels: (raw.levels && typeof raw.levels === "object") ? raw.levels : {},
        training_packs: Array.isArray(raw.training_packs) ? raw.training_packs : [],
        quotes: Array.isArray(raw.quotes) ? raw.quotes : [],
        birthdays: (raw.birthdays && typeof raw.birthdays === "object") ? raw.birthdays : {},
        members: (raw.members && typeof raw.members === "object") ? raw.members : {},
        warnings: (raw.warnings && typeof raw.warnings === "object") ? raw.warnings : {},
    };
}

async function fetchData() {
    // Try local API first (fastest when on same machine)
    try {
        const response = await fetch(LOCAL_API_URL);
        data = normalizeData(await response.json());
        renderAll();
        return;
    } catch (e) {}

    // Try ngrok API
    try {
        const response = await fetch(NGROK_API_URL, { headers: { "ngrok-skip-browser-warning": "true" } });
        data = normalizeData(await response.json());
        renderAll();
        return;
    } catch (e) {}

    // Fallback to GitHub data
    try {
        const response = await fetch(GITHUB_DATA_URL + "?t=" + Date.now());
        data = normalizeData(await response.json());
        renderAll();
    } catch (e) {
        document.querySelector("main").innerHTML = `
            <div class="empty-state" style="margin-top: 4rem;">
                <div class="empty-icon">🔌</div>
                <h2>Can't load data</h2>
                <p style="margin-top: 0.5rem;">Data is not available right now. Try again later.</p>
            </div>
        `;
    }
}

// Each section renders independently — if one throws (e.g. unexpected data shape),
// the others still render instead of the whole dashboard going blank.
function renderAll() {
    const sections = [
        ["overview", renderOverview],
        ["leaderboard", renderLeaderboard],
        ["players", renderPlayers],
        ["training", renderTraining],
        ["quotes", renderQuotes],
    ];
    for (const [name, fn] of sections) {
        try {
            fn();
        } catch (e) {
            console.error(`Failed to render section "${name}":`, e);
        }
    }
}

function renderOverview() {
    const server = data.server;
    document.getElementById("server-name").textContent = server.name;
    document.getElementById("server-members").textContent = `${server.member_count} members`;
    const icon = document.getElementById("server-icon");
    if (server.icon) {
        icon.src = server.icon;
    } else {
        icon.style.display = "none";
    }

    document.getElementById("stat-season").textContent = `Season ${data.season.number}`;
    document.getElementById("stat-members").textContent = server.member_count;

    const seasonNum = String(data.season.number);
    const seasonStats = data.season_stats[seasonNum] || {};
    let totalMatches = 0;
    let totalElo = 0;
    let eloCount = 0;

    Object.values(seasonStats).forEach(s => {
        totalMatches += (s.wins || 0) + (s.losses || 0);
    });

    Object.entries(data.elo).forEach(([uid, elo]) => {
        totalElo += elo;
        eloCount++;
    });

    document.getElementById("stat-matches").textContent = totalMatches;
    document.getElementById("stat-avg-elo").textContent = eloCount > 0 ? Math.round(totalElo / eloCount) : "—";

    const sorted = Object.entries(data.elo).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const top5 = document.getElementById("top5-list");

    if (sorted.length === 0) {
        top5.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><p>No ELO data yet</p></div>';
    } else {
        top5.innerHTML = sorted.map(([uid, elo], i) => {
            const member = data.members[uid] || { name: "Unknown", avatar: "", rank: "Unranked" };
            return `
                <div class="top-player">
                    <div class="top-position">${getMedal(i)}</div>
                    <img class="top-avatar" src="${member.avatar}" alt="">
                    <div class="top-info">
                        <div class="top-name">${escapeHtml(member.name)}</div>
                        <div class="top-rank rank-${getRankClass(member.rank)}">${member.rank}</div>
                    </div>
                    <div class="top-elo">${elo} ELO</div>
                </div>
            `;
        }).join("");
    }

    const quoteEl = document.getElementById("latest-quote");
    if (data.quotes.length > 0) {
        const q = data.quotes[data.quotes.length - 1];
        quoteEl.innerHTML = `
            <div class="quote-text">"${escapeHtml(q.quote)}"</div>
            <div class="quote-author">— ${escapeHtml(q.member_name)}</div>
        `;
    } else {
        quoteEl.innerHTML = '<p style="color: var(--text-secondary)">No quotes yet</p>';
    }
}

function renderLeaderboard() {
    document.getElementById("lb-season").textContent = data.season.number;
    const seasonNum = String(data.season.number);
    const seasonStats = data.season_stats[seasonNum] || {};

    const sorted = Object.entries(data.elo).sort((a, b) => b[1] - a[1]);
    const tbody = document.getElementById("leaderboard-body");

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-secondary)">No ELO data yet</td></tr>';
    } else {
        tbody.innerHTML = sorted.map(([uid, elo], i) => {
            const member = data.members[uid] || { name: "Unknown", avatar: "", rank: "Unranked" };
            const stats = seasonStats[uid] || { wins: 0, losses: 0, tournaments_won: 0 };
            const total = stats.wins + stats.losses;
            const winrate = total > 0 ? Math.round(stats.wins / total * 100) : 0;

            return `
                <tr>
                    <td>${getMedal(i)}</td>
                    <td>
                        <div class="player-cell">
                            <img class="player-avatar" src="${member.avatar}" alt="">
                            ${escapeHtml(member.name)}
                        </div>
                    </td>
                    <td><strong>${elo}</strong></td>
                    <td class="rank-${getRankClass(member.rank)}">${member.rank}</td>
                    <td>${stats.wins}W / ${stats.losses}L</td>
                    <td>
                        ${winrate}%
                        <div class="winrate-bar"><div class="winrate-fill" style="width:${winrate}%"></div></div>
                    </td>
                    <td>${stats.tournaments_won || 0} 🏆</td>
                </tr>
            `;
        }).join("");
    }

    const levels = Object.entries(data.levels)
        .map(([uid, d]) => ({ uid, level: d.level || 0, xp: d.xp || 0 }))
        .sort((a, b) => b.level - a.level || b.xp - a.xp);

    const levelBody = document.getElementById("level-leaderboard-body");

    if (levels.length === 0) {
        levelBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-secondary)">No level data yet</td></tr>';
    } else {
        levelBody.innerHTML = levels.map(({ uid, level, xp }, i) => {
            const member = data.members[uid] || { name: "Unknown", avatar: "" };
            return `
                <tr>
                    <td>${getMedal(i)}</td>
                    <td>
                        <div class="player-cell">
                            <img class="player-avatar" src="${member.avatar}" alt="">
                            ${escapeHtml(member.name)}
                        </div>
                    </td>
                    <td><strong>${level}</strong></td>
                    <td>${xp} XP</td>
                    <td>${getLevelRole(level)}</td>
                </tr>
            `;
        }).join("");
    }
}

function renderPlayers() {
    const grid = document.getElementById("players-grid");
    const members = Object.entries(data.members);
    const seasonNum = String(data.season.number);
    const seasonStats = data.season_stats[seasonNum] || {};

    if (members.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No players found</p></div>';
        return;
    }

    function renderCards(filter = "") {
        const filtered = members.filter(([uid, m]) =>
            m.name.toLowerCase().includes(filter.toLowerCase())
        );

        grid.innerHTML = filtered.map(([uid, m]) => {
            const elo = data.elo[uid] || 1000;
            const stats = seasonStats[uid] || { wins: 0, losses: 0, tournaments_won: 0, tournaments_played: 0 };
            const levelData = data.levels[uid] || { level: 0, xp: 0 };
            const rankClass = getRankClass(m.rank);

            return `
                <div class="player-card">
                    <img class="avatar" src="${m.avatar}" alt="">
                    <div class="name">${escapeHtml(m.name)}</div>
                    <span class="rank-badge rank-bg-${rankClass}">${m.rank}</span>
                    <div class="player-stats">
                        <div>
                            <div class="player-stat-value">${elo}</div>
                            <div class="player-stat-label">ELO</div>
                        </div>
                        <div>
                            <div class="player-stat-value">${levelData.level}</div>
                            <div class="player-stat-label">Level</div>
                        </div>
                        <div>
                            <div class="player-stat-value">${stats.wins}/${stats.losses}</div>
                            <div class="player-stat-label">W/L</div>
                        </div>
                        <div>
                            <div class="player-stat-value">${stats.tournaments_won || 0} 🏆</div>
                            <div class="player-stat-label">Tournaments</div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    renderCards();

    document.getElementById("player-search").addEventListener("input", (e) => {
        renderCards(e.target.value);
    });
}

function renderTraining() {
    const list = document.getElementById("training-list");
    const packs = data.training_packs || [];

    if (packs.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">🏋️</div><p>No training packs shared yet</p></div>';
        return;
    }

    const order = { "Beginner": 0, "Intermediate": 1, "Advanced": 2, "Expert": 3 };
    const sorted = [...packs].sort((a, b) => (order[a.difficulty] || 0) - (order[b.difficulty] || 0));

    list.innerHTML = sorted.map(pack => {
        const addedBy = data.members[pack.added_by] || { name: pack.added_by_name || "Unknown" };
        return `
            <div class="training-card">
                <div class="training-name">${escapeHtml(pack.name)}</div>
                <div class="training-code">${escapeHtml(pack.code)}</div>
                <span class="difficulty-badge difficulty-${pack.difficulty}">${pack.difficulty}</span>
                <p style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">Added by ${escapeHtml(addedBy.name)}</p>
            </div>
        `;
    }).join("");
}

function renderQuotes() {
    const list = document.getElementById("quotes-list");
    const quotes = data.quotes || [];

    if (quotes.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>No quotes yet</p></div>';
        return;
    }

    list.innerHTML = [...quotes].reverse().map(q => `
        <div class="quote-card">
            <div class="quote-text">"${escapeHtml(q.quote)}"</div>
            <div class="quote-author">— ${escapeHtml(q.member_name)} • ${new Date(q.date).toLocaleDateString()}</div>
        </div>
    `).join("");
}

// Navigation
document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        const section = link.dataset.section;

        document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
        link.classList.add("active");

        document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
        document.getElementById(section).classList.add("active");
    });
});

// Load data
fetchData();
setInterval(fetchData, 30000);
