const fs = require("fs");
const child_process = require('child_process');
const util = require("util");

module.exports = function prepare (next_arg, options) {
    return new Promise((resolve, reject) => {
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
                            await util.promisify(child_process.execFile)(`.\\executors\\prepare\\checker.${type}`, [dependency, dependencies[dependency]]);
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

                        child_process.execFile(`.\\executors\\prepare\\installer.${type}`, [dependency, dependencies[dependency]], (error) => {
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
                                if (options["--internal"]) {
                                    if (!failed) {
                                        resolve();
                                    } else {
                                        reject(`${profile} could not be fully prepared for use. Installed ${success} dependencies. ${failed} installs failed.`);
                                    }
                                } else {
                                    if (!failed) {
                                        console.log(`Prepare Success: Installed ${success} dependencies. ${failed} installs failed.`);
                                    } else {
                                        console.log(`Prepare Failed: Installed ${success} dependencies. ${failed} installs failed.`);
                                    }
                                    
                                    execution_path_free = true;
                                }
                            }
                        });
                    }

                    if (new_dependencies.length) {
                        install(new_dependencies[0]);
                    } else {
                        if (options["--internal"]) {
                            resolve();
                        } else {
                            console.log(`Prepare Success: No new dependencies found.`);

                            execution_path_free = true;
                        }
                    }
                } else {
                    if (options["--internal"]) {
                        reject(`${profile} could not be prepared for use - ${profile} is not installed with a 'package.json' file.`);
                    } else {
                        console.log(`Prepare failed: ${profile} is not installed with a 'package.json' file.`);

                        execution_path_free = true;
                    }
                }
            });
        } else {
            if (options["--internal"]) {
                reject(`${profile} could not be prepared for use - ${profile} is not installed.`);
            } else {
                console.log(`Prepare failed: ${profile} is not installed.`);

                execution_path_free = true;
            }
        }
    });
}