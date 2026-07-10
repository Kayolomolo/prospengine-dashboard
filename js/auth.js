/* ===== ProspEngine — Discord login + server-kiezer ===== */
(function () {
  const API = window.PROSP_API || "";
  const CLIENT_ID = window.PROSP_DISCORD_CLIENT_ID;
  const TOKEN_KEY = "prosp_discord_token";
  const GUILD_KEY = "prosp_guild";

  const redirectUri = () =>
    location.hostname === "localhost"
      ? `${location.origin}/callback.html`
      : "https://kayolomolo.github.io/prospengine-dashboard/callback.html";

  function loginUrl() {
    // Onthoud waar we vandaan kwamen zodat callback.html terug kan sturen.
    sessionStorage.setItem("prosp_return", location.pathname.split("/").pop() || "index.html");
    const p = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(),
      response_type: "token",
      scope: "identify guilds",
    });
    return `https://discord.com/api/oauth2/authorize?${p.toString()}`;
  }

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(GUILD_KEY); };
  const getGuild = () => localStorage.getItem(GUILD_KEY);
  const setGuild = (id) => localStorage.setItem(GUILD_KEY, id);

  async function apiGet(path) {
    const headers = {};
    const t = getToken();
    if (t) headers.Authorization = "Bearer " + t;
    const r = await fetch(API + path, { headers });
    if (r.status === 401) { clearToken(); throw new Error("401"); }
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
    return r.json();
  }
  async function apiPost(path, body) {
    const headers = { "Content-Type": "application/json" };
    const t = getToken();
    if (t) headers.Authorization = "Bearer " + t;
    const r = await fetch(API + path, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.status);
    return data;
  }

  async function myGuilds() {
    return (await apiGet("/api/my-guilds")).guilds || [];
  }

  window.PROSP_AUTH = {
    loginUrl, getToken, setToken, clearToken, getGuild, setGuild,
    isLoggedIn: () => !!getToken(),
    apiGet, apiPost, myGuilds,
  };
})();
