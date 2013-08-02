from twisted.internet import reactor
from twisted.web.websockets import WebSocketsResource, WebSocketsProtocolWrapper
from twisted.internet import protocol
import qwebirc.ircclient as ircclient
import qwebirc.util.qjson as json
import qwebirc.config as config
import os, md5

Sessions = {}

def get_session_id():
  return md5.md5(os.urandom(16)).hexdigest()

def cleanupSession(id):
  try:
    del Sessions[id]
  except KeyError:
    pass

def connect_notice(line):
    return "c", "NOTICE", "", ("AUTH", "*** (qwebirc) %s" % line)

class WebSocketIRCSession(protocol.Protocol):
    def __init__(self, request):
        self.id = ""
        self.closed = False
        self.client = None
        self.transport = None
        self.request = request

    def makeConnection(self, transport):
        self.transport = transport
        request = self.request
        ip = request.getClientIP()

        nick = request.args.get("nick")
        if not nick:
            raise Exception, "Nickname not supplied."
        nick = ircclient.irc_decode(nick[0])

        password = request.args.get("password")
        if password is not None:
            password = ircclient.irc_decode(password[0])

        authUser = request.args.get("authUser")
        if authUser is not None:
            authUser = ircclient.irc_decode(authUser[0])
        authSecret = request.args.get("authSecret")
        if authSecret is not None:
            authSecret = ircclient.irc_decode(authSecret[0])

        for i in xrange(10):
            self.id = get_session_id()
            if not Sessions.get(self.id):
                break
            else:
                raise IDGenerationException()
        
        Sessions[self.id] = self

        ident, realname = config.irc["ident_string"], config.irc["realname"]
        if config.irc["ident"] == "hex":
            ident = socket.inet_aton(ip).encode("hex")
        elif config.irc["ident"] == "nick":
            ident = nick
        
        def proceed(hostname):
            kwargs = dict(nick=nick, ident=ident, ip=ip, realname=realname, perform=None, hostname=hostname)
            if password is not None:
                kwargs["password"] = password
            if ((authUser is not None) and (authSecret is not None)):
                kwargs["authUser"] = authUser
                kwargs["authSecret"] = authSecret
        
            self.client = ircclient.createIRC(self, **kwargs)
        
        if config.irc["webirc_mode"] == "":
            proceed(None)
            return
            
        notice = lambda x: session.event(connect_notice(x))
        notice("Looking up your hostname...")
        def callback(hostname):
            notice("Found your hostname.")
            proceed(hostname)
        def errback(failure):
            notice("Couldn't look up your hostname!")
            proceed(ip)
        qdns.lookupAndVerifyPTR(ip, timeout=[config.tuneback["dns_timeout"]]).addCallbacks(callback, errback)

    def connectionLost(self, reason):
        self.disconnect()
    
    def dataReceived(self, data):
        print "dataReceived"
        self.transport.write(data)

    def write(self, data):
        self.transport.write(data)

    def event(self, data):
        self.write(json.dumps(data))

    def disconnect(self):
        self.closed = True
        self.transport.loseConnection()

        reactor.callLater(5, cleanupSession, self.id)


def return_protocol(protocolNames, request):
    return WebSocketIRCSession(request), None

class WebSocketEngine(WebSocketsResource):
    def __init__(self, path):
        WebSocketsResource.__init__(self, return_protocol)
    
    def closeById(self, k):
        k.disconnect()
    
    @property
    def adminEngine(self):
        return {
            "Sessions": [(str(v.client), AdminEngineAction("close", self.closeById, k)) for k, v in Sessions.iteritems() if not v.closed],
        }
