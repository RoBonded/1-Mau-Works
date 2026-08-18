(() => {
  const ENDPOINT = "/.netlify/functions/analytics";
  const KEY = "mau_analytics_visitor";
  const SESSION = "mau_analytics_session";
  const started = Date.now();

  const id = () => {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(KEY, v);
    }
    return v;
  };

  let session = sessionStorage.getItem(SESSION);
  const isNewSession = !session;
  if (!session) {
    session = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    sessionStorage.setItem(SESSION, session);
  }

  function send(type, data = {}) {
    const payload = JSON.stringify({
      type,
      visitorId: id(),
      sessionId: session,
      path: location.pathname,
      title: document.title,
      referrer: document.referrer || "",
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" :
              /Tablet|iPad/i.test(navigator.userAgent) ? "tablet" : "desktop",
      ...data
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], {type:"application/json"}));
    } else {
      fetch(ENDPOINT, {method:"POST", headers:{"Content-Type":"application/json"}, body:payload, keepalive:true}).catch(()=>{});
    }
  }

  send("pageview", {newSession: isNewSession});

  document.addEventListener("click", (e) => {
    const el = e.target.closest("a,button,[data-analytics]");
    if (!el) return;
    const label = el.dataset.analytics ||
      el.getAttribute("aria-label") ||
      el.textContent.trim().replace(/\s+/g, " ").slice(0, 120) ||
      "unknown";
    send("click", {
      label,
      href: el.href || "",
      id: el.id || "",
      className: typeof el.className === "string" ? el.className : ""
    });
  }, {passive:true});

  let maxScroll = 0;
  window.addEventListener("scroll", () => {
    const doc = document.documentElement;
    const percent = Math.round((scrollY / Math.max(1, doc.scrollHeight - innerHeight)) * 100);
    maxScroll = Math.max(maxScroll, Math.min(100, percent));
  }, {passive:true});

  function finish() {
    send("session_end", {
      duration: Math.max(0, Date.now() - started),
      scrollDepth: maxScroll
    });
  }
  window.addEventListener("pagehide", finish);
})();