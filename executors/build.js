const fs = require("fs");

module.exports =  function build (next_arg, options) {
    var profiles_list = Object.keys(profiles);

    var profile = next_arg();

    if (!profiles_list.includes(profile)) {
        var REMOTE_URL = options["--REMOTE_URL"] || options["-u"];
        var HOST_ADDRESS = options["--HOST_ADDRESS"] || options["-h"] || "localhost";
        var PORT_NUMBER = Number(options["--PORT_NUMBER"] || options["-p"]);
        var MAX_LOAD_RESOURCES_TRIALS = Number(options["--MAX_LOAD_RESOURCES_TRIALS"] || options["-m"] || 1);

        var package = {
            "name": profile,
            "version": "1.0.0",
            "description": "",
            "main": "",
            "scripts": {
              "test": "echo \"test\""
            },
            "author": "",
            "license": "ISC",
            "dependencies": Object.fromEntries(Object.keys(options).filter((option) => option.startsWith("--add-")).map((option) => [option.replace("--add-", ""), options[option] === true ? "latest" : options[option]]))
        };

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
            fs.mkdirSync(`profiles/${profile}`, {recursive: true});
            fs.writeFileSync(`profiles/${profile}/package.json`, JSON.stringify(package, undefined, 4));
            fs.writeFileSync(`profiles/${profile}/settings.js`, settings);
            fs.mkdirSync(`profiles/${profile}/model`, {recursive: true});
            fs.mkdirSync(`profiles/${profile}/public`, {recursive: true});

            if (options["--internal"]) {

            } else {
                console.log(
`${profile} was built with the following settings:
    PROFILE_NAME: ${profile}
    REMOTE_URL: ${REMOTE_URL}
    HOST_ADDRESS: ${HOST_ADDRESS}
    PORT_NUMBER: ${PORT_NUMBER}
    MAX_LOAD_RESOURCES_TRIALS: ${MAX_LOAD_RESOURCES_TRIALS}

Visit 'profiles/${profile}/settings.js' to customize profile.`);

                execution_path_free = true;
            }
        } catch (err) {
            fs.rmSync(`profiles/${profile}`, {recursive: true, force: true});

            if (options["--internal"]) {
                throw err;
            } else {
                console.log(err);

                execution_path_free = true;
            }
        }
    } else {
        if (options["--internal"]) {
            throw `${profile} could not be built - ${profile} is already installed.`;
        } else {
            console.log(`Build failed: ${profile} is already installed. Build new profile using a different name.`)

            execution_path_free = true;
        }
    }
}