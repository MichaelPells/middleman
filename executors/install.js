const fs = require("fs");

module.exports =  function install (next_arg, options) {
    var profiles_list = Object.keys(profiles);

    var profile = next_arg();

    if (!profiles_list.includes(profile)) {
        var REMOTE_URL = options["--REMOTE_URL"] || options["-u"];
        var HOST_ADDRESS = options["--HOST_ADDRESS"] || options["-h"] || "localhost";
        var PORT_NUMBER = Number(options["--PORT_NUMBER"] || options["-p"]);
        var MAX_LOAD_RESOURCES_TRIALS = Number(options["--MAX_LOAD_RESOURCES_TRIALS"] || options["-m"] || 1);

        profiles[profile] = {
            "remote_URL": REMOTE_URL
        }

        var settings =
`SET ["PROFILE_NAME"] = "${profile}";
SET ["REMOTE_URL"] = "${REMOTE_URL}";
SET ["HOST_ADDRESS"] = "${HOST_ADDRESS}"
SET ["PORT_NUMBER"] = ${PORT_NUMBER};
SET ["MAX_LOAD_RESOURCES_TRIALS"] = ${MAX_LOAD_RESOURCES_TRIALS};

SET ["ON_OUTGOING"] = function (request, response, Default) {

}

SET ["ON_INCOMING"] = function (request, response, Default) {

}
`
        try {
            fs.mkdirSync(`profiles/${profile}`);
            fs.writeFileSync(`profiles/${profile}/settings.js`, settings);
            fs.mkdirSync(`profiles/${profile}/model`);
            fs.mkdirSync(`profiles/${profile}/public`);
            fs.writeFileSync("profiles.json", JSON.stringify(profiles, undefined, 4));
        } catch (err) {
            fs.rmdirSync(`profiles/${profile}`);
            console.log(err);
        }

        console.log(
`${profile} was installed with the following settings:
    PROFILE_NAME: ${profile}
    REMOTE_URL: ${REMOTE_URL}
    HOST_ADDRESS: ${HOST_ADDRESS}
    PORT_NUMBER: ${PORT_NUMBER}
    MAX_LOAD_RESOURCES_TRIALS: ${MAX_LOAD_RESOURCES_TRIALS}

Visit 'profiles/${profile}/settings.js' to customize profile.`)
    } else {
        console.log(`${profile} is already installed. Install new profile using a different name.`)
    }
}