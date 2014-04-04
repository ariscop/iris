
qwebirc.irc.IRCConnection = new Class({
  Implements: [Events, Options],
  options: {
    host: "irc.example.com",
    port: 6667,
    xmlport: 8430,
    timeout: 45000,
    maxRetries: 5,
  },
  initialize: function(session, options, client) {
    this.setOptions(options);

    this.buffer = "";
    this.client = client;
    FlashSocket.state = this.__state.bind(this);
  },
  connect: function() {
    this.buffer = "";
    if(!FlashSocket.connect) {
      this.client.dispatch(["disconnect", "Error: This client requires flash"]);
      return;
    }
    FlashSocket.connect(this.options.host, this.options.port, this.options.xmlport);
  },
  connected: function() {
    this.client.dispatch(["connect"]);
  },
  disconnect: function() {
    FlashSocket.disconnect();
  },
  disconnected: function(reason) {
    reason = reason || "Connection Closed";
    this.client.dispatch(["disconnect", reason]);
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
      msg = this.__parse(msg);
      this.client.dispatch(msg);
    }
    this.buffer = m[0];
  },
  __parse: function(s) {
    var command = '';
    var prefix = '';
    var args = [];
    var trailing = [];

    if (s[0] == ':') {
        var index = s.indexOf(' ');
        prefix = s.substring(1, index);
        s = s.substring(index + 1);
    }
    if (s.indexOf(' :') != -1) {
        var index = s.indexOf(' :');
        trailing = s.substring(index + 2);
        args = s.substring(0, index).split(' ');
        args.push(trailing);
    } else {
        args = s.split(' ');
    }

    command = args.splice(0, 1)[0];
    return ["c", command, prefix, args];
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
