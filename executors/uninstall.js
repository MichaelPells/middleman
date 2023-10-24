const fs = require("fs");

module.exports =  function uninstall (next_arg, options) {
    var profiles_list = Object.keys(profiles);

    var profile = next_arg();

    function uninstaller () {
        try {
            fs.rmSync(`profiles/${profile}`, {recursive: true});
            delete profiles[profile];
            fs.writeFileSync("profiles.json", JSON.stringify(profiles, undefined, 4));
            console.log(`Uninstall success: ${profile} was uninstalled successfully.`);
        } catch (err) {
            console.log(err);
        }
    }

    if (profiles_list.includes(profile)) {
        if (options["-y"]) {
            uninstaller();

            execution_path_free = true;
        } else {
            process.stdout.write(`Do you want to uninstall this profile - ${profile}? (y/n): `);
            process.stdin.once("data", (input) => {
                if (input.toString().trim().toLowerCase() == "y") {
                    uninstaller();

                    execution_path_free = true;
                } else if (input.toString().trim().toLowerCase() == "n") {
                    console.log(`Uninstall aborted: ${profile} was not uninstalled.`);

                    execution_path_free = true;
                } else {
                    console.log(`Uninstall aborted: ${profile} was not uninstalled. Wrong confirmation input supplied (y/n).`);
                
                    execution_path_free = true;
                }
            });
        }
    } else {
        console.log(`Uninstall failed: ${profile} is not installed.`);

        execution_path_free = true;
    }
}