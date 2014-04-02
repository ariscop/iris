
qwebirc.irc.IRCConnection = new Class({
  Implements: [Events, Options],
  options: {
    timeout: 45000,
    maxRetries: 5,
  },
  initialize: function(session, options) {
    this.setOptions(options);

    this.buffer = "";
    FlashSocket.state = this.__state.bind(this);
  },
  connect: function() {
    this.buffer = "";
    FlashSocket.connect("irc.ipv4.ponychat.net", 6667, 8430);
  },
  connected: function() {
    this.fireEvent("recv", [["connect"]]);
  },
  disconnect: function() {
    FlashSocket.disconnect();
  },
  disconnected: function(reason) {
    reason = reason || "Connection Closed";
    this.fireEvent("recv", [["disconnect", reason]]);
  },
  send: function(data, synchronous) {
    FlashSocket.write(String(data)+"\r\n");
  },
  recv: function recv(data) {
    this.buffer += data;
    var m = this.buffer.split("\r\n");
    while (m.length > 1) {
      var msg = m.shift();
      msg = this.__parse(msg);
      this.fireEvent("recv", [msg]);
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
