module.exports =  function run (arg, next_arg, options, runner, profiles) {
    function run_profile (profile) {
        if (profiles.includes(profile)) {
            runner(profile);
        }
    }

    if (arg == "run") {
        var given = [];
        var profile = next_arg();
        while (profile !== null) {
            given.push(profile);
            profile = next_arg();
        }

        for (profile of given) {
            run_profile(profile);
        }
    } else if (arg == "all") {
        for (profile of profiles) {
            run_profile(profile);
        }
    } else {
        var given = [arg];
        var profile = next_arg();
        while (profile !== null) {
            given.push(profile);
            profile = next_arg();
        }

        for (profile of given) {
            run_profile(profile);
        }
    }
}