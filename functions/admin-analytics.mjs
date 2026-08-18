import { getStore } from "@netlify/blobs";

const store = getStore("1mau-analytics");

function ok(req) {
  const token = req.headers.get("x-admin-token");
  return !!token && token === process.env.ADMIN_TOKEN;
}

export default async (req) => {
  if (!ok(req)) return new Response("Unauthorized", {status:401});
  if (req.method !== "GET") return new Response("Method Not Allowed", {status:405});

  const {blobs} = await store.list({prefix:"events/"});
  const events = [];

  // This is intentionally simple for a small portfolio site.
  // For very high traffic, move aggregation to a relational DB.
  for (const b of blobs) {
    const e = await store.get(b.key, {type:"json"});
    if (e) events.push(e);
  }

  const visitors = new Set(events.map(e => e.visitorId).filter(Boolean));
  const sessions = new Set(events.map(e => e.sessionId).filter(Boolean));
  const clicks = events.filter(e => e.type === "click");
  const pageviews = events.filter(e => e.type === "pageview");
  const ends = events.filter(e => e.type === "session_end");

  const by = (arr, key) => arr.reduce((m,e) => {
    const v = e[key] || "Unknown";
    m[v] = (m[v] || 0) + 1;
    return m;
  }, {});

  const clicksByLabel = by(clicks, "label");
  const paths = by(pageviews, "path");
  const countries = by(pageviews, "country");
  const devices = by(pageviews, "device");
  const referrers = by(pageviews, "referrer");

  const avgDuration = ends.length
    ? ends.reduce((s,e) => s + (e.duration || 0), 0) / ends.length
    : 0;

  const last5 = [...events]
    .sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))
    .slice(0, 50);

  const recentCutoff = Date.now() - 5 * 60 * 1000;
  const live = new Set(
    events.filter(e => new Date(e.timestamp).getTime() >= recentCutoff)
      .map(e => e.visitorId)
      .filter(Boolean)
  ).size;

  return Response.json({
    totalEvents: events.length,
    pageViews: pageviews.length,
    uniqueVisitors: visitors.size,
    sessions: sessions.size,
    clicks: clicks.length,
    avgDuration,
    liveVisitors: live,
    clicksByLabel,
    paths,
    countries,
    devices,
    referrers,
    recent: last5
  });
};