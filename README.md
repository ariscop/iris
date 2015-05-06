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
Run make, copy config.js.example to www/config.js, edit, you're done.
Place the www folder somewhere an http server can see it

###TODO
* Fix all the things
