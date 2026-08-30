import fs from "fs";
import path from "path";

const EXCLUDE_EXT = [".png", ".jpg", ".jpeg", ".ico", ".svg", ".lock", ".webp"];

function scanDir(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== ".git") {
        scanDir(fullPath, results);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!EXCLUDE_EXT.includes(ext)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          // Check for agent, Agent, AGENT
          // Filter out generic HTTP "user-agent" or "User-Agent"
          const cleanLine = line.replace(/user-agent/gi, "");
          if (/\bagent\b|\bagents\b/i.test(cleanLine)) {
            results.push({
              file: path.relative(process.cwd(), fullPath),
              line: idx + 1,
              text: line.trim(),
            });
          }
        });
      }
    }
  }
  return results;
}

const matches = scanDir("src");
console.log(`Total agent matches in src: ${matches.length}`);
const fileMap = {};
matches.forEach(m => {
  fileMap[m.file] = (fileMap[m.file] || 0) + 1;
});
console.log("Matches by file:");
Object.entries(fileMap).forEach(([f, count]) => {
  console.log(`- ${f}: ${count} matches`);
});
