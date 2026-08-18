import { getStore } from "@netlify/blobs";

const store = getStore("1mau-games", {consistency:"strong"});

async function getGames() {
  return (await store.get("games.json", {type:"json"})) || [];
}

async function saveGames(games) {
  await store.setJSON("games.json", games);
  return games;
}

async function getRobloxGame(input) {
  const match = String(input).match(/roblox\.com\/games\/(\d+)/i);
  const placeId = match?.[1] || String(input).match(/^\d+$/)?.[0];
  if (!placeId) throw new Error("Invalid Roblox game URL.");

  const detailsRes = await fetch(
    `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`
  );
  if (!detailsRes.ok) throw new Error("Roblox game could not be loaded.");
  const details = await detailsRes.json();
  const d = details?.[0];
  if (!d?.universeId) throw new Error("Roblox game not found.");

  const universeId = d.universeId;
  const [gameRes, thumbRes] = await Promise.all([
    fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`),
    fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`)
  ]);

  const game = (await gameRes.json())?.data?.[0] || {};
  const thumb = (await thumbRes.json())?.data?.[0]?.imageUrl || "";

  return {
    placeId,
    universeId,
    name: game.name || d.name || "Roblox Game",
    description: game.description || "",
    creator: game.creator?.name || d.creator?.name || "",
    playing: game.playing ?? 0,
    visits: game.visits ?? 0,
    thumbnail: thumb,
    url: `https://www.roblox.com/games/${placeId}`
  };
}

async function authorized(req) {
  // The admin page sends this header. Set ADMIN_TOKEN in Netlify environment variables.
  const token = req.headers.get("x-admin-token");
  return !!token && token === process.env.ADMIN_TOKEN;
}

export default async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const games = await getGames();
    return Response.json(games.filter(g => g.visible !== false).sort((a,b) => a.order - b.order));
  }

  if (!(await authorized(req))) return new Response("Unauthorized", {status:401});

  try {
    const games = await getGames();

    if (req.method === "POST") {
      const body = await req.json();
      const roblox = await getRobloxGame(body.robloxUrl);
      const game = {
        id: crypto.randomUUID(),
        ...roblox,
        description: body.description || roblox.description,
        buttonText: body.buttonText || "Play Game",
        featured: !!body.featured,
        visible: body.visible !== false,
        order: Number.isFinite(body.order) ? body.order : games.length + 1,
        createdAt: new Date().toISOString()
      };
      await saveGames([...games, game]);
      return Response.json(game, {status:201});
    }

    if (req.method === "PUT") {
      const body = await req.json();
      const index = games.findIndex(g => g.id === body.id);
      if (index < 0) return new Response("Not Found", {status:404});

      let next = {...games[index], ...body};
      if (body.robloxUrl && body.robloxUrl !== games[index].url) {
        next = {...next, ...(await getRobloxGame(body.robloxUrl))};
      }
      games[index] = next;
      await saveGames(games);
      return Response.json(next);
    }

    if (req.method === "DELETE") {
      const body = await req.json();
      await saveGames(games.filter(g => g.id !== body.id));
      return Response.json({ok:true});
    }

    return new Response("Method Not Allowed", {status:405});
  } catch (e) {
    return Response.json({error:e.message || "Server error"}, {status:500});
  }
};