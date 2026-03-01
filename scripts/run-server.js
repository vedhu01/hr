import { execSync } from "child_process";

try {
  const output = execSync("cd /vercel/share/v0-project && npx tsx server.ts", {
    timeout: 15000,
    encoding: "utf-8",
    env: { ...process.env, NODE_ENV: "production" },
  });
  console.log(output);
} catch (err) {
  if (err.stderr) {
    console.error("STDERR:", err.stderr);
  }
  if (err.stdout) {
    console.log("STDOUT:", err.stdout);
  }
  if (err.status !== null && err.status !== 0 && !err.killed) {
    console.error("Process exited with code:", err.status);
  } else if (err.killed) {
    console.log("(Server was still running when timeout hit - this means it started successfully!)");
  }
}
