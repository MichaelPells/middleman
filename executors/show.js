module.exports =  function show (next_arg, options, closer) {
    var profiles_list = Object.keys(profiles);

    var list = next_arg();

    var lists = {
        all: profiles_list,
        running: running_profiles
    }

    if (lists[list] != undefined) {
        for (profile of lists[list]) {
            console.log(profile);
        }
    } else {
        console.log(`Show error: Unknown list specified - '${list}'.`);
    }

    execution_path_free = true;
}