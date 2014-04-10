
qwebirc.irc.FlashConnection = new Class({
  Implements: [Events, Options],
  options: {
    initialNickname: "ircconnX",
    server: "irc.example.com",
    port: 6667,
    xmlport: 8430,
    timeout: 45000,
    maxRetries: 5,
    serverPassword: null
  },
  initialize: function(session, options) {
    this.setOptions(options, conf.flash);
  },
  connect: function() {
    this.raw_buffer = [];
    this.buffer = "";
    if(!FlashSocket.connect) {
      this.fireEvent("recv", [["disconnect", "No Flash support"]]);
      return;
    }
    FlashSocket.state = this.__state.bind(this);
    FlashSocket.connect(this.options.server, this.options.port, this.options.xmlport);
  },
  connected: function() {
    this.send("CAP LS");
    this.send("USER "+this.options.initialNickname+" 0 * :qwebirc");
    if(this.options.serverPassword)
      this.send("PASS :"+this.options.serverPassword);
    this.send("NICK "+this.options.initialNickname);
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
    return true;
  },
  recv: function recv(data) {
    var utf8len = function(code) {
      if(     (code & 0x80) == 0x00) return 1;
      else if((code & 0xE0) == 0xC0) return 2;
      else if((code & 0xF0) == 0xE0) return 3;
      else if((code & 0xF8) == 0xF0) return 4;
      else return 1; /* invalid */
    }
    var decode = function(arr, out) {
      var point = 0;
      switch(arr.length) {
      case 1:
        point = arr[0];
        break;
      case 2:
        point  = (arr[0] & 0x1F) << 6;
        point |= (arr[1] & 0x3F);
        break;
      case 3:
        point  = (arr[0] & 0x0F) << 12;
        point |= (arr[1] & 0x3F) << 6;
        point |= (arr[2] & 0x3F);
        break;
      case 4:
        point  = (arr[0] & 0x07) << 18;
        point |= (arr[1] & 0x3F) << 12;
        point |= (arr[2] & 0x3F) << 6;
        point |= (arr[3] & 0x3F);
        break;
      }
      if(point >= 0x10000) {
        point -= 0x10000;
        out.push((point >>   10) + 0xD800,
                 (point % 0x400) + 0xDC00);
      } else {
        out.push(point);
      }
    }
    var i = 0, points = [];
    var raw = this.raw_buffer.concat(data);
    while(1) {
      var len = utf8len(raw[i]);
      if(len > (raw.length - i))
        break;
      decode(raw.slice(i, i+len), points);
      i += len;
    }
    this.raw_buffer = raw.splice(i);
    this.buffer += String.fromCharCode.apply(null, points);

    var m = this.buffer.split("\r\n");
    while (m.length > 1)
      this.fireEvent("recv", [["c", m.shift()]]);
    this.buffer = m[0];
  },
  __state: function(state, msg) {
    if(state == 1 /* OPEN */)
      this.connected();
    if(state == 3 /* CLOSED */)
      this.disconnected();
    if(state == 4 /* ERROR */)
      this.disconnected(msg);
    if(state == 5 /* MESSAGE */) {
      this.recv(JSON.parse(msg));
    }
  }
});
