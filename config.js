// Single source of truth for the bot's public URL.
// Stabiel HTTPS-adres van de bot op bot-hosting.net (vervangt de oude ngrok-tunnel).
// Als dit adres ooit verandert, pas je het hier aan — nergens anders.
const PROSPENGINE_CONFIG = {
    NGROK_BASE: "https://4zjnuccz0n.apps.bot-hosting.cloud",
    LOCAL_BASE: "http://localhost:8080",
    LOCAL_DASHBOARD_PORT: 3459,
};
