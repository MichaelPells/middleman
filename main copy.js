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


// const text = "some data to has some data to has 854d3a62003c9b6d45ca11c194ba92ab4858505f1a2157f57c92380775cda7c1 {}:; 6a2da20943931e9834fc12cfe5bb47bbd9ae43489a30726962b576f4e3993e50";

// // create hash algorithm 
// const hash = crypto.createHash('sha256');

// hash.on('readable', () => {
//   // Only one element is going to be produced by the
//   // hash stream.
//   const data = hash.read();
//   if (data) {
//     console.log(data.toString('hex'));
//   }
// });

// hash.write(text);
// hash.end();

// const old_ob = {
//     b: "hi",
//     a: 'hey'
// }
// const ob = Object.fromEntries(Object.keys(old_ob).sort().map((key) => {
//     return [key, old_ob[key]]
// }))
// console.log(JSON.stringify(ob))



const profile = "itn-dl"; // Make this manual

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




// const courses = JSON.parse(fs.readFileSync(PATH.join(__dirname, `${location}/public/courses.json`)));

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

class DEFAULT {
    constructor () {
        this.prevent = [];
    }
}

function load_resources(allResources = JSON.parse(fs.readFileSync('resources.json')), url=null, trials=null, req=null, res=null) {
    if (allResources.length == 0) {return}
    
    n = 0;
    function load() {
        var rurl = allResources[n];
        n += 1;

        if (DB.loaded.indexOf(rurl) == -1) {
            if (development) {console.log(`    Resource: ${n}.    ${rurl}`)}

            var request = https.get(rurl, (response) => {

				reportError(null, "REQUESTSUCCESS");

                if (response.statusCode.toString()[0] == "2") {
                    var rcontent = Buffer.from("");
                    response.on('data', (chunk) => {rcontent = Buffer.concat([rcontent, chunk])});
                    response.on('end', () => {
                        if (res.cachePath == undefined) {
                            if (DB.map[rurl] != undefined) {
                                var rurlSave = DB.map[rurl];
                            } else {
                                var rurlObject = new URL(rurl);
                                var rurlSave = rurlObject.origin+rurlObject.pathname;
                                var rurlSave_dummy = rurlSave;

                                if (rurlSave != rurl) {
                                    var timestamp = new Date();
                                    timestamp = `${timestamp.getTime()}`;
                                    function rand() {return Math.trunc(Math.random()*10).toString()}
                                    var unique = timestamp+'-'+rand()+rand()+rand()+rand()+rand()+rand()+'-';
                                    rurlSave = rurlSave.split('/');
                                    rurlSave = rurlSave.slice(0, rurlSave.length-1).join('/') + '/' + unique + rurlSave[rurlSave.length-1];
                                }

                                rurlSave = ("*"+rurlSave).replace('*'+remote_server_address,'').replace('*https:/','').replace(':','_');
                            }
                        } else {
                            var rurlSave = res.cachePath;
                        }

                        var rpath = rurlSave.split("/").slice(0, rurlSave.split("/").length-1).join("/"); // Will this work for a path `/x/y` (without a trailing `/`) redirecting to `/x/y/index.html` from host server?
                        fs.mkdirSync(`${location}/public${rpath}`, {recursive: true});

                        try {
                            var rfolder = fs.readdirSync(`${location}/public${rurlSave}`);
                            if (rfolder.indexOf("index.html") == -1) {rurlSave += "/index.html"}
                            else {rurlSave += "/index"}
                        }
                        catch (err) {}
                        
                        fs.writeFile(`${location}/public${rurlSave}`, rcontent, (err) => {
                            if (err) {
                                reportError(err, "WRITEFAIL");

                                if(req) {send(url, trials, req, res)}

                                if (n < allResources.length) {load()}
                            } else {
								reportError(null, "WRITESUCCESS");

                                toLoaded(rurl);

                                if (DB.map[rurl] == undefined && rurlSave_dummy != rurl && res.cachePath == undefined) {
                                    toMap([rurl, rurlSave]);
                                }
                                
                                if(req) {send(url, trials, req, res)}

                                if (n < allResources.length) {load()}
                            }
                        });
                    });
                } else {
                    reportError(`${response.statusCode}:  ${response.statusMessage}`, "UNEXPECTEDRESPONSE")

                    if(req) {send(url, trials, req, res)}
                    
                    if (n < allResources.length) {load()}
                }
            });
            request.on('error', (error) => {
                reportError(error, "REQUESTFAIL");

                if(req) {send(url, trials, req, res)}

                if (n < allResources.length) {load()}
            });
        }

        else {
            if(req) {
                fromLoaded(rurl);
                load_resources([rurl], url, trials, req, res);
            }

            if (n < allResources.length) {load()}
        }
    }

    load();
}

if (load_pending) {load_resources()}


function send(url, trials, req, res) {
    var absoluteURL; var urlObject; var urlMain;

    if (res.cachePath == undefined) {
        if (DB.destination[url] != undefined) {
            url = DB.destination[url];
        } else {
            try {
                absoluteURL = remote_server_address+url;
                urlObject = new URL(absoluteURL);
                urlMain = urlObject.origin+urlObject.pathname;

                if (urlMain != absoluteURL) {
                    if (DB.map[absoluteURL] != undefined) {
                        url = DB.map[absoluteURL];
                    }
                }

                absoluteURL = "https:/"+url;
                urlObject = new URL(absoluteURL);
                urlMain = urlObject.origin+urlObject.pathname;

                if (urlMain != absoluteURL) {
                    if (DB.map[absoluteURL] != undefined) {
                        url = DB.map[absoluteURL];
                    }
                }
            }
            catch (e) {}
        }
        var rurl = url;
    } else {
        var rurl = res.cachePath;
    }

    try {
        absoluteURL = `http://${host}:${port}${rurl}`;
        urlObject = new URL(absoluteURL);
        urlMain = urlObject.pathname;

        var folder = fs.readdirSync(`${location}/public${urlMain}`);
        if (folder.indexOf("index.html") > -1) {rurl = urlMain+"/index.html"}
        else if (folder.indexOf("index.htm") > -1) {rurl = urlMain+"/index.htm"}
        else if (folder.indexOf("index") > -1) {rurl = urlMain+"/index"}
    }
    catch (err) {}

    res.url = rurl;

    fs.readFile(`${location}/public${rurl}`, (err, data) => {
        if (!err) {
            res.data = data;
            var Default = new DEFAULT();

            settings.ON_INCOMING(req, res, Default); // Execute profile settings for RESPONSES

            if (!Default.prevent.includes("all")) { // DEFAULT

                if (!Default.prevent.includes("setStatusCode")) { // DEFAULT
                    res.statusCode = "200";
                }

                if (!Default.prevent.includes("setHeader:Content-Type")) { // DEFAULT
                    var contentType = mimeType.lookup(rurl) || "application/octet-stream";
                    res.setHeader("Content-Type", contentType);
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
                load_resources([fetchUrl], url, trials+1, req, res);
            } else {
                res.statusCode = "404";
                res.end();
            }
        }
    });
}

const app = express();

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

    var Default = new DEFAULT();

    settings.ON_OUTGOING(req, res, Default); // Execute profile settings for REQUESTS

    send(req.url, 0, req, res);
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