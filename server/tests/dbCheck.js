const { spawnSync } = require("child_process");
const url = require("url");

function checkMongoReachable() {
  const uri = process.env.TEST_MONGO_URI || process.env.MONGO_URI || "mongodb://localhost:27017/wavepass_test";
  
  let host = "127.0.0.1";
  let port = 27017;

  try {
    const parsed = new url.URL(uri.replace(/^mongodb:\/\//, "http://"));
    host = parsed.hostname || "127.0.0.1";
    if (host === "localhost") host = "127.0.0.1";
    port = parseInt(parsed.port, 10) || 27017;
  } catch (e) {
    // Default to localhost:27017
  }

  const probeScript = `
const net = require("net");
const s = new net.Socket();
s.setTimeout(300);
s.on("connect", () => { s.destroy(); process.exit(0); });
s.on("error", () => { process.exit(1); });
s.on("timeout", () => { s.destroy(); process.exit(1); });
s.connect(${port}, "${host}");
`;

  try {
    const res = spawnSync(process.execPath, ["-e", probeScript], { timeout: 1000 });
    return res.status === 0;
  } catch (err) {
    return false;
  }
}

const isDbAvailable = checkMongoReachable();

module.exports = {
  isDbAvailable,
  describeIfDb: (name, fn) => {
    if (isDbAvailable) {
      return describe(name, fn);
    }
    return describe.skip(`[SKIPPED - MongoDB Unavailable] ${name}`, fn);
  },
  testIfDb: (name, fn) => {
    if (isDbAvailable) {
      return test(name, fn);
    }
    return test.skip(`[SKIPPED - MongoDB Unavailable] ${name}`, fn);
  },
};
