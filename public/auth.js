(() => {
  const SUPABASE_URL = window.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) {
    window.authFetch = () => {
      throw new Error("Supabase config missing.");
    };
    console.warn("Supabase config missing.");
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = supabase;

  const ensureAuthBanner = () => {
    let banner = document.getElementById("authBanner");
    if (banner) return banner;
    banner = document.createElement("div");
    banner.id = "authBanner";
    banner.className = "auth-banner";
    banner.innerHTML = `
      <div>
        <strong>Sign in required.</strong>
        <span>Use your company Google account to continue.</span>
      </div>
      <button id="authLoginBtn" type="button">Sign in with Google</button>
    `;
    document.body.appendChild(banner);
    banner.querySelector("#authLoginBtn").addEventListener("click", () => {
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.href },
      });
    });
    return banner;
  };

  const hideBanner = () => {
    const banner = document.getElementById("authBanner");
    if (banner) banner.remove();
  };

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  };

  window.authFetch = async (url, options = {}) => {
    const token = await getAccessToken();
    if (!token) {
      ensureAuthBanner();
      throw new Error("Not authenticated");
    }
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 || response.status === 403) {
      ensureAuthBanner();
    } else {
      hideBanner();
    }
    return response;
  };

  window.signOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };
})();
