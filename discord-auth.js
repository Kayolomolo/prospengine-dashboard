const DISCORD_CLIENT_ID = "1519267915449503774";
const REDIRECT_URI = window.location.hostname === "localhost"
    ? "http://localhost:3459/callback.html"
    : "https://kayolomolo.github.io/prospengine-dashboard/callback.html";
const API = window.location.hostname === "localhost"
    ? "http://localhost:8080"
    : "https://clarify-retrace-abrasion.ngrok-free.dev";

let discordUser = null;
let discordToken = localStorage.getItem("discord_token") || null;

function getLoginUrl() {
    return `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=identify`;
}

async function fetchDiscordUser() {
    if (!discordToken) return null;

    try {
        const res = await fetch(API + "/api/discord-user", {
            headers: {
                "Authorization": `Bearer ${discordToken}`,
                "ngrok-skip-browser-warning": "true",
            },
        });
        if (res.status !== 200) {
            localStorage.removeItem("discord_token");
            discordToken = null;
            return null;
        }
        discordUser = await res.json();
        return discordUser;
    } catch (e) {
        return null;
    }
}

function updateLoginUI() {
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const navUser = document.getElementById("nav-user");
    const navAvatar = document.getElementById("nav-avatar");
    const navUsername = document.getElementById("nav-username");
    const tournamentMsg = document.getElementById("tournament-login-msg");

    if (discordUser) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        navUser.style.display = "inline-block";
        const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`
            : "https://cdn.discordapp.com/embed/avatars/0.png";
        navAvatar.src = avatarUrl;
        navUsername.textContent = discordUser.global_name || discordUser.username;
        if (tournamentMsg) tournamentMsg.textContent = `Logged in as ${discordUser.global_name || discordUser.username}`;
    } else {
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        navUser.style.display = "none";
        if (tournamentMsg) tournamentMsg.textContent = "Login with Discord to join tournaments!";
    }
}

function updateCreateTournamentVisibility() {
    const card = document.getElementById("create-tournament-card");
    const token = localStorage.getItem("prospengine_token");
    if (card) card.style.display = token ? "block" : "none";
}

async function createTournamentFromWebsite() {
    const token = localStorage.getItem("prospengine_token");
    if (!token) {
        showToast("Login to admin panel first!", true);
        return;
    }

    const name = document.getElementById("new-tournament-name").value.trim();
    const gamemode = parseInt(document.getElementById("new-tournament-gamemode").value);
    const maxPlayers = parseInt(document.getElementById("new-tournament-maxplayers").value);
    const dateVal = document.getElementById("new-tournament-date").value;
    const timeVal = document.getElementById("new-tournament-time").value;
    const autoTeams = document.getElementById("new-tournament-autoteams").value === "true";
    const isWeekly = document.getElementById("new-tournament-weekly").checked;

    if (!name) {
        showToast("Enter a tournament name!", true);
        return;
    }

    let starttijd = "";
    if (dateVal && timeVal) {
        starttijd = `${dateVal}T${timeVal}`;
    } else if (timeVal) {
        starttijd = timeVal;
    }

    try {
        const res = await fetch(API + "/api/tournaments/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "ngrok-skip-browser-warning": "true",
            },
            body: JSON.stringify({
                name, gamemode, max_players: maxPlayers, starttijd, auto_teams: autoTeams,
                weekly: isWeekly, tz_offset_minutes: new Date().getTimezoneOffset(),
            }),
        });
        const data = await res.json();

        if (data.success) {
            showToast("Tournament created and posted to Discord! 🏆");
            document.getElementById("new-tournament-name").value = "";
            document.getElementById("new-tournament-date").value = "";
            document.getElementById("new-tournament-time").value = "";
            document.getElementById("new-tournament-weekly").checked = false;
            loadTournaments();
        } else {
            showToast(data.error || "Failed to create tournament", true);
        }
    } catch (e) {
        showToast("Can't connect to bot", true);
    }
}

document.getElementById("create-tournament-btn")?.addEventListener("click", createTournamentFromWebsite);

async function deleteTournament(tid) {
    const token = localStorage.getItem("prospengine_token");
    if (!token) {
        showToast("Login to admin panel first!", true);
        return;
    }
    if (!confirm("Delete this tournament? This can't be undone.")) return;

    try {
        const res = await fetch(API + "/api/tournaments/delete", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "ngrok-skip-browser-warning": "true",
            },
            body: JSON.stringify({ tournament_id: tid }),
        });
        const data = await res.json();

        if (data.success) {
            showToast("Tournament deleted");
            loadTournaments();
        } else {
            showToast(data.error || "Failed to delete", true);
        }
    } catch (e) {
        showToast("Can't connect to bot", true);
    }
}

function formatStartTime(starttijd) {
    if (!starttijd) return "TBD";
    if (starttijd.includes("T")) {
        const d = new Date(starttijd);
        if (!isNaN(d)) {
            return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        }
    }
    return starttijd;
}

async function loadTournaments() {
    updateCreateTournamentVisibility();
    const list = document.getElementById("tournaments-list");

    try {
        const res = await fetch(API + "/api/tournaments", {
            headers: { "ngrok-skip-browser-warning": "true" },
        });
        const data = await res.json();
        const tournaments = data.tournaments || [];

        if (tournaments.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏆</div>
                    <p>No active tournaments right now.</p>
                    <p style="color: var(--text-secondary); margin-top: 0.5rem;">Create one in Discord with /tournament</p>
                </div>
            `;
            return;
        }

        list.innerHTML = tournaments.map(t => {
            const modeNames = { 1: "1v1", 2: "2v2", 3: "3v3", 4: "4v4" };
            const playerList = t.players.map(p => `<span class="tournament-player">• ${p.name}</span>`).join("");
            const isJoined = discordUser && t.players.some(p => p.id === discordUser.id);
            const isFull = t.player_count >= t.max_players;

            let actionBtn = "";
            if (t.started) {
                actionBtn = `<button class="admin-btn" disabled style="opacity:0.5;">Tournament in progress</button>`;
            } else if (!discordUser) {
                actionBtn = `<button class="admin-btn" onclick="window.location.href=getLoginUrl()">Login to join</button>`;
            } else if (isJoined) {
                actionBtn = `<button class="admin-btn admin-btn-danger" onclick="leaveTournament(${t.id})">Leave Tournament</button>`;
            } else if (isFull) {
                actionBtn = `<button class="admin-btn" disabled style="opacity:0.5;">Tournament is full</button>`;
            } else {
                actionBtn = `<button class="admin-btn" onclick="joinTournament(${t.id})">🎮 Join Tournament</button>`;
            }

            const isAdmin = !!localStorage.getItem("prospengine_token");
            const deleteBtn = isAdmin
                ? `<button class="admin-btn admin-btn-danger" style="width:auto;padding:0.4rem 0.8rem;" onclick="deleteTournament(${t.id})">🗑️ Delete</button>`
                : "";

            return `
                <div class="card" style="margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h2 style="margin: 0;">🏆 ${t.name}</h2>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span class="rank-badge rank-bg-${t.started ? 'gc' : 'gold'}">${t.started ? "In Progress" : "Open"}</span>
                            ${deleteBtn}
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <div class="player-stat-label">Gamemode</div>
                            <div class="player-stat-value">${modeNames[t.gamemode] || t.gamemode}</div>
                        </div>
                        <div>
                            <div class="player-stat-label">Players</div>
                            <div class="player-stat-value">${t.player_count}/${t.max_players}</div>
                        </div>
                        <div>
                            <div class="player-stat-label">Start Time</div>
                            <div class="player-stat-value">${formatStartTime(t.starttijd)}</div>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <div class="player-stat-label" style="margin-bottom: 0.5rem;">Signed Up</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                            ${playerList || '<span style="color: var(--text-secondary)">No players yet</span>'}
                        </div>
                    </div>
                    ${actionBtn}
                </div>
            `;
        }).join("");

    } catch (e) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔌</div>
                <p>Can't connect to the bot.</p>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">The bot needs to be running to show tournaments.</p>
            </div>
        `;
    }
}

async function joinTournament(tid) {
    if (!discordUser) return;

    try {
        const res = await fetch(API + "/api/tournaments/join", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
            },
            body: JSON.stringify({ user_id: discordUser.id, tournament_id: tid }),
        });
        const data = await res.json();

        if (data.success) {
            showToast("Joined tournament! 🎮");
            loadTournaments();
        } else {
            showToast(data.error || "Failed to join", true);
        }
    } catch (e) {
        showToast("Can't connect to bot", true);
    }
}

async function leaveTournament(tid) {
    if (!discordUser) return;

    try {
        const res = await fetch(API + "/api/tournaments/leave", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
            },
            body: JSON.stringify({ user_id: discordUser.id, tournament_id: tid }),
        });
        const data = await res.json();

        if (data.success) {
            showToast("Left tournament");
            loadTournaments();
        } else {
            showToast(data.error || "Failed to leave", true);
        }
    } catch (e) {
        showToast("Can't connect to bot", true);
    }
}

// Login button
document.getElementById("login-btn").addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = getLoginUrl();
});

// Logout button
document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("discord_token");
    discordToken = null;
    discordUser = null;
    updateLoginUI();
    loadTournaments();
});

// Init
async function initAuth() {
    if (discordToken) {
        await fetchDiscordUser();
    }
    updateLoginUI();
    loadTournaments();
}

// Refresh tournaments when switching to that tab
const origNavHandler = document.querySelectorAll(".nav-link");
origNavHandler.forEach(link => {
    link.addEventListener("click", () => {
        if (link.dataset.section === "tournaments") {
            loadTournaments();
        }
    });
});

initAuth();
setInterval(loadTournaments, 15000);
