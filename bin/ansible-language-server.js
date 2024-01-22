#!/usr/bin/env node
const { default: pkgJSON } = await import("../package.json", {
  assert: { type: "json" },
});

if (process.argv.includes("--version")) {
  console.log(`${pkgJSON["version"]}`);
} else {
  require("../out/server/src/server.js");
}
