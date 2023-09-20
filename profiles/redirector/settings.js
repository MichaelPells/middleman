SET ["PROFILE_NAME"] = "redirector";
SET ["URL"] = "https://contenthub.netacad.com";
SET ["HOST_ADDRESS"] = "localhost"
SET ["PORT_NUMBER"] = 5000;
SET ["MAX_LOAD_RESOURCES_TRIALS"] = 1;

SET ["ON_OUTGOING"] = function (request, response, Default) {
    if (request.url == "/itn") {
        response.statusCode = "302";
        response.redirect("/index2.json");
        Default.prevent = [
            "all"
        ];
    }

    if (request.url == "/index2.json") {
        response.statusCode = "302";
        response.redirect("/index1.json");
        Default.prevent = [
            "all"
        ];
    }

    if (request.url == "/index1.json") {
        response.statusCode = "302";
        response.redirect("/index.json");
        Default.prevent = [
            "all"
        ];
    }

    if (request.url == "/index.json") {
        response.cachePath = "/index.json";
    }
}

SET ["ON_INCOMING"] = function (request, response, Default) {
    Default.prevent = [
        // "setHeader:Content-Type"
    ];
}