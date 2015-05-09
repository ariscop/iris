
qwebirc.irc.WSConnection = new Class({
  Implements: [Events, Options],
  Binds: ["connected", "disconnected", "recv"],
  options: {
    url: "ws://irc.example.com/",
    timeout: 45000,
  },
  initialize: function(options) {
    this.setOptions(options, conf.websocket);
  },
  connect: function() {
    if(!window.WebSocket) {
      this.fireEvent("recv", [["disconnect", "No WebSocket Support"]]);
      return;
    }
    this.socket = new WebSocket(this.options.url, "irc");
    this.socket.onopen = this.connected;
    this.socket.onclose = this.disconnected;
    this.socket.onmessage = this.recv;
  },
  connected: function(e) {
    this.fireEvent("recv", [["connect"]]);
  },
  disconnect: function() {
    this.socket.close();
  },
  disconnected: function(e) {
    this.fireEvent("recv", [["disconnect", ""+(e.reason ? e.reason : "Unknown reason")+" ("+e.code+")"]]);
  },
  send: function(data, synchronous) {
    this.socket.send(String(data));
    return true;
  },
  recv: function recv(message) {
    this.fireEvent("recv", [["c", message.data]]);
  }
});
