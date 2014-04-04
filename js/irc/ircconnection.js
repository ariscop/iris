
qwebirc.irc.IRCConnection = new Class({
  Implements: [Options],
  options: {
    host: "irc.example.com",
    port: 6667,
    xmlport: 8430,
    timeout: 45000,
    maxRetries: 5,
  },
  initialize: function(session, options, client) {
    this.setOptions(options);

    this.client = client;
    FlashSocket.state = this.__state.bind(this);
  },
  connect: function() {
    this.buffer = "";
    if(!FlashSocket.connect) {
      this.client.disconnected("Error: This client requires flash");
      return;
    }
    FlashSocket.connect(this.options.host, this.options.port, this.options.xmlport);
  },
  connected: function() {
    this.client.connected();
  },
  disconnect: function() {
    FlashSocket.disconnect();
  },
  disconnected: function(reason) {
    this.client.disconnected(reason);
  },
  send: function(data, synchronous) {
    FlashSocket.write(String(data)+"\r\n");
    return true;
  },
  recv: function recv(data) {
    this.buffer += data;
    var m = this.buffer.split("\r\n");
    while (m.length > 1) {
      var msg = m.shift();
      this.client.recv(msg);
    }
    this.buffer = m[0];
  },
  __state: function(state, msg) {
    if(state == 1 /* OPEN */)
        this.connected();
    if(state == 3 /* CLOSED */)
        this.disconnected();
    if(state == 4 /* ERROR */)
        this.disconnected(msg);
    if(state == 5 /* MESSAGE */)
        this.recv(msg);
  }
});
