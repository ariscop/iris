/* This could do with a rewrite from scratch. */

qwebirc.irc.IRCConnection = new Class({
  Implements: [Events, Options],
  options: {
    timeout: 45000,
    maxRetries: 5,
  },
  initialize: function(session, options) {
    
  },
  connect: function() {
    
  },
  disconnect: function() {
    
  }
  send: function(data, synchronous) {
    
  },
  recv: function(data, synchronous) {
    
  },
  __parse() {
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
});
