const fs = require("fs");
const child_process = require('child_process');
const util = require("util");

module.exports = function load (next_arg, options) {
    var profiles_list = Object.keys(profiles);

    var profile = next_arg();

    if (profiles_list.includes(profile)) {
        fs.readFile(`profiles/${profile}/package.json`, async (error, data) => {
            if (!error) {
                var package = JSON.parse(data);
                var dependencies = package.dependencies || {};
                var new_dependencies = [];

                for (let dependency of Object.keys(dependencies)) {
                    try {
                        await util.promisify(child_process.execFile)(`.\\executors\\load\\checker.${type}`, [dependency, dependencies[dependency]]);
                    } catch (e) {
                        new_dependencies.push(dependency);
                    }
                }

                var tried = 0;
                var success = 0;
                var failed = 0;

                function install (dependency) {
                    process.stdout.write(`Installing ${dependency}@${dependencies[dependency]}: `);
                    tried++;

                    child_process.execFile(`.\\executors\\load\\installer.${type}`, [dependency, dependencies[dependency]], (error) => {
                        if (!error) {
                            process.stdout.write(`success\n`);
                            success++;
                        } else {
                            process.stdout.write(`failed\n`);
                            failed++;
                        }

                        if (new_dependencies.length > tried) {
                            install(new_dependencies[tried]);
                        } else {
                            console.log(`Load Success: Installed ${success} dependencies. ${failed} installs failed.`);
                            
                            execution_path_free = true;
                        }
                    });
                }

                if (new_dependencies.length) {
                    install(new_dependencies[0]);
                } else {
                    console.log(`Load Success: No new dependencies found.`);

                    execution_path_free = true;
                }
            } else {
                console.log(`Load failed: ${profile} is not installed with a 'package.json' file.`);

                execution_path_free = true;
            }
        });
    } else {
        console.log(`Load failed: ${profile} is not installed.`);

        execution_path_free = true;
    }
}