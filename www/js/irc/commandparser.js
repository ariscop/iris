qwebirc.irc.BaseCommandParser = new Class({
  initialize: function(session) {
    this.session = session;
  },
  buildExtra: function(extra, target, message) {
    if(!extra)
      extra = {}

    extra["n"] = this.session.irc.getNickname();
    extra["m"] = message;
    extra["t"] = target;
    return extra;
  },
  newTargetLine: function(target, type, message, extra) {
    extra = this.buildExtra(extra, target, message);
    var window = ui.getWindow(type, target);
    var channel;
    if(!window) {
      type = "TARGETED" + type;
      target = false;
      this.session.irc.newActiveLine("OUR" + type, extra);
      return;
    } else if(window.type == qwebirc.ui.WINDOW_CHANNEL) {
      this.session.irc.newChanLine(target, "OURCHAN" + type, null, extra);
      return;
    } else {
      type = "PRIV" + type;
    }

    this.session.irc.newLine(target, "OUR" + type, extra);
  },
  newQueryLine: function(target, type, message, extra) {
    extra = this.buildExtra(extra, target, message);

    if(conf.dedicated_msg_window) {
      var window = ui.getWindow(type, target);
      if(!window) {
        var w = ui.newWindow(qwebirc.ui.WINDOW_MESSAGES, "Messages");
        w.addLine("OURTARGETED" + type, extra);
        return;
      }
    }
    return this.newTargetLine(target, type, message, extra);
  },
  dispatch: function(line) {
    if(line.length == 0)
      return;

    if(line.charAt(0) != "/")
      line = "/SAY " + line;

    var line = line.substr(1);
    var allargs = line.splitMax(" ", 2);
    var command = allargs[0].toUpperCase();
    var args = allargs[1];

    var aliascmd = this.aliases[command];
    if(aliascmd)
      command = aliascmd;

    for(;;) {
      var cmdopts = this["cmd_" + command];
      if(!cmdopts) {
        if(args) {
          this.sendRaw(command + " " + args);
        } else {
          this.send(command);
        }
        return;
      }

      var activewin = cmdopts[0];
      var splitargs = cmdopts[1];
      var minargs = cmdopts[2];
      var fn = cmdopts[3];

      var w = this.getActiveWindow();
      if(activewin && ((w.type != qwebirc.ui.WINDOW_CHANNEL) && (w.type != qwebirc.ui.WINDOW_QUERY))) {
        w.errorMessage("Can't use this command in this window");
        return;
      }

      if((splitargs != undefined) && (args != undefined))
        args = args.splitMax(" ", splitargs);

      if((minargs != undefined) && (
           ((args != undefined) && (minargs > args.length)) ||
           ((args == undefined) && (minargs > 0))
         )) {
        w.errorMessage("Insufficient arguments for command.");
        return;
      }

      var ret = fn.run([args], this);
      if(ret == undefined)
        return;

      command = ret[0];
      args = ret[1];
    }
  },
  getActiveWindow: function() {
    return this.session.irc.getActiveWindow();
  },
  send: function() {
    return this.session.irc.send.apply(this.session.irc, arguments);
  },
  sendRaw: function(data) {
    return this.session.irc.sendRaw(data);
  }
});
