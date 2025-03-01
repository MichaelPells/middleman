const express = require("express");
const mimeType = require("mime-types");
const cors = require("cors");
const cookieParser = require("cookie-parser");

SET ["PROFILE_NAME"] = "itn-dl";
SET ["REMOTE_URL"] = "http://localhost:5000";
SET ["HOST_ADDRESS"] = "localhost"
SET ["PORT_NUMBER"] = 5001;
SET ["MAX_LOAD_RESOURCES_TRIALS"] = 1;

SET ["MIDDLEWARES"] = [
    cors(),
    cookieParser(),
    express.json({extended: false, limit: '1024mb'}),
    express.text({extended: false, limit: '1024mb'}),
    express.urlencoded({extended: false, limit: '1024mb'})
];

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