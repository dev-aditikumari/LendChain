// the package is an ES module, but the build is CommonJS: tell Node so for everything under dist
require("node:fs").writeFileSync(require("node:path").join(__dirname, "..", "dist", "package.json"), '{ "type": "commonjs" }\n');
