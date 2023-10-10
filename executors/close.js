module.exports =  function close (next_arg, options, closer, profiles) {
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
            closer(profile);
        }
    }
}