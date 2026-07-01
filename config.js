// Single source of truth for the bot's public URL.
// If ngrok restarts and the tunnel URL changes, update it here — nowhere else.
const PROSPENGINE_CONFIG = {
    NGROK_BASE: "https://clarify-retrace-abrasion.ngrok-free.dev",
    LOCAL_BASE: "http://localhost:8080",
    LOCAL_DASHBOARD_PORT: 3459,
};
