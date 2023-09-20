SET ["PROFILE_NAME"] = "itn-dl";
SET ["URL"] = "https://contenthub.netacad.com";
SET ["HOST_ADDRESS"] = "localhost"
SET ["PORT_NUMBER"] = 5001;
SET ["MAX_LOAD_RESOURCES_TRIALS"] = 1;

SET ["ON_OUTGOING"] = function (request, response, Default) {
// COURSE PATH
    if (request.URL.params[0] == SET.PROFILE_NAME) {
        response.cachePath = "/_course/";
    }

    Default.prevent = [
    ];
}

SET ["ON_INCOMING"] = function (request, response, Default) {

// validateLTI
    if (request.URL.params[0] == "validateLTI") {
        response.data = JSON.stringify({
            "valid": true,
            "course": SET.PROFILE_NAME
        });
    }

// SET Content-Type
    const mimeType = require("./node_modules/mime-types");

    var contentType = mimeType.lookup(response.url) || (response.url.endsWith("/index") && "text/html") || null;
    if (!contentType) {
        try { // For JSON files
            JSON.parse(response.data);
            contentType = "application/json";
        }
        catch (e) {contentType = "application/octet-stream";}
    }

    response.setHeader("Content-Type", contentType);

// COURSE PATH
    if (request.URL.params[0] == SET.PROFILE_NAME) {
        response.setHeader("Content-Type", "text/html");
    }

    Default.prevent = [
        // "setHeader:Content-Type"
    ];
}