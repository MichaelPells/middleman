const development = true;

process.title = "ContentPro";

console.log('Cisco NetAcad Content Provider (ContentPro) v1.0\n');

const express = require("express");
const fs = require("fs");
const requests = require("follow-redirects");
const open = require("open");
const PATH = require("path");
const mimeType = require("mime-types");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const child_process = require('child_process');

const show = require("./executors/show");
const install = require("./executors/install");
const uninstall = require("./executors/uninstall");
const build = require("./executors/build");
const register = require("./executors/register");
const prepare = require("./executors/prepare");
const run = require("./executors/run");
const close = require("./executors/close");
const reload = require("./executors/reload");

global.profiles = require("./profiles.json");
global.running_profiles = [];
global.execution_path_free = true;
const os = require("os")
global.type = (os.type() == "Windows_NT") ? "cmd" : "sh";

const SETTINGS = {};
const servers = {};
const shells = {};
const sockets = {};
const socketed = {};
const reloaders = {};

function sortIfObject (object) {
    if (object && typeof(object) == "object") {
        object = Object.fromEntries(Object.keys(object)
            .sort()
            .map((key) => {
                var value = sortIfObject(object[key]);
                return [key, value];
            })
        );
    }
    return object;
}

class DEFAULT {
    constructor () {
        this.prevent = [];
    }
}

const server = http.createServer().listen(3000);
const interface = new Server(server);

interface.on("connection", (socket) => {
    interface.to(socket.id).emit("init", socket.id)

    socket.on("init", (socket_id, profile) => {
        if (socket_id == socket.id) {
            socketed[profile] && socketed[profile](socket);
        }
    });
});

function runner (profile, output = "shell", logTypes = "both") {
    return new Promise((resolve, reject) => {
        try {

            var location, settings, remote_server_address, host, port, max_load_resources_trials;

            logTypes = (logTypes == "both" || logTypes === true) ? ["incoming", "outgoing"] : [logTypes];

            reloaders[profile] = function () {
                // LOAD PROFILE SETTINGS
                location = `profiles/${profile}`;
                SETTINGS[profile] = {};
                global.SET = SETTINGS[profile];
                require(`./${location}/settings.js`);
                delete require.cache[require.resolve(`./${location}/settings.js`)];
                settings = {...SETTINGS[profile]};

                // PROFILE SETTINGS
                remote_server_address = settings.REMOTE_URL;
                max_load_resources_trials = settings.MAX_LOAD_RESOURCES_TRIALS || 1;
            }
            reloaders[profile]();

            host = settings.HOST_ADDRESS || "localhost";
            port = settings.PORT_NUMBER;

            const app = express();

            for (middleware of settings.MIDDLEWARES || []) {
                app.use(middleware);
            }

            function status (info, code = null) {
                try {sockets[profile].emit("status", {info, code})} catch (e) {}
            }

            function msg (message) {
                try {sockets[profile].emit("msg", message)} catch (e) {}
            }

            function log (message) {
                if (logTypes.includes(message.type)) {
                    function convert (time) {
                        return time && time[0] * 1000 + time[1] / 1e6;
                    }
                    message = {
                        type: message.type,
                        error: message.error ? true : false,
                        time: message.request.time,
                        protocol: message.request.protocol || message.request._options?.protocol.replace(":", ""),
                        httpVersion: message.request.httpVersion || message.response.httpVersion,
                        method: message.request.method || message.response.req?.method,
                        path: message.request._parsedUrl?.pathname || message.request._options?.pathname,
                        statusCode: message.response.statusCode,
                        statusMessage: message.response.statusMessage || message.error?.code,
                        userAgent: message.request.headers?.["user-agent"],
                        responseTime: convert(message.response.responseTime),
                        reqSize: message.request.headers?.["content-length"] || 0,
                        resSize: message.response.get?.("content-length") || message.response.headers?.["content-length"] || 0,
                        contentType: message.response.get?.("content-type") || message.response.headers?.["content-type"]
                    }

                    try {sockets[profile].emit("log", message)} catch (e) {}
                }

                // Send to transport if enabled
            }

            function load_resources(allResources = JSON.parse(fs.readFileSync('resources.json')), url=null, trials=null, req=null, res=null, Input = null) {
                if (allResources.length == 0) {return}
                
                var n = 0;
                function load() {
                    var rurl = allResources[n];
                    n += 1;

                    var protocol = new URL(rurl).protocol.replace(":", "");
                    var request = requests.http.get(rurl, (response) => { // All corresponding req options must be sent here as well.
            
                        status(null, "REQUESTSUCCESS");

                        request.time = new Date().toLocaleString();
                        request.startTime = process.hrtime();
            
                        if (response.statusCode.toString()[0] == "2") { // Use a more general rule here.
                            var data = Buffer.from("");
                            response.on('data', (chunk) => {data = Buffer.concat([data, chunk])});
                            response.on('end', () => {
console.log(response.req.getHeader("content-length"))
                                request.endTime = process.hrtime();
                                response.responseTime = process.hrtime(request.startTime);

                                log({type: "incoming", request: request, response: response});

                                var dat = Object.fromEntries(Object.keys(response)
                                    .sort()
                                    // .filter((key) => {
                                    //     if (key !== "socket" && key !== "client" && key !== "req") {
                                    //         return true
                                    //     }
                                    // })
                                    .map((key) => {
                                        return [key, response[key]]
                                    })
                                )
                                // console.log(dat)
                                
                                var entry = res.url; // Is there a better approach?
                                var file = response.req.path;
            
                                var fileParams = file.split('/');
                                var filepath = fileParams.slice(0, fileParams.length-1).join('/');  // (1 of 2) Will this work for a path `/x/y` (without a trailing `/`) redirecting to `/x/y/index.html` from host server?
                                var filename = fileParams[fileParams.length-1];
            
                                if (filename == "") {
                                    filename = `index.${mimeType.extension(response.headers["content-type"])}`;
                                }
            
                                if (fs.existsSync(`${location}/public${file}`)) {
                                    var inputHead = Input.substr(0, 10);
                                    var timestamp = `${(new Date()).getTime()}`;
                                    var random = (function () {
                                        function rand() {return Math.trunc(Math.random()*10).toString()}
                                        return rand()+rand()+rand()+rand();
                                    })();
                                    var unique = `${inputHead}-${timestamp}-${random}`; // NOTE: 29 Characters
            
                                    if (filename.indexOf(".") > -1) {
                                        filename = filename.split(".");
                                        var fileName = filename.slice(0, filename.length-1).join('.');
                                        var fileExt = filename[filename.length-1];
            
                                        filename = `${fileName}-{${unique}}.${fileExt}`; // NOTE: +32 Characters
                                    } else {
                                        filename = `${filename}-{${unique}}`; // NOTE: +32 Characters
                                    }
            
                                    file = `${filepath}/${filename}`;
                                }
            
                                function mkOrModifyDirSync (filepath) {
                                    try {
                                        fs.mkdirSync(`${location}/public${filepath}`, {recursive: true});
                                        return filepath;
                                    } catch (err) {
                                        if (err.code == "EEXIST") {
                                            return mkOrModifyDirSync(`${filepath}-[DIR]`);
                                        } else if (err.code == "ENOTDIR") {
                                            var fileDirs = filepath.split('/').slice(1);
                                            var modifiedPath = "";
                                            for (var dir of fileDirs) {
                                                modifiedPath = mkOrModifyDirSync(`${modifiedPath}/${dir}`);
                                            }
                                            return modifiedPath;
                                        }
                                    }
                                }
            
                                filepath = mkOrModifyDirSync(filepath);
                                file = `${filepath}/${filename}`;
            
                                fs.writeFile(`${location}/public${file}`, data, (err) => {
                                    if (!err) {
                                        // // Building Entry Output
                                        var Output = {};
            
                                        Output.statusCode = response.statusCode;
                                        Output.statusMessage = response.statusMessage;
                                        Output.headers = response.headers;
                                        Output.file = file;
            
                                        Output = JSON.stringify(Output);
            
                                        fs.mkdirSync(`${location}/model${entry}`, {recursive: true});
            
                                        fs.writeFile(`${location}/model${entry}/${Input}.json`, Output, (err) => {
                                            if (!err) {
                                                status(null, "WRITESUCCESS");
                                                
                                                if(req) {send(url, trials, req, res, Input)}
                    
                                                if (n < allResources.length) {load()}
                                            } else {
                                                fs.rm(`${location}/public${file}`, () => {})
            
                                                status(err, "WRITEFAIL");
            
                                                if(req) {send(url, trials, req, res, Input)}
                    
                                                if (n < allResources.length) {load()}
                                            }
                                        });
                                    } else {
                                        status(err, "WRITEFAIL");
            
                                        if(req) {send(url, trials, req, res, Input)}
            
                                        if (n < allResources.length) {load()}
                                    }
                                });
                            });
                        } else {
                            status(`${response.statusCode}:  ${response.statusMessage}`, "UNEXPECTEDRESPONSE")

                            request.endTime = process.hrtime();
                            response.responseTime = process.hrtime(request.startTime);

                            log({type: "incoming", request: request, response: response});
            
                            if(req) {send(url, trials, req, res, Input)}
                            
                            if (n < allResources.length) {load()}
                        }
                    });
                    request.on('error', (error) => {
                        status(error, "REQUESTFAIL");
                        log({type: "incoming", request: request, response: {}, error: error});
            
                        if(req) {send(url, trials, req, res, Input)}
            
                        if (n < allResources.length) {load()}
                    });
                }
            
                load();
            }
            
            function send(url, trials, req, res, Input = null) {
            
                if (res.cachePath == undefined) {
            
                    var entry = req._parsedUrl.pathname;
            
                    if (entry.endsWith("/")) {
                        entry = entry+"index.html";
                    }
            
                    res.url = entry;
            
                    if (!Input) {
                        // // Building Entry Input
                        var Input = {
                            headers: {}
                        };
            
                        Input.method = sortIfObject(req.method);
                        Input.pathname = sortIfObject(req._parsedUrl.pathname);
                        Input.httpVersion = sortIfObject(req.httpVersion);
                        Input.query = sortIfObject(req.query);
                        if(req._body) Input.body = sortIfObject(req.body);
                        Input.cookies = sortIfObject(req.cookies);
                        Input.signedCookies = sortIfObject(req.signedCookies);
                        Input.headers["accept"] = sortIfObject(req.headers["accept"]);
                        Input.headers["accept-encoding"] = sortIfObject(req.headers["accept-encoding"]);
                        Input.headers["accept-language"] = sortIfObject(req.headers["accept-language"]);
                        Input.headers["authorization"] = sortIfObject(req.headers["authorization"]);
                        Input.headers["expect"] = sortIfObject(req.headers["expect"]);
                        Input.headers["from"] = sortIfObject(req.headers["from"]);
                        Input.headers["prefer"] = sortIfObject(req.headers["prefer"]);
                        Input.headers["proxy-authorization"] = sortIfObject(req.headers["proxy-authorization"]);
                        Input.headers["range"] = sortIfObject(req.headers["range"]);
            
                        Input = JSON.stringify(Input);
            
                        // Create a hash
                        var hash = crypto.createHash('sha256');
            
                        hash.on('readable', () => {
                            var InputHash = hash.read();
                            if (InputHash) {
                                Input = InputHash.toString('hex');
                            }
                        });
            
                        hash.write(Input);
                        hash.end();
                    }
            
                    fs.readFile(`${location}/model${entry}/${Input}.json`, (err, Output) => {
                        if (!err) {
                            Output = JSON.parse(Output);
                            
                            var file = Output.file;
                            
                            fs.readFile(`${location}/public${file}`, (err, data) => {
                                if (!err) {
                                    res.data = data;
            
                                    // Execute profile settings for RESPONSES
                                    var Default = new DEFAULT();
                                    settings.ON_INCOMING(req, res, Default);
                        
                                    if (!Default.prevent.includes("all")) { // DEFAULT
            
                                        for (var info of Object.keys(Output)) {
                                            if (info == "file") {}
            
                                            else if (!Default.prevent.includes(`set${info[0].toUpperCase()}${info.slice(1)}`)) { // DEFAULT
                                                if (info == "headers") {
                                                    for (var header of Object.keys(Output.headers)) {
                                                        if (!Default.prevent.includes(`setHeader:${header}`)) { // DEFAULT
                                                            res.setHeader(header, Output.headers[header]);
                                                        }
                                                    }
                                                } else {
                                                    res[info] = Output[info];
                                                }
                                            }
                                        }
                        
                                        if (!Default.prevent.includes("send")) { // DEFAULT
                                            res.send(res.data);
                                        }
                                    }
                                    
                                } else {
                                    if (trials < max_load_resources_trials) {
                                        var fetchUrl = remote_server_address+url
                                        load_resources([fetchUrl], url, trials+1, req, res, Input);
                                    } else {
                                        res.statusCode = "404";
                                        res.end();
                                    }
                                }
                            });
                        } else {
                            if (trials < max_load_resources_trials) {
                                var fetchUrl = remote_server_address+url
                                load_resources([fetchUrl], url, trials+1, req, res, Input);
                            } else {
                                res.statusCode = "404";
                                res.end();
                            }
                        }
                    });
                } else {
                    var file = res.cachePath;
            
                    if (file.endsWith("/")) {
                        file = file+"index.html";
                    }
            
                    res.url = file;
            
                    fs.readFile(`${location}/public${file}`, (err, data) => {
                        if (!err) {
                            res.data = data;
            
                            // Execute profile settings for RESPONSES
                            var Default = new DEFAULT();
                            settings.ON_INCOMING(req, res, Default);
                
                            if (!Default.prevent.includes("all")) { // DEFAULT
                
                                if (!Default.prevent.includes("setStatusCode")) { // DEFAULT
                                    res.statusCode = "200";
                                }
                
                                if (!Default.prevent.includes("setHeader:Content-Type")) { // DEFAULT
                                    var contentType = mimeType.lookup(file) || "application/octet-stream";
                                    res.setHeader("Content-Type", contentType);
                                }
                
                                if (!Default.prevent.includes("send")) { // DEFAULT
                                    res.send(res.data);
                                }
                            }
                            
                        } else {
                            res.statusCode = "404";
                            res.end();
                        }
                    });
                }
            }

            app.get(/^\/.*/, (req, res) => {
                req.time = new Date().toLocaleString();
                req.startTime = process.hrtime();
                res.on("finish", () => {
                    req.endTime = process.hrtime();
                    res.responseTime = process.hrtime(req.startTime);

                    log({type: "outgoing", request: req, response: res});
                });

                var url = req.url;
                var absoluteURL = `http://${host}:${port}${url}`;
                req.URL = new URL(absoluteURL);
                req.URL.params = req.URL.pathname.slice(1).split('/');

                // Execute profile settings for REQUESTS
                var Default = new DEFAULT();
                settings.ON_OUTGOING(req, res, Default);

                if (!Default.prevent.includes("all")) { // DEFAULT
                    send(req.url, 0, req, res);
                }

                var message = res;
                message = {
                    time: message.req.startTime,
                    httpVersion: message.req.httpVersion,
                    method: message.req.method,
                    path: message.req._parsedUrl.pathname,
                    statusCode: message.statusCode,
                    statusMessage: message.statusMessage,
                    userAgent: message.req.headers["user-agent"],
                    responseTime: message.responseTime,
                    reqSize: message.req.headers["content-length"],
                    resSize: message.get("content-length"),
                    contentType: message.get("content-type")
                }
            });

            servers[profile] = app.listen(port, host, () => {
                // When Server is closed
                servers[profile].once("close", () => {
                    try {msg("Server Closed")} catch (e) {}
                    try {sockets[profile].disconnect(true)} catch (e) {}
                    
                    running_profiles.indexOf(profile) > -1 && running_profiles.splice(running_profiles.indexOf(profile), 1);

                    delete servers[profile];
                    delete shells[profile];
                    delete sockets[profile];
                });
                
                if (output == "shell") {
                    shells[profile] = child_process.spawn("node interfaces/shell.js", [profile], {
                        detached: true,
                        shell: true,
                    });

                    shells[profile].exit = function () {
                        shells[profile].kill();
                        try {interface.to(sockets[profile].id).emit("exit")} catch (e) {}
                    };

                    // When Shell is closed
                    shells[profile].once("close", (code, signal) => {
                        try {servers[profile].close()} catch (e) {}
                        try {sockets[profile].disconnect(true)} catch (e) {}

                        delete servers[profile];
                        delete shells[profile];
                        delete sockets[profile];
                        
                        if (mode == "execution") {process.exit()}
                    });
                } else {
                    shells[profile] = {};

                    shells[profile].exit = function () {
                        try {interface.to(sockets[profile].id).emit("exit")} catch (e) {}

                        try {servers[profile].close()} catch (e) {}
                        try {sockets[profile].disconnect(true)} catch (e) {}

                        delete servers[profile];
                        delete shells[profile];
                        delete sockets[profile];

                        if (mode == "execution") {process.exit()}
                    };
                }

                socketed[profile] = function (socket) {
                    if (sockets[profile]) {
                        sockets[profile] = socket;
                        return;
                        // Does the on-disconnect function work here???
                    }
                    
                    sockets[profile] = socket;

                    // When Socket is closed
                    sockets[profile].on("disconnect", (_) => {
                        setTimeout(() => {
                            if (!socket.connected) {
                                try {servers[profile].close()} catch (e) {}
                                try {shells[profile].exit()} catch (e) {}
        
                                delete servers[profile];
                                delete shells[profile];
                                delete sockets[profile];
                            }
                        },
                        10000);
                    });

                    msg(`${profile} is online.\n`);
                    msg(`    | Status:    Active${development?" (Development)":""}`);
                    msg(`    | Interface: http://${host}:${port}\n`);
                    if (!development) {open(`http://${host}:${port}`)}
                };

                servers[profile].removeAllListeners("error");
                resolve(`Running profile: ${profile}`);
            });

            servers[profile].once("error", (err) => {
                reject(err);
            });

        } catch (err) {
            reject(err);
        }
    });
}

function closer (profile) {
    shells[profile].exit()
}

function reloader (profile) {
    reloaders[profile]();
}

var args, options, parsed_args;

function process_argv (statement) {
    args = [];
    options = {};
    parsed_args = 0;

    for (arg of statement) {
        if (arg == "") {}
        else if (!arg.startsWith("-")) {
            args.push(arg);
        } else {
            var option = arg.split("=")[0];
            var value = arg.split("=")[1] || true;
            options[option] = value;
        }
    }
}
process_argv(process.argv.slice(1));

function next_arg () {
    if (!parsed_args) {
        var root_arguments = [
            // Top-level Commands
            "show",
            "install",
            "uninstall",
            "build",
            "register",
            "prepare",
            "run",
            "close",
            "reload",

            // profiles
            ...Object.keys(profiles),

            // aliases
            "all"
        ];

        for (let i = parsed_args; i < args.length; i++) {
            parsed_args++;
            if (root_arguments.includes(args[i])) {
                return args[i];
            }
        }
        return null;
    } else {
        if (args[parsed_args] !== undefined) {
            i = parsed_args;
            parsed_args++;
            return args[i];
        } else {
            return null;
        }
    }
}

function revert_parsed_args () {
    parsed_args--;
}

function selector (arg) {
    // // command: show
    if (arg == "show") {
        return {
            function: show,
            args: [next_arg, options]
        };
    }

    // // command: install
    else if (arg == "install") {
        return {
            function: install,
            args: [next_arg, options]
        };
    }

    // // command: uninstall
    else if (arg == "uninstall") {
        return {
            function: uninstall,
            args: [next_arg, options]
        };
    }

    // // command: build
    else if (arg == "build") {
        return {
            function: build,
            args: [next_arg, options]
        };
    }

    // // command: register
    else if (arg == "register") {
        return {
            function: register,
            args: [next_arg, options]
        };
    }

    // // command: prepare
    else if (arg == "prepare") {
        return {
            function: prepare,
            args: [next_arg, options]
        };
    }

    // // command: run
    else if (arg == "run") {
        return {
            function: run,
            args: [next_arg, options, runner]
        };
    } else if (Object.keys(profiles).includes(arg)) {
        revert_parsed_args();
        return {
            function: run,
            args: [next_arg, options, runner]
        };
    } else if (arg == "all") {
        revert_parsed_args();
        return {
            function: run,
            args: [next_arg, options, runner]
        };
    }

    // // command: close
    else if (arg == "close") {
        return {
            function: close,
            args: [next_arg, options, closer]
        };
    }

    // // command: reload
    else if (arg == "reload") {
        return {
            function: reload,
            args: [next_arg, options, reloader]
        };
    }

    else {
        return null;
    }
}

var command = next_arg();

if (command) {
    var mode = "execution";

    var executor = selector(command);
    executor.function(...executor.args);
} else {
    var mode = "interactive";

    function REPL (input = null) {
        if (input) {
            process_argv(input.split(" "));

            command = next_arg();
            var executor = selector(command);

            if (executor) {
                execution_path_free = false;
                executor.function(...executor.args);
            } else {
                console.log(`Unknown command: ${command}`);
            }
        }

        var interval = setInterval(() => {
            if (execution_path_free) {
                clearInterval(interval);
                process.stdout.write("\n>>> ");
                process.stdin.once("data", (input) => {
                    REPL(input.toString().trim());
                });
            }
        });
    }
    REPL();
}


// var contentType =
// url.endsWith('.html')||url.endsWith('.htm')||url.endsWith('/index')? "text/html" :
// url.endsWith('.js')? "text/javascript" :
// url.endsWith('.css')? "text/css" :
// url.endsWith('.json')? "application/json" :
// url.endsWith('.txt')? "text/plain" :
// url.endsWith('.xml')? "application/xml" :
// url.endsWith('.php')? "application/x-httpd-php" :
// url.endsWith('.ico')? "image/vnd.microsoft.icon" :
// url.endsWith('.jpg')||url.endsWith('.jpeg')? "image/jpeg" :
// url.endsWith('.png')? "image/png" :
// url.endsWith('.svg')? "image/svg+xml" :
// url.endsWith('.gif')? "image/gif" :
// url.endsWith('.webp')? "image/webp" :
// url.endsWith('.tif')? "image/tiff" :
// url.endsWith('.mp4')? "video/mp4" :
// url.endsWith('.webm')? "video/webm" :
// url.endsWith('.pdf')? "application/pdf" :
// url.endsWith('.tif')? "image/tiff" :
// url.endsWith('.ttf')? "font/ttf" :
// url.endsWith('.woff')? "font/woff" :
// url.endsWith('.woff2')? "font/woff2" :
// null;




// if (params[1] == "launch-course") {
//     if (courses[req.query.course] != undefined) {
//         course = req.query.course;
//         var validation = JSON.parse(fs.readFileSync('public/validateLTI'));
//         validation.course = course;
//         fs.writeFileSync('public/validateLTI', JSON.stringify(validation));
//         res.statusCode = "302";
//         res.redirect("/"+course);
//     } else {
//         res.statusCode = "302";
//         res.redirect("/");
//     }
//     res.end();
//     return;
// }