import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContentStore } from "../src/store.js";
import { loadDatabase } from "../src/db-base.js";

describe("Markdown CRLF structure and code preservation", () => {
  for (const newline of ["\n", "\r\n"]) {
    it(`retrieves all 20 component/code fixtures with ${JSON.stringify(newline)}`, () => {
      const root = mkdtempSync(join(tmpdir(), "markdown-newlines-"));
      const path = join(root, "corpus.md");
      const blocks = Array.from({ length: 20 }, (_, i) => [
        `export function cache_worker_${i}() {`,
        `  const marker = "PRESERVE_${i} đúng ✓";`, "", "  // # is code, not a heading",
        "  return marker;", "}",
      ].join(newline));
      const content = blocks.map((block, i) => [
        `## Component ${i}`, "", `Incident CACHE${i}: Retry ceiling is ${1000 + i} milliseconds.`, "",
        "```typescript", block, "```", "",
      ].join(newline)).join(newline);
      writeFileSync(path, content);
      const original = readFileSync(path);
      const dbPath = join(root, "content.db");
      const store = new ContentStore(dbPath);
      try {
        expect(store.index({ path, source: "corpus" }).totalChunks).toBe(20);
        for (let i = 0; i < 20; i++) {
          const results = store.searchWithFallback(`CACHE${i} retry ceiling`, 2, "corpus");
          expect(results.some(r => r.content.includes(blocks[i]))).toBe(true);
        }
        const Database = loadDatabase();
        const raw = new Database(dbPath, { readonly: true });
        try {
          const chunks = raw.prepare("SELECT content FROM chunks").all() as Array<{ content: string }>;
          for (const block of blocks) expect(chunks.some(r => r.content.includes(block))).toBe(true);
        } finally { raw.close(); }
        expect(readFileSync(path)).toEqual(original);
      } finally { store.close(); }
    });
  }

  it("keeps blank lines inside an oversized fenced block intact", () => {
    const block = ["```typescript", "// " + "x".repeat(5000), "", "# still code", "const value = 'đúng ✓';", "```"].join("\r\n");
    const store = new ContentStore(join(mkdtempSync(join(tmpdir(), "markdown-long-code-")), "content.db"));
    try {
      store.index({ content: `# Code\r\n\r\n${block}\r\n\r\nTrailing prose.`, source: "long-code" });
      expect(store.searchWithFallback("value đúng", 5, "long-code").some(r => r.content.includes(block))).toBe(true);
    } finally { store.close(); }
  });
});
