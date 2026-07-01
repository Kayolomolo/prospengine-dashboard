const API_BASE = window.location.hostname === "localhost" ? PROSPENGINE_CONFIG.LOCAL_BASE : PROSPENGINE_CONFIG.NGROK_BASE;

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const ROLE_LEVEL = { helper: 1, moderator: 2, admin: 3 };

function getStoredAdminToken() {
    const token = localStorage.getItem("prospengine_token");
    const expiresAt = parseInt(localStorage.getItem("prospengine_token_expires") || "0");
    if (!token || !expiresAt || Date.now() > expiresAt) {
        clearAdminToken();
        return null;
    }
    return token;
}

function getStoredAdminRole() {
    return localStorage.getItem("prospengine_admin_role");
}

function getStoredAdminUsername() {
    return localStorage.getItem("prospengine_admin_username");
}

function storeAdminSession(token, role, username) {
    localStorage.setItem("prospengine_token", token);
    localStorage.setItem("prospengine_token_expires", String(Date.now() + TOKEN_EXPIRY_MS));
    localStorage.setItem("prospengine_admin_role", role);
    localStorage.setItem("prospengine_admin_username", username);
}

function clearAdminToken() {
    localStorage.removeItem("prospengine_token");
    localStorage.removeItem("prospengine_token_expires");
    localStorage.removeItem("prospengine_admin_role");
    localStorage.removeItem("prospengine_admin_username");
}

let adminToken = getStoredAdminToken();
let adminRole = adminToken ? getStoredAdminRole() : null;

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
    "birthday": "🎂 Birthdays",
    "profile": "👤 Profiles",
    "giveaway": "🎁 Giveaways",
    "training": "🏋️ Training Packs",
    "quotes": "💬 Quotes",
    "leveling": "📈 Leveling",
    "minigames": "🎲 Minigames",
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
        adminRole = null;
        clearAdminToken();
        showAdminLogin();
        showToast("Session expired. Please login again.", true);
        return null;
    }
    if (res.status === 403) {
        showToast("You don't have permission to do that.", true);
        return null;
    }
    return await res.json();
}

function showAdminLogin() {
    const passField = document.getElementById("admin-password");
    if (passField) passField.value = "";
    if (typeof showForgotStep === "function") showForgotStep("login");
    showSection("admin-login");
}

function showAdminPanel() {
    showSection("admin");
    loadSettings();
    applyRoleGating();
    if (adminRole === "admin") loadAdminUsers();
}

function applyRoleGating() {
    const level = ROLE_LEVEL[adminRole] || 0;

    document.querySelectorAll("[data-min-role]").forEach(card => {
        const required = ROLE_LEVEL[card.dataset.minRole] || 0;
        card.style.display = level >= required ? "" : "none";
    });

    const manageAdmins = document.getElementById("manage-admins-card");
    if (manageAdmins) manageAdmins.style.display = adminRole === "admin" ? "block" : "none";

    const roleLabel = document.getElementById("admin-role-label");
    if (roleLabel) {
        const username = getStoredAdminUsername() || "";
        roleLabel.textContent = `${username} · ${adminRole || ""}`;
    }
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

    // Verification
    const verify = settings.verification || {};
    document.getElementById("verify-method").value = verify.method || "captcha";
    document.getElementById("verify-length").value = verify.captcha_length ?? 6;
    document.getElementById("verify-difficulty").value = verify.captcha_difficulty || "medium";
    document.getElementById("verify-attempts").value = verify.max_attempts ?? 3;
    document.getElementById("verify-timeout").value = verify.timeout_seconds ?? 300;

    // Anti-Nuke
    const antinuke = settings.antinuke || {};
    document.getElementById("antinuke-enabled").checked = antinuke.enabled !== false;
    document.getElementById("antinuke-ban-limit").value = antinuke.ban_limit ?? 2;
    document.getElementById("antinuke-kick-limit").value = antinuke.kick_limit ?? 2;
    document.getElementById("antinuke-channel-limit").value = antinuke.channel_delete_limit ?? 2;
    document.getElementById("antinuke-role-limit").value = antinuke.role_delete_limit ?? 2;
    document.getElementById("antinuke-punishment").value = antinuke.punishment || "ban";
    const beast = antinuke.beast_mode || {};
    document.getElementById("beast-enabled").checked = beast.enabled !== false;
    document.getElementById("beast-score-limit").value = beast.score_limit ?? 25;
    document.getElementById("beast-duration").value = beast.duration_minutes ?? 60;
    document.getElementById("beast-punishment").value = beast.punishment || "clear_roles";

    // Anti-Raid
    const antiraid = settings.antiraid || {};
    document.getElementById("antiraid-enabled").checked = antiraid.enabled !== false;
    document.getElementById("antiraid-score-limit").value = antiraid.score_limit ?? 50;
    document.getElementById("antiraid-avatar-score").value = antiraid.no_avatar_score ?? 5;
    document.getElementById("antiraid-age-score").value = antiraid.account_age_score ?? 5;
    document.getElementById("antiraid-joinrow-score").value = antiraid.join_row_score ?? 10;
    document.getElementById("antiraid-age-bypass").value = antiraid.age_bypass_days ?? 180;
    document.getElementById("antiraid-joinrow-threshold").value = antiraid.join_row_threshold_seconds ?? 5;
    document.getElementById("antiraid-punishment").value = antiraid.punishment || "ban";
    document.getElementById("antiraid-ban-days").value = antiraid.punishment_days ?? 2;
    document.getElementById("antiraid-lock-hours").value = antiraid.lock_duration_hours ?? 2;
    document.getElementById("antiraid-reset-mins").value = antiraid.score_reset_minutes ?? 10;

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
    const canClear = ROLE_LEVEL[adminRole] >= ROLE_LEVEL.moderator;

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
                    <strong>${escapeHtml(member.name)}</strong>
                    <span style="color: var(--text-secondary)"> — ${warns.length} warning(s)</span>
                </div>
                <button class="warning-clear-btn" data-action="clear-warning" data-uid="${escapeHtml(uid)}" ${canClear ? "" : "disabled"}>Clear</button>
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

let _adminUsersCache = [];

async function loadAdminUsers() {
    if (adminRole !== "admin") return;
    const result = await adminFetch("/api/admin/users");
    if (!result) return;

    _adminUsersCache = result.users;
    const list = document.getElementById("admin-users-list");
    const myUsername = getStoredAdminUsername();
    list.innerHTML = result.users.map(u => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid var(--border);">
            <div>
                <strong>${escapeHtml(u.username)}</strong>
                <span class="rl-role-pill rl-role-pill-${escapeHtml(u.role)}">${escapeHtml(u.role)}</span>
                <div style="color:var(--text-secondary); font-size:0.8rem;">
                    ${u.discord_id ? `Discord: ${escapeHtml(u.discord_id)}` : "No Discord linked"} · Last login: ${u.last_login ? new Date(u.last_login).toLocaleString() : "never"}
                </div>
            </div>
            <div style="display:flex; gap:0.4rem;">
                <button class="admin-btn" style="width:auto; padding:0.3rem 0.7rem;" data-action="edit-admin-user" data-username="${escapeHtml(u.username)}">Edit</button>
                <button class="admin-btn" style="width:auto; padding:0.3rem 0.7rem; background:var(--text-secondary);" data-action="reset-admin-user-password" data-username="${escapeHtml(u.username)}">Reset Password</button>
                <button class="admin-btn admin-btn-danger" style="width:auto; padding:0.3rem 0.7rem;" data-action="delete-admin-user" data-username="${escapeHtml(u.username)}" ${u.username === myUsername ? "disabled" : ""}>Delete</button>
            </div>
        </div>
    `).join("");
}

async function deleteAdminUser(username) {
    if (!confirm(`Delete admin account "${username}"?`)) return;
    const result = await adminFetch("/api/admin/users/delete", "POST", { username });
    if (result && result.success) {
        showToast("Account deleted");
        loadAdminUsers();
    } else if (result && result.error) {
        showToast(result.error, true);
    }
}

async function editAdminUser(username) {
    const current = _adminUsersCache.find(u => u.username === username);

    const newUsername = prompt("Username:", username);
    if (newUsername === null) return;

    const newDiscordId = prompt("Discord User ID (leave empty to unlink):", (current && current.discord_id) || "");
    if (newDiscordId === null) return;

    const body = { username, discord_id: newDiscordId.trim() };
    if (newUsername.trim() && newUsername.trim().toLowerCase() !== username) {
        body.new_username = newUsername.trim();
    }

    const result = await adminFetch("/api/admin/users/update", "POST", body);
    if (result && result.success) {
        showToast("Account updated!");
        loadAdminUsers();
    } else if (result && result.error) {
        showToast(result.error, true);
    }
}

async function resetAdminUserPassword(username) {
    const newPassword = prompt(`New password for "${username}" (min. 8 characters):`);
    if (newPassword === null) return;
    if (newPassword.length < 8) {
        showToast("Password must be at least 8 characters", true);
        return;
    }

    const result = await adminFetch("/api/admin/users/reset-password", "POST", { username, new_password: newPassword });
    if (result && result.success) {
        showToast("Password reset!");
    } else if (result && result.error) {
        showToast(result.error, true);
    }
}

document.getElementById("create-admin-btn")?.addEventListener("click", async () => {
    const username = document.getElementById("new-admin-username").value.trim();
    const password = document.getElementById("new-admin-password").value;
    const role = document.getElementById("new-admin-role").value;
    const discordId = document.getElementById("new-admin-discord-id").value.trim();
    if (!username || !password) {
        showToast("Enter a username and password!", true);
        return;
    }
    const result = await adminFetch("/api/admin/users/create", "POST", { username, password, role, discord_id: discordId });
    if (result && result.success) {
        showToast("Account created!");
        document.getElementById("new-admin-username").value = "";
        document.getElementById("new-admin-password").value = "";
        document.getElementById("new-admin-discord-id").value = "";
        loadAdminUsers();
    } else if (result && result.error) {
        showToast(result.error, true);
    }
});

// Login
document.getElementById("admin-login-btn").addEventListener("click", async () => {
    const username = document.getElementById("admin-username").value.trim();
    const password = document.getElementById("admin-password").value;
    if (!username || !password) return;

    try {
        const res = await fetch(API_BASE + "/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (data.success) {
            adminToken = data.token;
            adminRole = data.role;
            storeAdminSession(data.token, data.role, data.username);
            document.getElementById("login-error").style.display = "none";
            showAdminPanel();
            showToast("Logged in!");
        } else {
            document.getElementById("login-error").textContent = data.error || "Wrong username or password";
            document.getElementById("login-error").style.display = "block";
        }
    } catch (e) {
        document.getElementById("login-error").textContent = "Can't connect to bot. Make sure it's running.";
        document.getElementById("login-error").style.display = "block";
    }
});

document.getElementById("admin-username").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("admin-login-btn").click();
});
document.getElementById("admin-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("admin-login-btn").click();
});

// Forgot password flow
let _forgotPasswordUsername = "";

function showForgotStep(step) {
    document.getElementById("admin-login-step").style.display = step === "login" ? "block" : "none";
    document.getElementById("admin-forgot-step1").style.display = step === "step1" ? "block" : "none";
    document.getElementById("admin-forgot-step2").style.display = step === "step2" ? "block" : "none";
}

document.getElementById("show-forgot-password-btn").addEventListener("click", () => {
    document.getElementById("forgot-username").value = document.getElementById("admin-username").value;
    document.getElementById("forgot-step1-error").style.display = "none";
    document.getElementById("forgot-step1-success").style.display = "none";
    showForgotStep("step1");
});

document.getElementById("back-to-login-btn-1").addEventListener("click", () => showForgotStep("login"));
document.getElementById("back-to-login-btn-2").addEventListener("click", () => showForgotStep("login"));

document.getElementById("send-reset-code-btn").addEventListener("click", async () => {
    const username = document.getElementById("forgot-username").value.trim();
    const errorEl = document.getElementById("forgot-step1-error");
    const successEl = document.getElementById("forgot-step1-success");
    errorEl.style.display = "none";
    successEl.style.display = "none";
    if (!username) return;

    try {
        const res = await fetch(API_BASE + "/api/admin/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
            body: JSON.stringify({ username }),
        });
        const data = await res.json();

        if (data.success) {
            _forgotPasswordUsername = username;
            document.getElementById("reset-code").value = "";
            document.getElementById("reset-new-password").value = "";
            document.getElementById("forgot-step2-error").style.display = "none";
            showForgotStep("step2");
        } else {
            errorEl.textContent = data.error || "Something went wrong";
            errorEl.style.display = "block";
        }
    } catch (e) {
        errorEl.textContent = "Can't connect to bot. Make sure it's running.";
        errorEl.style.display = "block";
    }
});

document.getElementById("submit-reset-code-btn").addEventListener("click", async () => {
    const code = document.getElementById("reset-code").value.trim();
    const newPassword = document.getElementById("reset-new-password").value;
    const errorEl = document.getElementById("forgot-step2-error");
    errorEl.style.display = "none";
    if (!code || !newPassword) return;

    try {
        const res = await fetch(API_BASE + "/api/admin/reset-password-with-code", {
            method: "POST",
            headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
            body: JSON.stringify({ username: _forgotPasswordUsername, code, new_password: newPassword }),
        });
        const data = await res.json();

        if (data.success) {
            showToast("Password reset! You can log in now.");
            document.getElementById("admin-username").value = _forgotPasswordUsername;
            document.getElementById("admin-password").value = "";
            showForgotStep("login");
        } else {
            errorEl.textContent = data.error || "Something went wrong";
            errorEl.style.display = "block";
        }
    } catch (e) {
        errorEl.textContent = "Can't connect to bot. Make sure it's running.";
        errorEl.style.display = "block";
    }
});

// Save verification
document.getElementById("save-verify-btn").addEventListener("click", async () => {
    const verify = {
        method: document.getElementById("verify-method").value,
        captcha_length: parseInt(document.getElementById("verify-length").value),
        captcha_difficulty: document.getElementById("verify-difficulty").value,
        max_attempts: parseInt(document.getElementById("verify-attempts").value),
        timeout_seconds: parseInt(document.getElementById("verify-timeout").value),
    };
    const result = await adminFetch("/api/verification", "POST", verify);
    if (result && result.success) showToast("Verification settings saved!");
});

// Save anti-nuke
document.getElementById("save-antinuke-btn").addEventListener("click", async () => {
    const antinuke = {
        enabled: document.getElementById("antinuke-enabled").checked,
        ban_limit: parseInt(document.getElementById("antinuke-ban-limit").value),
        kick_limit: parseInt(document.getElementById("antinuke-kick-limit").value),
        channel_delete_limit: parseInt(document.getElementById("antinuke-channel-limit").value),
        role_delete_limit: parseInt(document.getElementById("antinuke-role-limit").value),
        punishment: document.getElementById("antinuke-punishment").value,
        beast_mode: {
            enabled: document.getElementById("beast-enabled").checked,
            score_limit: parseInt(document.getElementById("beast-score-limit").value),
            ban_score: 10,
            kick_score: 5,
            channel_delete_score: 8,
            role_delete_score: 8,
            punishment: document.getElementById("beast-punishment").value,
            duration_minutes: parseInt(document.getElementById("beast-duration").value),
        },
    };
    const result = await adminFetch("/api/antinuke", "POST", antinuke);
    if (result && result.success) showToast("Anti-Nuke settings saved!");
});

// Save anti-raid
document.getElementById("save-antiraid-btn").addEventListener("click", async () => {
    const antiraid = {
        enabled: document.getElementById("antiraid-enabled").checked,
        score_limit: parseInt(document.getElementById("antiraid-score-limit").value),
        no_avatar_score: parseInt(document.getElementById("antiraid-avatar-score").value),
        account_age_score: parseInt(document.getElementById("antiraid-age-score").value),
        join_row_score: parseInt(document.getElementById("antiraid-joinrow-score").value),
        age_bypass_days: parseInt(document.getElementById("antiraid-age-bypass").value),
        join_row_threshold_seconds: parseInt(document.getElementById("antiraid-joinrow-threshold").value),
        punishment: document.getElementById("antiraid-punishment").value,
        punishment_days: parseInt(document.getElementById("antiraid-ban-days").value),
        lock_duration_hours: parseInt(document.getElementById("antiraid-lock-hours").value),
        score_reset_minutes: parseInt(document.getElementById("antiraid-reset-mins").value),
    };
    const result = await adminFetch("/api/antiraid", "POST", antiraid);
    if (result && result.success) showToast("Anti-Raid settings saved!");
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
    adminRole = null;
    clearAdminToken();
    document.getElementById("admin-username").value = "";
    document.getElementById("admin-password").value = "";
    showAdminLogin();
    showToast("Logged out");
});
