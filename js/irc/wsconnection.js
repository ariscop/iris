
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
    this.connecting = true;
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
    
    this.socket = new WebSocket(url, "qwebirc");
    this.socket.onmessage = function(msg) {
        var x = JSON.parse(String(msg.data));
        this.fireEvent("recv", [x]);
    }.bind(this);
    
    this.socket.onopen = function() {
        this.connecting = false;
    }.bind(this);
    
    this.socket.onerror = function(CloseEvent) {
        if(this.connecting)
            this.fireEvent("recv", [["reconnect"]]);
        this.fireEvent("error", "WebSocket Error: " + CloseEvent.reason);
    }.bind(this);
  },
  disconnect: function() {
      this.socket.close();
  }
});
