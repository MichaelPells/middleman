SET ["PROFILE_NAME"] = "w3schools";
SET ["REMOTE_URL"] = "https://w3schools.com";
SET ["HOST_ADDRESS"] = "localhost"
SET ["PORT_NUMBER"] = 5002;
SET ["MAX_LOAD_RESOURCES_TRIALS"] = 1;

SET ["ON_OUTGOING"] = function (request, response, Default) {
    Default.prevent = [
    ];
}

SET ["ON_INCOMING"] = function (request, response, Default) {
    Default.prevent = [
    ];
}