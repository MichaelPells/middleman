module.exports =  function close (next_arg, options, closer) {
    var profiles_list = Object.keys(profiles);

    var given = [];
    var profile = next_arg();
    while (profile !== null) {
        if (profile == "all") {
            given.push(...profiles_list)
        }
        given.push(profile);
        profile = next_arg();
    }

    for (profile of given) {
        if (profiles_list.includes(profile)) {
            closer(profile);

            console.log(`Closed profile: ${profile}`)
        }
    }

    execution_path_free = true;
}