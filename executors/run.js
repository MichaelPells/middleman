module.exports =  function run (next_arg, options, runner, profiles) {
    var given = [];
    var profile = next_arg();
    while (profile !== null) {
        if (profile == "all") {
            given.push(...profiles)
        }
        given.push(profile);
        profile = next_arg();
    }

    for (profile of given) {
        if (profiles.includes(profile)) {
            runner(profile);
        }
    }
}