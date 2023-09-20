process.title = "ContentPro";

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const https = require("follow-redirects").https;
const open = require("open");
const PATH = require("path");
const mimeType = require("mime-types");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const bodyParser = require("body-parser");

const profile = process.argv[process.argv.length-1]; // How should this work exactly?

// LOAD PROFILE SETTINGS
const location = `profiles/${profile}`;
global.SET = module.exports;
const settings = module.exports;

require(`./${location}/settings`);

// DEFAULT SETTINGS
const development = true;

const remote_server_address = settings.URL;
const host = settings.HOST_ADDRESS || "localhost";
const port = settings.PORT_NUMBER;
const max_load_resources_trials = settings.MAX_LOAD_RESOURCES_TRIALS || 1;
const load_pending = false;


DB = {loaded: [], map: {}, destination: {}};
DB.loaded = JSON.parse(fs.readFileSync('loaded.json'));
DB.map =  JSON.parse(fs.readFileSync('resources-map.json'));
DB.destination =  JSON.parse(fs.readFileSync('destination-map.json'));

loaded_new_state = false;
map_new_state = false;
destination_new_state = false;

function loaded_handler() {
    if (loaded_new_state) {
        loaded_new_state = false;
        fs.writeFileSync('loaded.json', JSON.stringify(DB.loaded, null, 2));
    }
}
setInterval(loaded_handler, 0)

function map_handler() {
    if (map_new_state) {
        map_new_state = false;
        fs.writeFileSync('resources-map.json', JSON.stringify(DB.map, null, 2));
    }
}
setInterval(map_handler, 0)

function destination_handler() {
    if (destination_new_state) {
        destination_new_state = false;
        fs.writeFileSync('destination-map.json', JSON.stringify(DB.destination, null, 2));
    }
}
setInterval(destination_handler, 0)

function toLoaded(res) {
    DB.loaded.push(res);
    loaded_new_state = true;
}
function toMap(res) {
    DB.map[res[0]] = res[1];
    map_new_state = true;
}
function toDestination(res) {
    DB.destination[res[0]] = res[1];
    destination_new_state = true;
}
function fromLoaded(res) {
    DB.loaded.splice(DB.loaded.indexOf(res), 1);
    loaded_new_state = true;
}

recent_error = [];
error_new_state = false;
last_log_length = 0;
last_error_code = null;
const clearPrevError = () => {
	var dy = Math.ceil(last_log_length / process.stdout.columns);
	process.stdout.moveCursor(0, -dy);
	process.stdout.clearScreenDown();
}

function error_handler() {
    if (error_new_state) {
		error_new_state = false;

		var error = recent_error;
		
		if (error[1] == "REQUESTFAIL") {
			if (last_log_length) {clearPrevError()}
			var log = "Problem Getting New Resources: Ensure you have a working Internet connection.";
			console.error(log);
			last_log_length = log.length;
			last_error_code = error[1];
		}
		else if (error[1] == "WRITEFAIL") {
			if (last_log_length) {clearPrevError()}
			var log = "Problem Providing New Resources: ContentPro may be corrupt, or you have no 'write' permission in this installation folder. Try changing installation folder or running ContentPro as Admin. If problem persists, you may reinstall ContentPro.";
			console.error(log);
			last_log_length = log.length;
			last_error_code = error[1];
		}
		else if (error[1] == "REQUESTSUCCESS") {
			if (last_error_code == "REQUESTFAIL") {
				clearPrevError();
				var log = "";
				last_log_length = log.length;
				last_error_code = error[1];
			}
		}
		else if (error[1] == "WRITESUCCESS") {
			if (last_error_code == "WRITEFAIL") {
				clearPrevError();
				var log = "";
				last_log_length = log.length;
				last_error_code = error[1];
			}
		}
    }
}
setInterval(error_handler, 0)

function reportError(msg, code=null) {
	if (development) {
		if (msg) {console.error(msg)}
	}
	else {
		recent_error = [msg, code];
		error_new_state = true;
	}
}

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

function load_resources(allResources = JSON.parse(fs.readFileSync('resources.json')), url=null, trials=null, req=null, res=null, Input = null) {
    if (allResources.length == 0) {return}
    
    n = 0;
    function load() {
        var rurl = allResources[n];
        n += 1;

        if (development) {console.log(`    Resource: ${n}.    ${rurl}`)}

        var request = https.get(rurl, (response) => { // All corresponding req options must be sent here as well.

            reportError(null, "REQUESTSUCCESS");

            if (response.statusCode.toString()[0] == "2") { // Use a more general rule here.
                var data = Buffer.from("");
                response.on('data', (chunk) => {data = Buffer.concat([data, chunk])});
                response.on('end', () => {
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
                    console.log(dat)
                    
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
                                    reportError(null, "WRITESUCCESS");
                                    
                                    if(req) {send(url, trials, req, res, Input)}
        
                                    if (n < allResources.length) {load()}
                                } else {
                                    fs.rm(`${location}/public${file}`, () => {})

                                    reportError(err, "WRITEFAIL");

                                    if(req) {send(url, trials, req, res, Input)}
        
                                    if (n < allResources.length) {load()}
                                }
                            });
                        } else {
                            reportError(err, "WRITEFAIL");

                            if(req) {send(url, trials, req, res, Input)}

                            if (n < allResources.length) {load()}
                        }
                    });
                });
            } else {
                reportError(`${response.statusCode}:  ${response.statusMessage}`, "UNEXPECTEDRESPONSE")

                if(req) {send(url, trials, req, res, Input)}
                
                if (n < allResources.length) {load()}
            }
        });
        request.on('error', (error) => {
            reportError(error, "REQUESTFAIL");

            if(req) {send(url, trials, req, res, Input)}

            if (n < allResources.length) {load()}
        });
    }

    load();
}

if (load_pending) {load_resources()}

// app.post("/^\/.*/", (req, res) => { // DELETE IMMEDIATELY
//     console.log(req.header)
//     console.log(req.headers[""])
// });

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
                    console.log(Input)
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
                            var maps_keys = Object.keys(DB.map);
                            var maps_values = Object.values(DB.map);
                            var map_index = maps_values.indexOf(url);
                            if (map_index > -1) {var fetchUrl = maps_keys[map_index]}
                            else {var fetchUrl = remote_server_address+url}
                            load_resources([fetchUrl], url, trials+1, req, res, Input);
                        } else {
                            res.statusCode = "404";
                            res.end();
                        }
                    }
                });
            } else {
                console.log(err)
                if (trials < max_load_resources_trials) {
                    var maps_keys = Object.keys(DB.map);
                    var maps_values = Object.values(DB.map);
                    var map_index = maps_values.indexOf(url);
                    if (map_index > -1) {var fetchUrl = maps_keys[map_index]}
                    else {var fetchUrl = remote_server_address+url}
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

const app = express();

const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

io.on("connection", (socket) => {
    console.log(`Connected!`);

    socket.on("disconnect", (socket) => {
        console.log(`Disconnected`);
    })
})

server.listen(3000, () => {
    console.log(`Socket.io Server is listening...`);
})

const child_process = require('child_process');

var child = child_process.spawn('node', ['sub.js'], {
    detached: true,
    shell: true,
});

setTimeout(() => {
    io.emit("report", "Hello");
}, 2000);

app.use(cors());
app.use(cookieParser());
// app.use(express.json({limit: '1024mb'}));
app.use(bodyParser());
app.use(express.text());
// app.use(express.urlencoded());
//app.use(express.static(PATH.join(__dirname, "public/")));

app.get(/^\/.*/, (req, res) => {

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
});

app.post(/^\/.*/, (req, res) => {
    var data = Object.fromEntries(Object.keys(req)
        .sort()
        .filter((key) => {
            if (key !== "socket" && key !== "client" && key !== "res") {
                return true
            }
        })
        .map((key) => {
            return [key, req[key]]
        })
    )
    console.log(req.header)
    console.log(req.headers)
    res.json(data)
});

app.post('/', (req, res) => {
    var url = req.body.file[0];
    var content = req.body.file[1];
    var resources = req.body.file[2];

    var path = url.split("/").slice(0, url.split("/").length-1).join("/");

    try {
        var saved = JSON.parse(fs.readFileSync('saved.json'));
        console.log(`${saved.length+1}.    ${url}`);

        fs.mkdirSync(`public${path}`, {recursive: true});

        fs.writeFile(`public${url}`, content, (err) => {
            if (err) {
                res.json(["failed", err]);
                reportError(err);
            } else {
                res.json(["success", "file saved successfully"]);
                saved.push(url);
                fs.writeFileSync('saved.json', JSON.stringify(saved, null, 2));

                for (var n=0; n<resources.length; n++) {
                    var r = resources[n];

                    var allR = JSON.parse(fs.readFileSync('resources.json'));
                    if (typeof(r) != "object") {
                        if (allR.indexOf(r) == -1) {
                            allR.push(r);
                            fs.writeFileSync('resources.json', JSON.stringify(allR, null, 2));
                        }
                    } else {
                        if (allR.indexOf(r[0]) == -1) {
                            allR.push(r[0]);
                            fs.writeFileSync('resources.json', JSON.stringify(allR, null, 2));
                            toMap([r[0], r[1]]);
                        } else {
                            toDestination([r[1], DB.map[r[0]]]);
                        }
                    }
                }

                // allL = JSON.parse(fs.readFileSync('links.json'));
                // allL[url.split("/")[url.split("/").length-1].replace('.','')] = links;
                // fs.writeFileSync('links.json', JSON.stringify(allL, null, 2));
            }
        });
    }
    catch (err) {
        res.json(["failed", err]);
        reportError(err);
    }
});

app.listen(port, host, () => {
	console.log('Cisco NetAcad Content Provider (ContentPro) v1.0\n');
	console.log(`    | Status:    Active${development?" (Development)":""}`);
	console.log(`    | Interface: http://${host}:${port}`);
	console.log(`\n`);
	if (!development) {open(`http://${host}:${port}`)}
});




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