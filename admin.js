const API_BASE = window.location.hostname === "localhost" ? "http://localhost:8080" : "https://clarify-retrace-abrasion.ngrok-free.dev";

let adminToken = localStorage.getItem("prospengine_token") || null;

const FEATURE_LABELS = {
    "verificatie": "🔒 Verification",
    "rank": "🏅 Rank System",
    "toernooi": "🏆 Tournaments",
    "elo": "📊 ELO & Seasons",
    "lfg": "🔎 Looking For Group",
    "clips": "🎬 Clips",
    "challenge": "⚔️ 1v1 Challenges",
    "poll": "📊 Polls",
    "warnings": "⚠️ Warnings",
    "weekly": "📅 Weekly Tournament",
};

function showToast(message, isError = false) {
    const existing = document.querySelector(".admin-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "admin-toast";
    if (isError) toast.style.background = "var(--red)";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function adminFetch(endpoint, method = "GET", body = null) {
    const opts = {
        method,
        headers: {
            "Authorization": `Bearer ${adminToken}`,
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
        },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + endpoint, opts);
    if (res.status === 401) {
        adminToken = null;
        localStorage.removeItem("prospengine_token");
        showAdminLogin();
        showToast("Session expired. Please login again.", true);
        return null;
    }
    return await res.json();
}

function showAdminLogin() {
    document.getElementById("admin-login").style.display = "block";
    document.getElementById("admin-panel").style.display = "none";
}

function showAdminPanel() {
    document.getElementById("admin-login").style.display = "none";
    document.getElementById("admin-panel").style.display = "block";
    loadSettings();
}

async function loadSettings() {
    const settings = await adminFetch("/api/settings");
    if (!settings) return;

    // Features
    const grid = document.getElementById("features-grid");
    grid.innerHTML = "";
    const features = settings.features || {};
    for (const [key, label] of Object.entries(FEATURE_LABELS)) {
        const enabled = features[key] !== false;
        grid.innerHTML += `
            <div class="feature-toggle">
                <input type="checkbox" id="feature-${key}" data-feature="${key}" ${enabled ? "checked" : ""}>
                <label for="feature-${key}">${label}</label>
            </div>
        `;
    }

    // Weekly tournament
    const weekly = settings.weekly_tournament || {};
    document.getElementById("weekly-enabled").checked = weekly.enabled || false;
    document.getElementById("weekly-day").value = weekly.day ?? 5;
    document.getElementById("weekly-hour").value = weekly.hour ?? 20;
    document.getElementById("weekly-gamemode").value = weekly.gamemode ?? 3;
    document.getElementById("weekly-maxplayers").value = weekly.max_players ?? 12;

    // Season
    document.getElementById("admin-season-number").value = settings.season.number;

    // Warnings
    loadWarnings();
}

function loadWarnings() {
    if (!data) return;
    const list = document.getElementById("warnings-list");
    const warnings = data.warnings || {};
    const members = data.members || {};

    if (Object.keys(warnings).length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary)">No warnings</p>';
        return;
    }

    list.innerHTML = "";
    for (const [uid, warns] of Object.entries(warnings)) {
        const member = members[uid] || { name: `User ${uid}` };
        list.innerHTML += `
            <div class="warning-item">
                <div class="warning-info">
                    <strong>${member.name}</strong>
                    <span style="color: var(--text-secondary)"> — ${warns.length} warning(s)</span>
                </div>
                <button class="warning-clear-btn" onclick="clearWarnings('${uid}')">Clear</button>
            </div>
        `;
    }
}

async function clearWarnings(uid) {
    const result = await adminFetch("/api/clear-warnings", "POST", { user_id: uid });
    if (result && result.success) {
        showToast("Warnings cleared!");
        loadSettings();
    }
}

// Login
document.getElementById("admin-login-btn").addEventListener("click", async () => {
    const password = document.getElementById("admin-password").value;
    if (!password) return;

    try {
        const res = await fetch(API_BASE + "/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
            body: JSON.stringify({ password }),
        });
        const data = await res.json();

        if (data.success) {
            adminToken = data.token;
            localStorage.setItem("prospengine_token", adminToken);
            document.getElementById("login-error").style.display = "none";
            showAdminPanel();
            showToast("Logged in!");
        } else {
            document.getElementById("login-error").textContent = "Wrong password";
            document.getElementById("login-error").style.display = "block";
        }
    } catch (e) {
        document.getElementById("login-error").textContent = "Can't connect to bot. Make sure it's running.";
        document.getElementById("login-error").style.display = "block";
    }
});

document.getElementById("admin-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("admin-login-btn").click();
});

// Save features
document.getElementById("save-features-btn").addEventListener("click", async () => {
    const features = {};
    document.querySelectorAll("[data-feature]").forEach(cb => {
        features[cb.dataset.feature] = cb.checked;
    });
    const result = await adminFetch("/api/features", "POST", { features });
    if (result && result.success) showToast("Features saved!");
});

// Save weekly
document.getElementById("save-weekly-btn").addEventListener("click", async () => {
    const weekly = {
        enabled: document.getElementById("weekly-enabled").checked,
        day: parseInt(document.getElementById("weekly-day").value),
        hour: parseInt(document.getElementById("weekly-hour").value),
        minute: 0,
        gamemode: parseInt(document.getElementById("weekly-gamemode").value),
        max_players: parseInt(document.getElementById("weekly-maxplayers").value),
        auto_teams: true,
    };
    const result = await adminFetch("/api/weekly", "POST", weekly);
    if (result && result.success) showToast("Weekly tournament settings saved!");
});

// Set season number
document.getElementById("save-season-btn").addEventListener("click", async () => {
    const number = parseInt(document.getElementById("admin-season-number").value);
    if (!number || number < 1) {
        showToast("Enter a valid season number!", true);
        return;
    }
    if (!confirm(`Set season to ${number}?`)) return;
    const result = await adminFetch("/api/season-set", "POST", { number });
    if (result && result.success) showToast(`Season set to ${result.season}!`);
});

// Reset season
document.getElementById("reset-season-btn").addEventListener("click", async () => {
    if (!confirm("Are you sure? This will reset all ELO ratings and start a new season!")) return;
    const result = await adminFetch("/api/season-reset", "POST", {});
    if (result && result.success) {
        showToast(`Season reset! Now on Season ${result.new_season}`);
        document.getElementById("admin-season").textContent = `Season ${result.new_season}`;
    }
});

// Logout
document.getElementById("admin-logout-btn").addEventListener("click", () => {
    adminToken = null;
    localStorage.removeItem("prospengine_token");
    document.getElementById("admin-password").value = "";
    showAdminLogin();
    showToast("Logged out");
});

// Auto-login if token exists
if (adminToken) {
    showAdminPanel();
} else {
    showAdminLogin();
}
