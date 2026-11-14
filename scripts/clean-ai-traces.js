#!/usr/bin/env node
// src ও public ফোল্ডারের সব emoji-FIX comment পরিষ্কার করে

import fs from "node:fs";
import path from "node:path";

const EMOJI = /[🐛🚀✅🔒⚡🔧📌🆕💡⚠️🎨🎤✨🗑️📱💾🔐📊📞🎯🔜🔴🟡🟢]/g;
const ROOTS = ["src", "public"];
const SUFFIXES = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".md", ".json", ".html"]);

let count = 0;

for (const root of ROOTS) {
  if (fs.existsSync(root)) walk(root);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".output") {
        continue;
      }
      walk(full);
    } else if (SUFFIXES.has(path.extname(entry.name))) {
      clean(full);
    }
  }
}

function clean(file) {
  const text = fs.readFileSync(file, "utf8");
  let next = text.replace(EMOJI, "");
  next = next.replace(/\/\/\s{2,}/g, "// ");
  next = next.replace(/^\s*\/\/\s*$/gm, "");
  if (next !== text) {
    fs.writeFileSync(file, next, "utf8");
    console.log("cleaned:", file);
    count++;
  }
}

console.log(`\nDone. ${count} files cleaned.`);