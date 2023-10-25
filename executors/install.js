const build = require("./build");
const register = require("./register");
const prepare = require("./prepare");

module.exports =  async function install (next_arg, options) {
    var profiles_list = Object.keys(profiles);

    var profile = next_arg();

    if (!profiles_list.includes(profile)) {
        try {
            build(() => profile, {...options, "--internal": true});
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