module.exports =  async function run (next_arg, options, runner) {
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
            try {
                var report = await runner(profile);
                console.log(report);
            } catch (err) {
                console.log(err);
            }
        }
    }

    execution_path_free = true;
}