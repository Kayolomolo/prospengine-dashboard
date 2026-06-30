let onboardingStatus = null;

function gsAuthHeaders() {
    return {
        "Authorization": `Bearer ${discordToken}`,
        "ngrok-skip-browser-warning": "true",
    };
}

async function loadOnboarding() {
    const loginRequired = document.getElementById("gs-login-required");
    const flow = document.getElementById("gs-flow");

    if (!discordUser || !discordToken) {
        loginRequired.style.display = "block";
        flow.style.display = "none";
        return;
    }

    loginRequired.style.display = "none";
    flow.style.display = "block";

    try {
        const res = await fetch(API + "/api/onboarding/status", {
            headers: gsAuthHeaders(),
        });
        if (res.status !== 200) {
            const err = await res.json();
            flow.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.error || "Something went wrong"}</p></div>`;
            return;
        }
        onboardingStatus = await res.json();

        if (onboardingStatus.is_verified) {
            showGsStep("done");
            return;
        }

        if (!gsRulesAgreed) {
            showGsStep("rules");
        } else {
            showGsStep("profile");
            updateProfileChecks();
        }
    } catch (e) {
        flow.innerHTML = `<div class="empty-state"><div class="empty-icon">🔌</div><p>Can't connect to the bot.</p></div>`;
    }
}

let gsRulesAgreed = false;

function showGsStep(step) {
    document.getElementById("gs-step-rules").style.display = step === "rules" ? "block" : "none";
    document.getElementById("gs-step-profile").style.display = step === "profile" ? "block" : "none";
    document.getElementById("gs-step-verify").style.display = step === "verify" ? "block" : "none";
    document.getElementById("gs-step-done").style.display = step === "done" ? "block" : "none";

    const progress = { rules: 1, profile: 2, verify: 3, done: 3 };
    const current = progress[step] || 1;
    for (let i = 1; i <= 3; i++) {
        const el = document.getElementById(`gs-progress-${i}`);
        el.classList.remove("active", "done");
        if (i < current || step === "done") el.classList.add("done");
        else if (i === current) el.classList.add("active");
    }
}

async function loadRules() {
    try {
        const res = await fetch(API + "/api/onboarding/rules", {
            headers: { "ngrok-skip-browser-warning": "true" },
        });
        const data = await res.json();
        document.getElementById("gs-rules-title").textContent = data.title;
        document.getElementById("gs-rules-text").textContent = data.text;
    } catch (e) {}
}

document.getElementById("gs-rules-checkbox").addEventListener("change", (e) => {
    document.getElementById("gs-rules-next").disabled = !e.target.checked;
});

document.getElementById("gs-rules-next").addEventListener("click", () => {
    gsRulesAgreed = true;
    showGsStep("profile");
    updateProfileChecks();
});

function updateProfileChecks() {
    if (!onboardingStatus) return;
    const tzCheck = document.getElementById("gs-tz-check");
    const rankCheck = document.getElementById("gs-rank-check");

    tzCheck.textContent = onboardingStatus.has_timezone ? "✅" : "";
    if (onboardingStatus.has_timezone) {
        document.getElementById("gs-timezone-select").value = onboardingStatus.timezone || "";
    }

    if (onboardingStatus.rank_pending) {
        rankCheck.textContent = "⏳ Pending admin approval";
    } else if (onboardingStatus.has_rank) {
        rankCheck.textContent = `✅ ${onboardingStatus.current_rank || ""}`;
    } else {
        rankCheck.textContent = "";
    }

    const canContinue = onboardingStatus.has_timezone && onboardingStatus.has_rank;
    document.getElementById("gs-profile-next").disabled = !canContinue;
}

document.getElementById("gs-save-timezone").addEventListener("click", async () => {
    const zone = document.getElementById("gs-timezone-select").value;
    if (!zone) {
        showToast("Choose a timezone first!", true);
        return;
    }
    try {
        const res = await fetch(API + "/api/onboarding/timezone", {
            method: "POST",
            headers: { ...gsAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ zone }),
        });
        const data = await res.json();
        if (data.success) {
            showToast("Timezone saved! ✅");
            onboardingStatus.has_timezone = true;
            onboardingStatus.timezone = zone;
            updateProfileChecks();
        } else {
            showToast(data.error || "Failed", true);
        }
    } catch (e) {
        showToast("Can't connect to bot", true);
    }
});

document.getElementById("gs-save-rank").addEventListener("click", async () => {
    const rank = document.getElementById("gs-rank-select").value;
    const epicName = document.getElementById("gs-epic-name").value.trim();
    if (!rank || !epicName) {
        showToast("Choose a rank and enter your Epic name!", true);
        return;
    }
    try {
        const res = await fetch(API + "/api/onboarding/rank", {
            method: "POST",
            headers: { ...gsAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ rank, epic_name: epicName }),
        });
        const data = await res.json();
        if (data.success) {
            showToast("Rank request submitted! ✅");
            onboardingStatus.has_rank = true;
            onboardingStatus.rank_pending = true;
            updateProfileChecks();
        } else {
            showToast(data.error || "Failed", true);
        }
    } catch (e) {
        showToast("Can't connect to bot", true);
    }
});

document.getElementById("gs-profile-next").addEventListener("click", async () => {
    showGsStep("verify");
    await loadCaptcha();
});

async function loadCaptcha() {
    const errorEl = document.getElementById("gs-captcha-error");
    errorEl.style.display = "none";
    document.getElementById("gs-captcha-answer").value = "";

    try {
        const res = await fetch(API + "/api/onboarding/captcha", {
            headers: gsAuthHeaders(),
        });
        const data = await res.json();
        if (data.image) {
            document.getElementById("gs-captcha-img").src = data.image;
        } else {
            errorEl.textContent = data.error || "Failed to load captcha";
            errorEl.style.display = "block";
        }
    } catch (e) {
        errorEl.textContent = "Can't connect to bot";
        errorEl.style.display = "block";
    }
}

document.getElementById("gs-new-captcha").addEventListener("click", loadCaptcha);

document.getElementById("gs-submit-captcha").addEventListener("click", async () => {
    const answer = document.getElementById("gs-captcha-answer").value.trim();
    const errorEl = document.getElementById("gs-captcha-error");
    errorEl.style.display = "none";

    if (!answer) return;

    try {
        const res = await fetch(API + "/api/onboarding/verify", {
            method: "POST",
            headers: { ...gsAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ answer }),
        });
        const data = await res.json();

        if (data.success) {
            showGsStep("done");
            showToast("Verified! Welcome! 🎉");
        } else {
            errorEl.textContent = data.error || "Wrong code";
            errorEl.style.display = "block";
        }
    } catch (e) {
        errorEl.textContent = "Can't connect to bot";
        errorEl.style.display = "block";
    }
});

document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
        if (link.dataset.section === "get-started") {
            loadRules();
            loadOnboarding();
        }
    });
});

// Initial load if landing directly on get-started
if (window.location.hash === "#get-started") {
    setTimeout(() => {
        loadRules();
        loadOnboarding();
    }, 500);
}
