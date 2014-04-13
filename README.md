#WIP Fork of iris

Ultimate goal is a standalone client that can be adapted to suite any
network with relative ease.

###Websocket support
The current websocket code will conenct to the provided url using
protocol name "irc" and expects one irc message per websocket frame with
no cr-lf

###Tcp support
Via a flash plugin. requires a flash policy server running on the irc,
server, otherwise a normal client.

##Installation
Run make, it will create a compressed .js file and source map.
Copy index.html.tmpl and edit.

###TODO
* "irc-raw" websocket protocol that takes binary frames, allowing dumb
  tcp<->websocket proxy.
* Proper build system (important)
