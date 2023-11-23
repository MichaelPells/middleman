const color = {};

import("chalk").then((Chalk) => {
	const chalk = new Chalk.Chalk();
	color["outgoing"] = chalk.green;
	color["incoming"] = chalk.yellow;
}).catch((_) => {
	color["outgoing"] = (text) => {return text};
	color["incoming"] = (text) => {return text};
});

const profile = process.argv[process.argv.length-1];
const profile_info = require("../profiles.json")[profile];

process.title = `ContentPro: ${profile} (${profile_info.REMOTE_URL})`;

const { io } = require("socket.io-client");

const development = true;

var recent_error = [];
var error_new_state = false;
var last_log_length = 0;
var last_error_code = null;

const clearPrevError = () => {
	var dy = Math.ceil(last_log_length / process.stdout.columns);
	process.stdout.moveCursor(0, -dy);
	process.stdout.clearScreenDown();
}

function error_handler() {
    if (error_new_state) {
		error_new_state = false;

		var error = recent_error;
		
		if (error[1] == "REQUESTFAIL") {
			if (last_log_length) {clearPrevError()}
			var log = "Problem Getting New Resources: Ensure you have a working Internet connection.";
			console.error(log);
			last_log_length = log.length;
			last_error_code = error[1];
		}
		else if (error[1] == "WRITEFAIL") {
			if (last_log_length) {clearPrevError()}
			var log = "Problem Providing New Resources: ContentPro may be corrupt, or you have no 'write' permission in this installation folder. Try changing installation folder or running ContentPro as Admin. If problem persists, you may reinstall ContentPro.";
			console.error(log);
			last_log_length = log.length;
			last_error_code = error[1];
		}
		else if (error[1] == "REQUESTSUCCESS") {
			if (last_error_code == "REQUESTFAIL") {
				clearPrevError();
				var log = "";
				last_log_length = log.length;
				last_error_code = error[1];
			}
		}
		else if (error[1] == "WRITESUCCESS") {
			if (last_error_code == "WRITEFAIL") {
				clearPrevError();
				var log = "";
				last_log_length = log.length;
				last_error_code = error[1];
			}
		}
    }
}
setInterval(error_handler, 0)

const socket = io.connect("http://localhost:3000");

socket.on("init", (socket_id) => socket.emit("init", socket_id, profile));

socket.on("exit", () => process.exit(0));

socket.on("disconnect", (_) => {
	setTimeout(() => {
		if (!socket.connected) {
			console.log("An error occured: Server crashed. Please close this window and restart application.")
		}
	},
	10000);
});

socket.on("status", (message) => {
    if (development) {
		if (message.info) {console.error(message.info)}
	}
	else {
		recent_error = [message.info, message.code];
		error_new_state = true;
	}
});

socket.on("msg", (message) => {
    console.log(message);
});

socket.on("log", (log) => {
	try {
    	console.error(color[log.type](`${align(log.time, 23)} ${align(log.method, 4)} ${align(log.path, 20)} ${align((log.protocol && log.httpVersion) && log.protocol.toUpperCase() + "/" + log.httpVersion, 9)} ${align(log.statusCode)} ${align(log.statusMessage, 12)} ${value(log.responseTime, 3, 4, "s")} ${value(log.reqSize, 5, 0, "B")} ${value(log.resSize, 5, 0, "B")} ${align(log.contentType && log.contentType.split(";")[0], 20)} ${align(log.userAgent, 25)}`));
	} catch (e) {
		console.log(e)
	}
});

function align (text, length) {
	if (text != undefined) {
		if (length) {
			text = text.toString().padEnd(length);
			return text.length == length ? text : `${text.slice(0, length - 3)}...`;
		} else {
			return text.toString();
		}
	} else {
		length = length ? length : 1;
		return "-".repeat(length < 3 ? length : 3).padEnd(length);
	}
}

function value (number, length, decimals, unit) {
	try {
		if (number != undefined) {
			var num = number.toString().split(".");
			var whole = num[0];
			var dec = num[1] ? num[1] : "";
			var overflow;

			if (length) {
				whole = whole.padStart(length, "0");

				if (whole.length > length) {
					whole = "9".repeat(length);
					overflow = true;
				}
			}

			if (decimals != undefined) {
				dec = !overflow ? dec.padEnd(decimals, "0") : "9".repeat(decimals);
				dec = dec.length == decimals ? dec : parseFloat(Number(dec).toPrecision(decimals)).toString().slice(0, decimals);
			}

			return `${whole}${dec && `.${dec}`}${unit ? unit : ""}${overflow ? "+" : " "}`;
		} else {
			length = length ? length : 1;
			decimals = decimals ? decimals + 1 : 0;
			unit = unit ? unit.length : 0;
			length = length + decimals + unit + 1;
			return "-".repeat(length < 3 ? length : 3).padEnd(length);
		}
	} catch (e) {
		console.log(e)
	}
}
