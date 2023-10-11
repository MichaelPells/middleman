module.exports =  async function run (next_arg, options, runner) {
    var profiles_list = Object.keys(profiles);

    var given = [];
    var profile = next_arg();
    while (profile !== null) {
        if (profile == "all") {
            given.push(...profiles_list)
        } else {
            given.push(profile);
        }

        profile = next_arg();
    }

    for (profile of given) {
        if (profiles_list.includes(profile)) {
            if (!running_profiles.includes(profile)) {
                try {
                    var report = await runner(profile);
                    running_profiles.push(profile);

                    console.log(report);
                } catch (err) {
                    console.log(err);
                }
            } else {
                console.log(`Run failed: ${profile} already running.`);
            }
        } else {
            console.log(`Run failed: ${profile} is not installed.`); 
        }
    }

    execution_path_free = true;
}