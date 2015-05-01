_SOURCES=$(shell cat files.list)
SOURCES=$(_SOURCES:%=www/%)

GRUNT_DEP=node_modules Gruntfile.js

all: iris

iris: www/swf/flashsocket.swf www/qui.js www/index.html

node_modules: package.json
	npm install && touch node_modules/

www/qui.js: $(GRUNT_DEP) $(SOURCES) files.list
	grunt qui.js

www/index.html: $(GRUNT_DEP) tmpl/index.mustache files.list
	grunt html

lint: $(GRUNT_DEP)
	grunt lint

www/swf/flashsocket.swf: www/swf/flashsocket.as
	as3compile $^ -o $@


clean:
	rm -f www/swf/flashsocket.swf
	rm -f www/qui.js
	rm -f www/qui.js.map
	rm -f www/debug.html
	rm -f www/index.html
