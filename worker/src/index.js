// カタン盤面メーカー 中継サーバー
// 部屋コードごとに Durable Object を1つ持ち、つながっている端末同士で
// WebSocket メッセージをそのまま転送するだけの小さなサーバーです。
// メッセージの中身は見ません。保存もしません。

export class Room {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket で接続してください", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // ハイバネーション対応で受け付ける（待機中は課金も CPU も使わない）
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ t: "hello", peers: this.ctx.getWebSockets().length - 1 }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    for (const peer of this.ctx.getWebSockets()) {
      if (peer === ws) continue;
      try { peer.send(message); } catch (_) { /* 切れた相手は無視 */ }
    }
  }

  webSocketClose(ws, code) {
    try { ws.close(code, "closed"); } catch (_) {}
  }

  webSocketError(ws) {
    try { ws.close(1011, "error"); } catch (_) {}
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{4,12})$/);
    if (!m) {
      return new Response("catan relay: /room/<CODE> に WebSocket で接続します", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    const id = env.ROOMS.idFromName(m[1].toUpperCase());
    return env.ROOMS.get(id).fetch(request);
  },
};
