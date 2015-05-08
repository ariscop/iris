(function() {
"use strict";

/* Allow mootools.URI to parse irc urls */
URI.prototype.schemes.irc = 6667;

qwebirc.irc.beginConnect = function(session, connOptions) {
  session.connections = new qwebirc.irc.Connections(conf.connections);
}

function nextConnection(session) {
  var conn = session.connections.next();

  session.irc.serverError("Connection started");

  if(!conn) {
    session.irc.serverError("Failed to connect");
    return;
  }

  conn.onopen = (function(e) {
    if(session.irc.socket === conn)
      session.irc.connected();
  });

  conn.onmessage = (function(e) {
    if(session.irc.socket === conn)
      session.irc.recv(e.data);
  });

  conn.onerror = (function(e) {
    if(session.irc.socket === conn)
      session.irc.serverError(""+(e.reason ? e.reason : "Unknown error")+" ("+e.code+")");
  });

  conn.onclose = (function(e) {
    if(!(session.irc.socket === conn))
      return;
    if(session.irc.__signedOn)
      session.irc.disconnected(""+(e.reason ? e.reason : "Unknown reason")+" ("+e.code+")")
    else
      nextConnection(session);
  });

  session.irc.connect(conn);
}

qwebirc.irc.Connections = new Class({
  initialize: function(urls) {
    this.urls = urls.map(function(url) {
      return new URI(url);
    });
  },
  next: function() {
    var url = this.urls.shift();

    /* no url's left */
    if(!url)
      return null;

    switch(url.get("scheme")) {
    case 'irc':
      if(FlashSocket.available())
        return new FlashSocket(url.toString, "irc");
      break;

    case 'wss':
    case 'ws':
      if(WebSocket)
        return new WebSocket(url.toString, "irc");
      break;
    default:
    /* Fallthrough */
    }
    /* No connection found, try next one */
    return tryConnect();
  }
})

})()
