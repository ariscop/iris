/* Create the client UI. */
qwebirc.ui.create = function(element, uiclass) {

  /* Initialise our Atheme login and single session. */
  session = new qwebirc.session();

  /* Now wait until all the JS is loaded. */
  window.addEvent("domready", function() {

    /* Create UI. */
    ui = new uiclass(this.session, $(element));

    session.irc = new qwebirc.irc.IRCClient(session);
    window.onbeforeunload = qwebirc.ui.onbeforeunload;
    window.addEvent("unload", function() {
      session.irc.quit("Web client closed");
    });

    /* Define login function. */
    var callback = function(connOptions) {
      session.irc.connect(connOptions);
    };

    /* Create login window. */
    ui.connectWindow(callback);

    /* If enabled, open channel list. */
    if (conf.atheme.chan_list_on_start) {
      if (qwebirc.ui.Panes.List)
        ui.addPane("List");
    }
  });
};


/* Displays a warning if the user tries to close their browser. */
qwebirc.ui.onbeforeunload = function(e) { /* IE sucks */
  if (qwebirc.connected) {
    var message = "This action will close all active IRC connections.";
    var e = e || window.event;
    if(e)
      e.returnValue = message;
    return message;
  }
};
