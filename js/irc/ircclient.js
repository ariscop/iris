qwebirc.irc.PMODE_LIST = 0;
qwebirc.irc.PMODE_SET_UNSET = 1;
qwebirc.irc.PMODE_SET_ONLY = 2;
qwebirc.irc.PMODE_REGULAR_MODE = 3;

qwebirc.irc.RegisteredCTCPs = {
  "VERSION": function(x) {
    return "iris v" + qwebirc.VERSION + " -- " + qwebirc.util.browserVersion();
  },
  "USERINFO": function(x) { return "qwebirc"; },
  "TIME": function(x) { return qwebirc.irc.IRCDate(new Date()); },
  "PING": function(x) { return x; },
  "CLIENTINFO": function(x) { return "PING VERSION TIME USERINFO CLIENTINFO WEBSITE"; },
  "WEBSITE": function(x) { return window == window.top ? "direct" : document.referrer; }
};

qwebirc.irc.IRCClient = new Class({
  Implements: [Events, Options],
  options: {
  },
  session: null,
  initialize: function(session) {
    this.session = session;

    this.toIRCLower = qwebirc.irc.RFC1459toIRCLower;

    this.nickname = conf.frontend.initial_nick;

    this.signedOn = false;
    this.caps = {};
    this.pmodes = {
        b: qwebirc.irc.PMODE_LIST,
        l: qwebirc.irc.PMODE_SET_ONLY,
        k: qwebirc.irc.PMODE_SET_UNSET,
        o: qwebirc.irc.PMODE_SET_UNSET,
        v: qwebirc.irc.PMODE_SET_UNSET
    };
    this.channels = {}

    this.connection = new qwebirc.irc.IRCConnection(session, conf.connection, this);

    this.setupGenericErrors();

    this.prefixes = "@+";
    this.modeprefixes = "ov";
    this.autojoin = "";

    this.commandparser = new qwebirc.irc.Commands(session);
    this.exec = this.commandparser.dispatch.bind(this.commandparser);

    this.hilightController = new qwebirc.ui.HilightController(session);
    this.statusWindow = ui.newClient();
    this.lastNicks = [];

    this.inviteChanList = [];
    this.activeTimers = {};

    this.tracker = new qwebirc.irc.IRCTracker(this);
  },
  connect: function(connOptions) {
    if(connOptions.autojoin)
      this.autojoin = connOptions.autojoin;
    if(connOptions.nickname)
      this.nickname = connOptions.nickname;
    this.connection.connect();
    this.newServerLine("CONNECTING");
  },
  send: function(data) {
    return this.connection.send(data);
  },
  newLine: function(window, type, data) {
    if(!data)
      data = {};

    var w = ui.getWindow(type, window);
    if(w) {
      w.addLine(type, data);
    } else {
      this.statusWindow.addLine(type, data);
    }
  },
  newChanLine: function(channel, type, user, extra) {
    if(!extra)
      extra = {};

    if($defined(user)) {
      extra["n"] = user.hostToNick();
      extra["h"] = user.hostToHost();
    }
    extra["c"] = channel;
    extra["-"] = this.nickname;

    if(!(conf.ui.nick_status))
      delete extra["@"];

    this.newLine(channel, type, extra);
  },
  newServerLine: function(type, data) {
    this.statusWindow.addLine(type, data);
  },
  newActiveLine: function(type, data) {
    this.getActiveWindow().addLine(type, data);
  },
  newTargetOrActiveLine: function(target, type, data) {
    if(ui.getWindow(type, target)) {
      this.newLine(target, type, data);
    } else {
      this.newActiveLine(type, data);
    }
  },
  updateNickList: function(channel) {
    var n1 = this.tracker.getChannel(channel);
    var names = new Array();
    var tff = String.fromCharCode(255);
    var nh = {}

    /* MEGAHACK */
    for(var n in n1) {
      var nc = n1[n];
      var nx;

      if(nc.prefixes.length > 0) {
        var c = nc.prefixes.charAt(0);
        nx = String.fromCharCode(this.prefixes.indexOf(c)) + this.toIRCLower(n);
        nh[nx] = c + n;
      } else {
        nx = tff + this.toIRCLower(n);
        nh[nx] = n;
      }
      names.push(nx);
    };

    names.sort();

    var sortednames = new Array();
    names.each(function(name) {
      sortednames.push(nh[name]);
    });

    var w = ui.getWindow(qwebirc.ui.WINDOW_CHANNEL, channel);
    if(w)
      w.updateNickList(sortednames);
  },
  newWindow: function(name, type, select) {
    var w = ui.newWindow(type, name);

    if(select)
      ui.selectWindow(w);

    return w;
  },
  newQueryWindow: function(name, privmsg) {
    var e;

    if(ui.getWindow(qwebirc.ui.WINDOW_QUERY, name))
      return;

    if(privmsg)
      return this.newPrivmsgQueryWindow(name);
    return this.newNoticeQueryWindow(name);
  },
  newPrivmsgQueryWindow: function(name) {
    if(conf.ui.dedicated_msg_window) {
      return ui.newWindow(qwebirc.ui.WINDOW_MESSAGES, "Messages");
    } else {
      return this.newWindow(name, qwebirc.ui.WINDOW_QUERY, false);
    }
  },
  newNoticeQueryWindow: function(name) {
    if(conf.ui.dedicated_notice_window)
      return ui.newWindow(qwebirc.ui.WINDOW_MESSAGES, "Messages");
  },
  newQueryLine: function(window, type, data, privmsg, active) {
    if(ui.getWindow(qwebirc.ui.WINDOW_QUERY, window))
      return this.newLine(window, type, data);

    var w = ui.getWindow(qwebirc.ui.WINDOW_MESSAGES, "Messages");

    var e;
    if(privmsg) {
      e = conf.ui.dedicated_msg_window;
    } else {
      e = conf.ui.dedicated_notice_window;
    }
    if(e && w) {
      return w.addLine(type, data);
    } else {
      if(active) {
        return this.newActiveLine(type, data);
      } else {
        return this.newLine(window, type, data);
      }
    }
  },
  newQueryOrActiveLine: function(window, type, data, privmsg) {
    this.newQueryLine(window, type, data, privmsg, true);
  },
  getActiveWindow: function() {
    return ui.getActiveIRCWindow();
  },
  getNickname: function() {
    return this.nickname;
  },
  addPrefix: function(nickchanentry, prefix) {
    var ncp = nickchanentry.prefixes + prefix;
    var prefixes = [];

    /* O(n^2) */
    for(var i=0;i<this.prefixes.length;i++) {
      var pc = this.prefixes.charAt(i);
      var index = ncp.indexOf(pc);
      if(index != -1)
        prefixes.push(pc);
    }

    nickchanentry.prefixes = prefixes.join("");
  },
  stripPrefix: function(nick) {
    var l = nick.charAt(0);
    if(!l)
      return nick;

    if(this.prefixes.indexOf(l) != -1)
      return nick.substring(1);

    return nick;
  },
  removePrefix: function(nickchanentry, prefix) {
    nickchanentry.prefixes = nickchanentry.prefixes.replaceAll(prefix, "");
  },

  /* from here down are events */
  rawNumeric: function(line, command, prefix, params) {
    this.newServerLine("RAW", {"n": "numeric", "m": params.slice(1).join(" ")});
  },
  userJoined: function(user, channel) {
    var nick = user.hostToNick();
    var host = user.hostToHost();

    if((nick == this.nickname) && !ui.getWindow(qwebirc.ui.WINDOW_CHANNEL, channel))
      this.newWindow(channel, qwebirc.ui.WINDOW_CHANNEL, true);
    this.tracker.addNickToChannel(nick, channel);

    if(nick == this.nickname) {
      this.newChanLine(channel, "OURJOIN", user);
    } else {
      if(!conf.ui.hide_joinparts) {
        this.newChanLine(channel, "JOIN", user);
      }
    }
    this.updateNickList(channel);
  },
  userPart: function(user, channel, message) {
    var nick = user.hostToNick();
    var host = user.hostToHost();

    if(nick == this.nickname) {
      this.tracker.removeChannel(channel);
      var w = ui.getWindow(qwebirc.ui.WINDOW_CHANNEL, channel);
      if(w)
        ui.closeWindow(w);
    } else {
      this.tracker.removeNickFromChannel(nick, channel);
      if(!conf.ui.hide_joinparts) {
        this.newChanLine(channel, "PART", user, {"m": message});
      }
      this.updateNickList(channel);
    }
  },
  userKicked: function(kicker, channel, kickee, message) {
    if(kickee == this.nickname) {
      this.tracker.removeChannel(channel);
      var w = ui.getWindow(qwebirc.ui.WINDOW_CHANNEL, channel);
      if(w)
        ui.closeWindow(w);
    } else {
      this.tracker.removeNickFromChannel(kickee, channel);
      this.updateNickList(channel);
    }

    this.newChanLine(channel, "KICK", kicker, {"v": kickee, "m": message});
  },
  channelMode: function(user, channel, modes, raw) {
    modes.each(function(mo) {
      var direction = mo[0];
      var mode = mo[1];

      var prefixindex = this.modeprefixes.indexOf(mode);
      if(prefixindex == -1)
        return;

      var nick = mo[2];
      var prefixchar = this.prefixes.charAt(prefixindex);

      var nc = this.tracker.getOrCreateNickOnChannel(nick, channel);
      if(direction == "-") {
        this.removePrefix(nc, prefixchar);
      } else {
        this.addPrefix(nc, prefixchar);
      }
    }, this);

    this.newChanLine(channel, "MODE", user, {"m": raw.join(" ")});

    this.updateNickList(channel);
  },
  userQuit: function(user, message) {
    var nick = user.hostToNick();

    var channels = this.tracker.getNick(nick);

    var clist = [];
    for(var c in channels) {
      clist.push(c);
      if(!conf.ui.hide_joinparts) {
        this.newChanLine(c, "QUIT", user, {"m": message});
      }
    }

    this.tracker.removeNick(nick);

    clist.each(function(cli) {
      this.updateNickList(cli);
    }, this);
  },
  nickChanged: function(user, newnick) {
    var oldnick = user.hostToNick();

    if(oldnick == this.nickname)
      this.nickname = newnick;

    this.tracker.renameNick(oldnick, newnick);

    var channels = this.tracker.getNick(newnick);
    var found = false;

    for(var c in channels) {
      var found = true;

      this.newChanLine(c, "NICK", user, {"w": newnick});
      /* TODO: rename queries */
      this.updateNickList(c);
    }

    /* this is quite horrible */
    if(!found)
      this.newServerLine("NICK", {"w": newnick, n: user.hostToNick(), h: user.hostToHost(), "-": this.nickname});
  },
  channelTopic: function(user, channel, topic) {
    this.newChanLine(channel, "TOPIC", user, {"m": topic});
    ui.getWindow(qwebirc.ui.WINDOW_CHANNEL, channel).updateTopic(topic);
  },
  initialTopic: function(channel, topic) {
    ui.getWindow(qwebirc.ui.WINDOW_CHANNEL, channel).updateTopic(topic);
  },
  channelCTCP: function(user, channel, type, args) {
    if(args == undefined)
      args = "";

    var nick = user.hostToNick();
    if(type == "ACTION") {
      this.tracker.updateLastSpoke(nick, channel, new Date().getTime());
      this.newChanLine(channel, "CHANACTION", user, {"m": args, "c": channel, "@": this.getNickStatus(channel, nick)});
      return;
    }

    this.newChanLine(channel, "CHANCTCP", user, {"x": type, "m": args, "c": channel, "@": this.getNickStatus(channel, nick)});
  },
  userCTCP: function(user, type, args) {
    var nick = user.hostToNick();
    var host = user.hostToHost();
    if(args == undefined)
      args = "";

    if(type == "ACTION") {
      this.newQueryWindow(nick, true);
      this.newQueryLine(nick, "PRIVACTION", {"m": args, "x": type, "h": host, "n": nick}, true);
      return;
    }

    this.newTargetOrActiveLine(nick, "PRIVCTCP", {"m": args, "x": type, "h": host, "n": nick, "-": this.nickname});
  },
  userCTCPReply: function(user, type, args) {
    var nick = user.hostToNick();
    var host = user.hostToHost();
    if(args == undefined)
      args = "";

    this.newTargetOrActiveLine(nick, "CTCPREPLY", {"m": args, "x": type, "h": host, "n": nick, "-": this.nickname});
  },
  getNickStatus: function(channel, nick) {
    var n = this.tracker.getNickOnChannel(nick, channel);
    if(!$defined(n))
      return "";

    if(n.prefixes.length == 0)
      return "";

    return n.prefixes.charAt(0);
  },
  channelPrivmsg: function(user, channel, message) {
    var nick = user.hostToNick();

    this.tracker.updateLastSpoke(nick, channel, new Date().getTime());
    this.newChanLine(channel, "CHANMSG", user, {"m": message, "@": this.getNickStatus(channel, nick)});
  },
  channelNotice: function(user, channel, message) {
    this.newChanLine(channel, "CHANNOTICE", user, {"m": message, "@": this.getNickStatus(channel, user.hostToNick())});
  },
  userPrivmsg: function(user, message) {
    var nick = user.hostToNick();
    var host = user.hostToHost();
    this.newQueryWindow(nick, true);
    this.pushLastNick(nick);
    this.newQueryLine(nick, "PRIVMSG", {"m": message, "h": host, "n": nick}, true);
  },
  serverNotice: function(user, message) {
    if(user == "") {
      this.newServerLine("SERVERNOTICE", {"m": message});
    } else {
      this.newServerLine("PRIVNOTICE", {"m": message, "n": user});
    }
  },
  userNotice: function(user, message) {
    var nick = user.hostToNick();
    var host = user.hostToHost();

    if(conf.ui.dedicated_notice_window) {
      this.newQueryWindow(nick, false);
      this.newQueryOrActiveLine(nick, "PRIVNOTICE", {"m": message, "h": host, "n": nick}, false);
    } else {
      this.newTargetOrActiveLine(nick, "PRIVNOTICE", {"m": message, "h": host, "n": nick});
    }
  },
  __joinInvited: function() {
    this.exec("/JOIN " + this.inviteChanList.join(","));
    this.inviteChanList = [];
    delete this.activeTimers["serviceInvite"];
  },
  userInvite: function(user, channel) {
    var nick = user.hostToNick();
    var host = user.hostToHost();

    this.newServerLine("INVITE", {"c": channel, "h": host, "n": nick});
  },
  userMode: function(modes) {
    this.newServerLine("UMODE", {"m": modes, "n": this.nickname});
  },
  channelNames: function(channel, names) {
    if(names.length == 0) {
      this.updateNickList(channel);
      return;
    }

    names.each(function(nick) {
      var prefixes = [];
      var splitnick = nick.split("");

      splitnick.every(function(c, i) {
        if(this.prefixes.indexOf(c) == -1) {
          nick = nick.substr(i);
          return false;
        }

        prefixes.push(c);
        return true;
      }, this);

      var nc = this.tracker.addNickToChannel(nick, channel);
      prefixes.each(function(p) {
        this.addPrefix(nc, p);
      }, this);
    }, this);
  },
  disconnected: function(message) {
    for(var x in session.windows) {
      var w = session.windows[x];
      if(w.type == qwebirc.ui.WINDOW_CHANNEL)
        ui.closeWindow(w);
    }
    this.tracker = undefined;

    qwebirc.connected = false;
    this.newServerLine("DISCONNECT", {"m": message});
  },
  nickOnChanHasPrefix: function(nick, channel, prefix) {
    var entry = this.tracker.getNickOnChannel(nick, channel);
    if(!$defined(entry))
      return false; /* shouldn't happen */

    return entry.prefixes.indexOf(prefix) != -1;
  },
  nickOnChanHasAtLeastPrefix: function(nick, channel, prefix, betterThan) {
    var entry = this.tracker.getNickOnChannel(nick, channel);
    if(!$defined(entry))
      return false; /* shouldn't happen */

    /* this array is sorted */
    var pos = this.prefixes.indexOf(prefix);
    if(pos == -1)
      return false;  /* shouldn't happen */

    /* If we're looking for prefixes better than the given prefix, don't
     * include it itself. Otherwise, do. */
    if (!betterThan)
      pos = pos + 1;

    var modehash = {};
    this.prefixes.slice(0, pos).split("").each(function(x) {
      modehash[x] = true;
    });

    var prefixes = entry.prefixes;
    for(var i=0;i<prefixes.length;i++)
      if(modehash[prefixes.charAt(i)])
        return true;

    return false;
  },
  supported: function(key, value) {
    if(key == "PREFIX") {
      var l = (value.length - 2) / 2;

      this.modeprefixes = value.substr(1, l);
      this.prefixes = value.substr(l + 2, l);
    }

    this.parent(key, value);
  },
  connected: function() {
    qwebirc.connected = true;
    this.newServerLine("CONNECT");
    this.send("CAP LS");
    this.send("NICK "+this.nickname);
    this.send("USER iris 0 * : Webchat");
  },
  serverError: function(message) {
    this.newServerLine("ERROR", {"m": message});
  },
  quit: function(message) {
    this.send("QUIT :" + message, true);
    this.disconnect();
  },
  disconnect: function() {
    for(var k in this.activeTimers) {
      this.activeTimers[k].cancel();
    };
    this.activeTimers = {};
    this.connection.disconnect();
  },
  awayMessage: function(nick, message) {
    this.newQueryLine(nick, "AWAY", {"n": nick, "m": message}, true);
  },
  whois: function(nick, type, data) {
    var ndata = {"n": nick};
    var mtype;

    var xsend = function() {
      this.newTargetOrActiveLine(nick, "WHOIS" + mtype, ndata);
    }.bind(this);

    if(type == "user") {
      mtype = "USER";
      ndata.h = data.ident + "@" + data.hostname;
      xsend();
      mtype = "REALNAME";
      ndata.m = data.realname;
    } else if(type == "server") {
      mtype = "SERVER";
      ndata.x = data.server;
      ndata.m = data.serverdesc;
    } else if(type == "oper") {
      mtype = "OPER";
    } else if(type == "idle") {
      mtype = "IDLE";
      ndata.x = qwebirc.util.longtoduration(data.idle);
      ndata.m = qwebirc.irc.IRCDate(new Date(data.connected * 1000));
    } else if(type == "channels") {
      mtype = "CHANNELS";
      ndata.m = data.channels;
    } else if(type == "account") {
      mtype = "ACCOUNT";
      ndata.m = data.account;
    } else if(type == "away") {
      mtype = "AWAY";
      ndata.m = data.away;
    } else if(type == "opername") {
      mtype = "OPERNAME";
      ndata.m = data.opername;
    } else if(type == "actually") {
      mtype = "ACTUALLY";
      ndata.m = data.hostname;
      ndata.x = data.ip;
    } else if(type == "availhelp") {
      mtype = "AVAILHELP";
    } else if(type == "regged") {
      mtype = "REGGED";
    } else if(type == "modes") {
      mtype = "MODES";
      ndata.m = data.modes;
    } else if(type == "realhost") {
      mtype = "REALHOST";
      ndata.m = data.hostname;
      ndata.x = data.ip;
    } else if(type == "generictext") {
      mtype = "GENERICTEXT";
      ndata.m = data.text;
    } else if(type == "end") {
      mtype = "END";
    } else {
      return false;
    }

    xsend();
    return true;
  },
  genericError: function(target, message) {
    this.newTargetOrActiveLine(target, "GENERICERROR", {m: message, t: target});
  },
  genericQueryError: function(target, message) {
    this.newQueryOrActiveLine(target, "GENERICERROR", {m: message, t: target}, true);
  },
  awayStatus: function(state, message) {
    this.newActiveLine("GENERICMESSAGE", {m: message});
  },
  pushLastNick: function(nick) {
    var i = this.lastNicks.indexOf(nick);
    if(i != -1) {
      this.lastNicks.splice(i, 1);
    } else {
      if(this.lastNicks.length == 10)
        this.lastNicks.pop();
    }
    this.lastNicks.unshift(nick);
  },
  wallops: function(user, text) {
    var nick = user.hostToNick();
    var host = user.hostToHost();

    this.newServerLine("WALLOPS", {t: text, n: nick, h: host});
  },
  channelModeIs: function(channel, modes) {
    this.newTargetOrActiveLine(channel, "CHANNELMODEIS", {c: channel, m: modes.join(" ")});
  },
  channelCreationTime: function(channel, time) {
    this.newTargetOrActiveLine(channel, "CHANNELCREATIONTIME", {c: channel, m: qwebirc.irc.IRCDate(new Date(time * 1000))});
  },
  recv: function(s) {
    var line = new qwebirc.irc.IRCMessage(s);
    var n = qwebirc.irc.Numerics[line.command];
    if(!n)
      n = line.command;

    var o = this["irc_" + n];

    if(o && o.run([line, line.prefix, line.params], this))
      return

    this.rawNumeric(line, line.command, line.prefix, line.params);
  },
  isChannel: function(target) {
    var c = target.charAt(0);
    return c == '#';
  },
  supported: function(key, value) {
    if(key == "CASEMAPPING") {
      if(value == "ascii") {
        this.toIRCLower = qwebirc.irc.ASCIItoIRCLower;
      } else if(value == "rfc1459") {
        /* IGNORE */
      } else {
        /* TODO: warn */
      }
    } else if(key == "CHANMODES") {
      var smodes = value.split(",");
      for(var i=0;i<smodes.length;i++)
        for(var j=0;j<smodes[i].length;j++)
          this.pmodes[smodes[i].charAt(j)] = i;
    } else if(key == "PREFIX") {
      var l = (value.length - 2) / 2;

      var modeprefixes = value.substr(1, l).split("");
      modeprefixes.each(function(modeprefix) {
        this.pmodes[modeprefix] = qwebirc.irc.PMODE_SET_UNSET;
      }, this);
    }
  },
  irc_AUTHENTICATE: function(line, prefix, params) {
    /* Silently hide. */
    return true;
  },
  irc_CAP: function(line, prefix, params) {
    switch(params[1]) {
    case "ACK":
      var capslist = [];
      if (params[2] == "*")
        capslist = params[3].split(" ");
      else
        capslist = params[2].split(" ");

      for (var i = 0; i < capslist.length; i++) {
        this.caps[capslist[i]] = true;
        if (capslist[i] == "sasl")
          this.rawNumeric("AUTHENTICATE", prefix, ["*", "Attempting SASL authentication..."]);
      }
      break;
    case "LS":
      if (params[0] == "*")
        this.send("CAP END");
      break;
    }

    return true;
  },
  irc_RPL_WELCOME: function(line, prefix, params) {
    this.nickname = params[0];
    this.signedOn = true;
    this.tracker = new qwebirc.irc.IRCTracker(this);
    this.newServerLine("SIGNON");

    if(this.autojoin) {
      this.exec("/AUTOJOIN");
    }
    this.fireEvent("signedOn");
  },
  irc_NICK: function(line, prefix, params) {
    var user = prefix;
    var oldnick = user.hostToNick();
    var newnick = params[0];

    if(this.nickname == oldnick)
      this.nickname = newnick;

    this.nickChanged(user, newnick);

    return true;
  },
  irc_QUIT: function(line, prefix, params) {
    var user = prefix;

    var message = params.indexFromEnd(-1);

    this.userQuit(user, message);

    return true;
  },
  irc_PART: function(line, prefix, params) {
    var user = prefix;
    var channel = params[0];
    var message = params[1];

    var nick = user.hostToNick();

    if((nick == this.nickname) && this.__getChannel(channel))
      this.__killChannel(channel);

    this.userPart(user, channel, message);

    return true;
  },
  __getChannel: function(name) {
    return this.channels[this.toIRCLower(name)];
  },
  __killChannel: function(name) {
    delete this.channels[this.toIRCLower(name)];
  },
  __nowOnChannel: function(name) {
    this.channels[this.toIRCLower(name)] = 1;
  },
  irc_KICK: function(line, prefix, params) {
    var kicker = prefix;
    var channel = params[0];
    var kickee = params[1];
    var message = params[2];

    if((kickee == this.nickname) && this.__getChannel(channel))
      this.__killChannel(channel);

    this.userKicked(kicker, channel, kickee, message);

    return true;
  },
  irc_PING: function(line, prefix, params) {
    this.send("PONG :" + params.indexFromEnd(-1));

    return true;
  },
  irc_JOIN: function(line, prefix, params) {
    var channel = params[0];
    var user = prefix;
    var nick = user.hostToNick();

    if(nick == this.nickname)
      this.__nowOnChannel(channel);

    this.userJoined(user, channel);

    return true;
  },
  irc_TOPIC: function(line, prefix, params) {
    var user = prefix;
    var channel = params[0];
    var topic = params.indexFromEnd(-1);

    this.channelTopic(user, channel, topic);

    return true;
  },
  processCTCP: function(message) {
    if(message.charAt(0) != "\x01")
      return;

    if(message.charAt(message.length - 1) == "\x01") {
      message = message.substr(1, message.length - 2);
    } else {
      message = message.substr(1);
    }
    return message.splitMax(" ", 2);
  },
  irc_PRIVMSG: function(line, prefix, params) {
    var user = prefix;
    var target = params[0];
    var message = params.indexFromEnd(-1);

    var ctcp = this.processCTCP(message);
    if(ctcp) {
      var type = ctcp[0].toUpperCase();

      var replyfn = qwebirc.irc.RegisteredCTCPs[type];
      if(replyfn) {
        var reply = replyfn(ctcp[1]);
        if(reply)
          this.send("NOTICE " + user.hostToNick() + " :\x01" + type + " " + reply + "\x01");
      }

      if(target == this.nickname) {
        this.userCTCP(user, type, ctcp[1]);
      } else {
        this.channelCTCP(user, target, type, ctcp[1]);
      }
    } else {
      if(target == this.nickname) {
        this.userPrivmsg(user, message);
      } else {
        this.channelPrivmsg(user, target, message);
      }
    }

    return true;
  },
  irc_NOTICE: function(line, prefix, params) {
    var user = prefix;
    var target = params[0];
    var message = params.indexFromEnd(-1);

    /* Handle globals, channel notices, server notices, and other notices. */
    if (target[0] == "$") {
      if (user != "")
        this.userNotice(user, message);
      else
        this.serverNotice(user, message);
    } else if (target != this.nickname && this.signedOn) {
      this.channelNotice(user, target, message);
    } else if((user == "") || (user.indexOf("!") == -1)) {
      this.serverNotice(user, message);
    } else {
      var ctcp = this.processCTCP(message);
      if(ctcp) {
        this.userCTCPReply(user, ctcp[0], ctcp[1]);
      } else {
        this.userNotice(user, message);
      }
    }

    return true;
  },
  irc_INVITE: function(line, prefix, params) {
    var user = prefix;
    var channel = params.indexFromEnd(-1);

    this.userInvite(user, channel);

    return true;
  },
  irc_ERROR: function(line, prefix, params) {
    var message = params.indexFromEnd(-1);

    this.serverError(message);

    return true;
  },
  irc_MODE: function(line, prefix, params) {
    var user = prefix;
    var target = params[0];
    var args = params.slice(1);

    if(target == this.nickname) {
      this.userMode(args);
    } else {
      var modes = args[0].split("");
      var xargs = args.slice(1);

      var data = []
      var carg = 0;
      var pos = 0;
      var cmode = "+";

      modes.each(function(mode) {
        if((mode == "+") || (mode == "-")) {
          cmode = mode;
          return;
        }

        var d;
        var pmode = this.pmodes[mode];
        if(pmode == qwebirc.irc.PMODE_LIST || pmode == qwebirc.irc.PMODE_SET_UNSET || (cmode == "+" && pmode == qwebirc.irc.PMODE_SET_ONLY)) {
          d = [cmode, mode, xargs[carg++]]
        } else {
          d = [cmode, mode]
        }

        data.push(d);
      }, this);

      this.channelMode(user, target, data, args);
    }

    return true;
  },
  irc_RPL_ISUPPORT: function(line, prefix, params) {
    var supported = params.slice(1, -1);

    var items = {};
    for(var i=0;i<supported.length;i++) {
      var l = supported[i].splitMax("=", 2);
      items[l[0]] = true;
    }

    if(items.CHANMODES && items.PREFIX) /* nasty hack */
      this.pmodes = {};

    for(var i=0;i<supported.length;i++) {
      var l = supported[i].splitMax("=", 2);
      this.supported(l[0], l[1]);
    }
  },
  irc_RPL_NAMREPLY: function(line, prefix, params) {
    var channel = params[2];
    var names = params[3];

    this.channelNames(channel, names.split(" "));

    return true;
  },
  irc_RPL_ENDOFNAMES: function(line, prefix, params) {
    var channel = params[1];

    this.channelNames(channel, []);
    return true;
  },
  irc_RPL_NOTOPIC: function(line, prefix, params) {
    var channel = params[1];

    if(this.__getChannel(channel)) {
      this.initialTopic(channel, "");
      return true;
    }
  },
  irc_RPL_TOPIC: function(line, prefix, params) {
    var channel = params[1];
    var topic = params.indexFromEnd(-1);

    if(this.__getChannel(channel)) {
      this.initialTopic(channel, topic);
      return true;
    }
  },
  irc_RPL_TOPICWHOTIME: function(line, prefix, params) {
    return true;
  },
  irc_RPL_WHOISUSER: function(line, prefix, params) {
    var nick = params[1];
    this.whoisNick = nick;

    return this.whois(nick, "user", {ident: params[2], hostname: params[3], realname: params.indexFromEnd(-1)});
  },
  irc_RPL_WHOISSERVER: function(line, prefix, params) {
    var nick = params[1];
    var server = params[2];
    var serverdesc = params.indexFromEnd(-1);

    return this.whois(nick, "server", {server: params[2], serverdesc: params.indexFromEnd(-1)});
  },
  irc_RPL_WHOISOPERATOR: function(line, prefix, params) {
    var nick = params[1];
    var text = params.indexFromEnd(-1);

    return this.whois(nick, "oper", {opertext: params.indexFromEnd(-1)});
  },
  irc_RPL_WHOISIDLE: function(line, prefix, params) {
    var nick = params[1];

    return this.whois(nick, "idle", {idle: params[2], connected: params[3]});
  },
  irc_RPL_WHOISCHANNELS: function(line, prefix, params) {
    var nick = params[1];

    return this.whois(nick, "channels", {channels: params.indexFromEnd(-1)});
  },
  irc_RPL_WHOISACCOUNT: function(line, prefix, params) {
    var nick = params[1];

    return this.whois(nick, "account", {account: params[2]});
  },
  irc_RPL_WHOISACTUALLY: function(line, prefix, params) {
    var nick = params[1];

    return this.whois(nick, "actually", {hostmask: params[2], ip: params[3]});
  },
  irc_RPL_WHOISOPERNAME: function(line, prefix, params) {
    var nick = params[1];
    var opername = params[2];

    return this.whois(nick, "opername", {opername: params[2]});
  },
  irc_RPL_WHOISAVAILHELP: function(line, prefix, params) {
    var nick = params[1];
    return this.whois(nick, "availhelp", {});
  },
  irc_RPL_WHOISREGGED: function(line, prefix, params) {
    var nick = params[1];
    return this.whois(nick, "regged", {});
  },
  irc_RPL_WHOISMODES: function(line, prefix, params) {
    var nick = params[1];
    var text = params.indexFromEnd(-1);
    var modes = text.split(" ").slice(3).join(" ");

    return this.whois(nick, "modes", {modes: modes});
  },
  irc_RPL_WHOISREALHOST: function(line, prefix, params) {
    var nick = params[1];
    var text = params.indexFromEnd(-1);
    var hostname = text.split(" ")[3];
    var ip = text.split(" ")[4];
    return this.whois(nick, "realhost", {hostname: hostname, ip: ip});
  },
  irc_RPL_WHOISGENERICTEXT: function(line, prefix, params) {
    var nick = params[1];
    var text = params.indexFromEnd(-1);

    return this.whois(nick, "generictext", {text: text});
  },
  irc_RPL_WHOISWEBIRC: function(line, prefix, params) {
    var nick = params[1];
    var text = params.indexFromEnd(-1);

    return this.whois(nick, "generictext", {text: text});
  },
  irc_RPL_WHOISSECURE: function(line, prefix, params) {
    var nick = params[1];
    var text = params.indexFromEnd(-1);

    return this.whois(nick, "generictext", {text: text});
  },
  irc_RPL_ENDOFWHOIS: function(line, prefix, params) {
    var nick = params[1];
    var text = params.indexFromEnd(-1);
    this.whoisNick = null;

    return this.whois(nick, "end", {});
  },
  irc_genericError: function(line, prefix, params) {
    var target = params[1];
    var message = params.indexFromEnd(-1);

    this.genericError(target, message);
    return true;
  },
  irc_genericQueryError: function(line, prefix, params) {
    var target = params[1];
    var message = params.indexFromEnd(-1);

    this.genericQueryError(target, message);
    return true;
  },
  irc_genericNickInUse: function(line, prefix, params) {
    this.genericError(params[1], params.indexFromEnd(-1).replace("in use.", "in use"));

    if(this.signedOn)
      return true;

    /* this also handles ERR_UNAVAILRESOURCE, which can be sent for both nicks and
     * channels, but since this.signedOn is false, we can safely assume it means
     * a nick. */
    var newnick = params[1] + "_";
    if(newnick == this.lastnick)
      newnick = "iris" + Math.floor(Math.random() * 1024 * 1024);

    this.send("NICK " + newnick);
    this.lastnick = newnick;
    return true;
  },
  setupGenericErrors: function() {
    this.irc_ERR_CHANOPPRIVSNEEDED = this.irc_ERR_CANNOTSENDTOCHAN = this.irc_genericError;
    this.irc_ERR_NOSUCHNICK = this.irc_genericQueryError;
    this.irc_ERR_NICKNAMEINUSE = this.irc_ERR_UNAVAILRESOURCE = this.irc_genericNickInUse;
    return true;
  },
  irc_RPL_AWAY: function(line, prefix, params) {
    var nick = params[1];
    var text = params.indexFromEnd(-1);

    if(this.whoisNick && (this.whoisNick == nick))
      return this.whois(nick, "away", {"away": text});

    this.awayMessage(nick, text);
    return true;
  },
  irc_RPL_NOWAWAY: function(line, prefix, params) {
    this.awayStatus(true, params.indexFromEnd(-1));
    return true;
  },
  irc_RPL_UNAWAY: function(line, prefix, params) {
    this.awayStatus(false, params.indexFromEnd(-1));
    return true;
  },
  irc_WALLOPS: function(line, prefix, params) {
    var user = prefix;
    var text = params.indexFromEnd(-1);

    this.wallops(user, text);
    return true;
  },
  irc_RPL_CREATIONTIME: function(line, prefix, params) {
    var channel = params[1];
    var time = params[2];

    this.channelCreationTime(channel, time);
    return true;
  },
  irc_RPL_CHANNELMODEIS: function(line, prefix, params) {
    var channel = params[1];
    var modes = params.slice(2);

    this.channelModeIs(channel, modes);
    return true;
  }
});

qwebirc.irc.IRCMessage = new Class({
  initialize: function(raw) {
    this.raw = String(raw);
    this.command = '';
    this.prefix = '';
    this.params = [];
    this.params = [];
    var trailing = '';

    if (raw[0] == ':') {
        var index = raw.indexOf(' ');
        this.prefix = raw.substring(1, index);
        raw = raw.substring(index + 1);
    }
    if (raw.indexOf(' :') != -1) {
        var index = raw.indexOf(' :');
        trailing = raw.substring(index + 2);
        this.params = raw.substring(0, index).split(' ');
        this.params.push(trailing);
    } else {
        this.params = raw.split(' ');
    }

    this.command = this.params.splice(0, 1)[0].toUpperCase();
  },
  toString: function() {
    return this.raw;
  }
});
