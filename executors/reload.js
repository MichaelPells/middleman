module.exports =  function reload (next_arg, options, reloader) {
    var profiles_list = Object.keys(profiles);

    var given = [];
    var profile = next_arg();
    while (profile !== null) {
        if (profile == "all") {
            given.push(...running_profiles)
        } else {
            given.push(profile);
        }

        profile = next_arg();
    }

    for (profile of given) {
        if (profiles_list.includes(profile)) {
            if (running_profiles.includes(profile)) {
                reloader(profile);

                console.log(`Reloaded profile: ${profile}`)
            } else {
                console.log(`Reload error: ${profile} not running.`)
            }
        } else {
            console.log(`Reload error: ${profile} is not installed.`); 
        }
    }

    execution_path_free = true;
}