swf/flashsocket.swf: swf/flashsocket.as
	as3compile -v -o swf/flashsocket.swf swf/flashsocket.as

clean:
	rm swf/flashsocket.swf
