"use strict";

FlashSocket = new Class({
  Implements: [Events],
  Binds: ['_state'],

  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,

  initialize: function(url, protocol) {
    this.url = new URI(url);
    this.protocol = protocol;
    var server = this.url.get("host");
    var port = Number(this.url.get("host"));
    var xmlport = Number(this.url.getData("xmlport"));

    this.buffer = [];

    FlashSocket.swf.state = this._state;
    FlashSocket.swf.connect();
  },

  onopen:  function() {},
  onerror: function() {},
  onclose: function() {},

  close: function(code, reason) {
    /* code and reason ignored */
    FlashSocket.swf.disconnect();
  },
  send: function(data) {
    FlashSocket.swf.write(String(data)+"\r\n");
    return true;
  },

  _connected: function() {
    this.fireEvent("open", {});
  },
  _disconnected: function(reason) {
    reason = reason || "Connection Closed";
    var ev = {reason: reason}
    this.fireEvent("close", ev);
    
  },
  _recv: function(data) {
    var LF = 10;
    var buffer = this.buffer.concat(data);
    var i = buffer.indexOf(LF);
    while(i != -1) {
      var msg = buffer.splice(0, i+1);
      msg.pop(); //LF
      msg.pop(); //CR
      this.fireEvent("recv", [["c", this._decode(msg)]]);
      i = buffer.indexOf(LF);
    }
    this.buffer = buffer;
  },
  _decode: function(buffer) {
    /* Decode a utf-8 buffer into a java string */
    var replace = 65533; //U+FFFD 'REPLACEMENT CHARACTER'
    var points = [];
    var i = 0;
    while(i < buffer.length) {
      var len = 0;
      var point = 0;
      if ((buffer[i] & 0x80) == 0x00) {
        point = buffer[i++]
      } else if((buffer[i] & 0xE0) == 0xC0) {
        len = 1;
        point = (buffer[i++] & 0x1F);
      } else if((buffer[i] & 0xF0) == 0xE0) {
        len = 2;
        point = (buffer[i++] & 0x0F)
      } else if((buffer[i] & 0xF8) == 0xF0) {
        len = 3;
        point = (buffer[i++] & 0x07)
      } else {
        point = replace;
        i++;
      }
      for(x = 0; x < len && i < buffer.length; x++) {
        var octet = buffer[i++];
        if((octet & 0xC0) != 0x80)
          break;
        point = (point << 6) | (octet & 0x3F);
      }
      /* Prevent ascii being snuck past in unicode */
      if(len != 0 && point < 0x80)
        point = replace;
      /* Replace partial characters */
      if(x != len)
        point = replace;

      if(point >= 0x10000) {
        point -= 0x10000;
        points.push((point >>   10) + 0xD800);
        points.push((point % 0x400) + 0xDC00);
      } else {
        points.push(point);
      }
    }
    return String.fromCharCode.apply(null, points);
  },
  _state: function(state, msg) {
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

FlashSocket.available = function() {
    return !FlashSocket.swf.connect;
}
