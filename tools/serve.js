// Tiny static server for testing on a phone: node tools/serve.js [port]
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const root = path.join(__dirname, ".."), port = +process.argv[2] || 8080;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(p).pipe(res);
}).listen(port, "0.0.0.0", () => {
  for (const list of Object.values(os.networkInterfaces())) for (const i of list) if (i.family === "IPv4" && !i.internal) console.log(`http://${i.address}:${port}`);
});
