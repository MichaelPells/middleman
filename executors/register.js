const fs = require("fs");

module.exports =  function register (next_arg, options) {
    var profiles_list = Object.keys(profiles);

    var profile = next_arg();

    if (!profiles_list.includes(profile)) {
        var REMOTE_URL = options["--REMOTE_URL"] || options["-u"];
        var HOST_ADDRESS = options["--HOST_ADDRESS"] || options["-h"] || "localhost";
        var PORT_NUMBER = Number(options["--PORT_NUMBER"] || options["-p"]);
        var MAX_LOAD_RESOURCES_TRIALS = Number(options["--MAX_LOAD_RESOURCES_TRIALS"] || options["-m"] || 1);

        profiles[profile] = {
            "REMOTE_URL": REMOTE_URL
        };

        fs.writeFileSync("profiles.json", JSON.stringify(profiles, undefined, 4));

        if (options["--internal"]) {

        } else {
            console.log(`Register Success: ${profile} was registered successfully.`);

            execution_path_free = true;
        }
    } else {
        if (options["--internal"]) {
            throw `${profile} could not be registered - ${profile} is already installed.`;
        } else {
            console.log(`Register failed: ${profile} is already installed. Register new profile using a different name.`)

            execution_path_free = true;
        }
    }
}