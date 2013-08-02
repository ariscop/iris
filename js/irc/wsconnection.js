
function parseIrcMessage(s) {
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
}

qwebirc.irc.WebSocketIRCConnection = new Class({
  Implements: [Events, Options],
  session: null,
  options: {
    initialNickname: "ircconnX",
    timeout: 45000,
    floodInterval: 200,
    floodMax: 10,
    floodReset: 5000,
    errorAlert: true,
    maxRetries: 5,
    serverPassword: null,
    authUser: null,
    authSecret: null
  },
  initialize: function(session, options) {
    this.session = session;
    this.setOptions(options);

    this.initialNickname = this.options.initialNickname;

    this.counter = 0;
    this.disconnected = false;
    this.socket = null;
  },
  
  send: function(data, synchronous) {
    this.socket.send(data);
    return true;
  },
  connect: function() {
    var url = 
        "ws://"+window.location.host+conf.frontend.dynamic_base_url+"ws?";
    
    url+="nick=" + encodeURIComponent(this.initialNickname);
    if($defined(this.options.serverPassword))
      url+="&password=" + encodeURIComponent(this.options.serverPassword);
    if($defined(this.options.authUser) && $defined(this.options.authSecret)) {
      url+="&authUser=" + encodeURIComponent(this.options.authUser);
      url+="&authSecret=" + encodeURIComponent(this.options.authSecret);
    }
    
    this.socket = new WebSocket(url, "irc");
    this.socket.onmessage = function(msg) {
        var x = JSON.parse(String(msg.data));
        this.fireEvent("recv", [x]);
    }.bind(this);
    this.socket.onopen = function() {
    }.bind(this);
    this.socket.onerror = function(CloseEvent) {
        this.fireEvent("error", "WebSocket Error: " + CloseEvent.reason);
    }.bind(this);
  },
  disconnect: function() {
      this.socket.close();
  }
});
