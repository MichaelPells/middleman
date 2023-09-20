const { compile } = require("nexe")

compile({
	input: "main.js",
	output: "ContentPro",
	build: true,
	target: "win",
	python: "C:/python",
	resources: ["public/courses.json"],
	verbose: true,
	ico: "node_res/node.ico",
	rc: {
		CompanyName: "ContentPro",
		ProductName: "Cisco NetAcad Content Provider",
		FileDescription: "Cisco NetAcad Content Provider (ContentPro) | Middleware for NetAcad",
		ProductVersion: "1.0.0",
		FileVersion: "1.0.0",
		OriginalFilename: "ContentPro.exe",
		InternalName: "ContentPro",
		LegalCopyright: "Copyright ContentPro Developer"
	}
})
.then(() => {
	console.log("Node Application Compiled!")
})