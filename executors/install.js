const fs = require("fs");

const build = require("./build");
const register = require("./register");
const prepare = require("./prepare");

module.exports =  async function install (next_arg, options) {
    var profiles_list = Object.keys(profiles);

    var profile = next_arg();

    if (!profiles_list.includes(profile)) {
        var REMOTE_URL = options["--REMOTE_URL"] || options["-u"];
        var HOST_ADDRESS = options["--HOST_ADDRESS"] || options["-h"] || "localhost";
        var PORT_NUMBER = Number(options["--PORT_NUMBER"] || options["-p"]);
        var MAX_LOAD_RESOURCES_TRIALS = Number(options["--MAX_LOAD_RESOURCES_TRIALS"] || options["-m"] || 1);

        try {
            if (!fs.existsSync(`profiles/${profile}/package.json`)) {
                build(() => profile, {...options, "--internal": true});
            }

            register(() => profile, {...options, "--internal": true});
            await prepare(() => profile, {...options, "--internal": true});

            console.log(`Install Success: ${profile} was installed successfully.`);

            execution_path_free = true;
        } catch (error) {
            console.log(`Install failed: ${error}`);

            execution_path_free = true;
        }
    } else {
        console.log(`${profile} is already installed. Install new profile using a different name.`)

        execution_path_free = true;
    }
}