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
    console.log(log);
});
