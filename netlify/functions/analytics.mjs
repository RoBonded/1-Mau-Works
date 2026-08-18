import { getStore } from "@netlify/blobs";

const store = getStore("1mau-analytics");

function clean(value, max = 500) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {status: 405});
  }

  try {
    const body = await req.json();
    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: clean(body.type, 40),
      visitorId: clean(body.visitorId, 100),
      sessionId: clean(body.sessionId, 100),
      path: clean(body.path, 300),
      title: clean(body.title, 300),
      referrer: clean(body.referrer, 1000),
      screen: clean(body.screen, 50),
      language: clean(body.language, 50),
      timezone: clean(body.timezone, 100),
      device: clean(body.device, 30),
      label: clean(body.label, 200),
      href: clean(body.href, 1000),
      duration: Number.isFinite(body.duration) ? Math.min(body.duration, 86400000) : 0,
      scrollDepth: Number.isFinite(body.scrollDepth) ? Math.min(Math.max(body.scrollDepth,0),100) : 0,
      country: clean(req.headers.get("x-nf-country") || "", 10)
    };

    if (!event.type) return new Response("Bad Request", {status:400});

    await store.setJSON(`events/${Date.now()}-${event.id}.json`, event);
    return Response.json({ok:true});
  } catch {
    return new Response("Bad Request", {status:400});
  }
};