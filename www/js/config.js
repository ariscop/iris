/* Contains configuration loading and parsing functions. */

/* Load configuration.
 * Accepts a default configuration object, which is modified with settings
 * from cookies and the query string, then returned. */
qwebirc.config.load = function(config) {

	/* Stow away some unmodified values from default configuration.
	 * This allows them to be accessed as 'default' values for
	 * query strings later. */
	config.frontend.initial_nick_default = config.frontend.initial_nick;
	config.frontend.initial_chans_default = config.frontend.initial_chans;
	config.frontend.prompt_default = config.frontend.prompt;
	config.ui.fg_color_default = config.ui.fg_color;
	config.ui.fg_sec_color_default = config.ui.fg_sec_color;
	config.ui.bg_color_default = config.ui.bg_color;

	/* Load user settings from cookie. */
	qwebirc.config.loadCookieSettings(config);

	/* Load query string parameters. */
	var uri = String(document.location);
	var args = qwebirc.util.parseURI(uri);

	/* Map backwards compatiblity query string aliases to the
	 * parameters they represent, unless they're already set. */
	if($defined(args["nick"]) && !$defined(args["initial_nick"]))
		args["initial_nick"] = args["nick"];
	if($defined(args["channels"]) && !$defined(args["initial_chans"]))
		args["initial_chans"] = args["channels"];

	/* If we had any arguments, default chan_list_on_start off. */
	if (uri.splitMax("/", 4)[3].indexOf("?") != -1)
		args["chan_list_on_start"] = "0";

	/* Load nick from query string. */
	if($defined(args["initial_nick"])) {
		var initial_nick = args["initial_nick"];
		config.frontend.initial_nick = initial_nick;
		config.frontend.chan_prompt = false;
	}

	if ($defined(args["initial_chans"])) {
		var initial_chans = args["initial_chans"];
		config.frontend.initial_chans = initial_chans;
	}

	/* Load prompt option from query string. */
	if ($defined(args["prompt"])) {
		if (args["prompt"] == 1)
			config.frontend.prompt = true;
		else
			config.frontend.prompt = false;
	}

	/* Load chan_prompt option from query string. */
	if ($defined(args["chan_prompt"])) {
		if (args["chan_prompt"] == 1)
			config.frontend.chan_prompt = true;
		else
			config.frontend.chan_prompt = false;
	}

	/* Load chan_list_on_start option from query string. */
	if ($defined(args["chan_list_on_start"])) {
		if (args["chan_list_on_start"] == 1)
			config.atheme.chan_list_on_start = true;
		else
			config.atheme.chan_list_on_start = false;
	}

	/* Load colours from query string. */
	if ($defined(args["fg_color"])) {
		config.ui.fg_color = args["fg_color"];
		config.ui.fg_sec_color = args["fg_color"];
	}
	if ($defined(args["fg_sec_color"]))
		config.ui.fg_sec_color = args["fg_sec_color"];
	if ($defined(args["bg_color"]))
		config.ui.bg_color = args["bg_color"];

	/* Subtitute '.' characters in the nick with random digits. */
	if (config.frontend.initial_nick.indexOf(".") != -1) {
		var nick = config.frontend.initial_nick;
		config.frontend.initial_nick = qwebirc.config.randSub(nick);
		config.frontend.initial_nick_rand = true;
	}
	else
		config.frontend.initial_nick_rand = false;

	/* Insert any needed # symbols into channel names. */
	if(config.frontend.initial_chans) {
		var cdata = config.frontend.initial_chans.split(" ");
		var chans = cdata[0].split(" ")[0].split(",");

		for(var i=0;i<chans.length;i++) {
			if(chans[i].charAt(0) != '#')
				chans[i] = "#" + chans[i]
		}

		cdata[0] = chans.join(",");
		config.frontend.initial_chans = cdata.join(" ");
	}

	return config;
};

/* Loads settings from cookies. */
qwebirc.config.loadCookieSettings = function(config) {
	var cookie = new Hash.Cookie("iris-settings", {duration: 3650, autoSave: false});
	for (var i = 0; i < qwebirc.options.Options.length; i++) {
		var category = qwebirc.options.Options[i].category;
		var option = qwebirc.options.Options[i].option;
		var cookieName = category + "." + option;
		if ($defined(cookie.get(cookieName)))
			config[category][option] = cookie.get(cookieName);
	}
};

/* Save setings to cookies. */
qwebirc.config.saveUserSettings = function(config) {
	var cookie = new Hash.Cookie("iris-settings", {duration: 3650, autoSave: false});
	cookie.erase();
	cookie = new Hash.Cookie("iris-settings", {duration: 3650, autoSave: false});
	for (var i = 0; i < qwebirc.options.Options.length; i++) {
		var category = qwebirc.options.Options[i].category;
		var option = qwebirc.options.Options[i].option;
		var cookieName = category + "." + option;
		cookie.set(cookieName, config[category][option]);
	}
	cookie.save();
};

/* Substitute dots in configured nicks with random numbers. */
qwebirc.config.randSub = function(nick) {
	var getDigit = function() { return Math.floor(Math.random() * 10); }

	return nick.split("").map(function(v) {
		if(v == ".") {
			return getDigit();
		} else {
			return v;
		}
	}).join("");
};
