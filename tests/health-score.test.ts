import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const SCRIPT_PATH = path.resolve(
  import.meta.dirname,
  "../.github/scripts/health-score.js"
);

function runScript(knipData: unknown): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "health-score-test-"));
  const knipPath = path.join(tmpDir, "knip.json");
  const reportPath = path.join(tmpDir, "health-report.md");

  if (knipData !== null) {
    fs.writeFileSync(knipPath, JSON.stringify(knipData));
  }

  execSync(`node ${SCRIPT_PATH}`, {
    cwd: tmpDir,
    env: { ...process.env },
  });

  const report = fs.readFileSync(reportPath, "utf-8");
  fs.rmSync(tmpDir, { recursive: true });
  return report;
}

describe("health-score.js", () => {
  it("should output score 100 when knip finds no issues", () => {
    const report = runScript({ files: [], issues: [] });
    expect(report).toContain("100");
    expect(report).toContain("✅");
  });

  it("should deduct 5 points per unused file", () => {
    const report = runScript({
      files: ["a.ts", "b.ts"],
      issues: [],
    });
    expect(report).toContain("90");
    expect(report).toContain("✅");
  });

  it("should deduct 5 points per unused export/type/dependency in issues", () => {
    const report = runScript({
      files: [],
      issues: [
        {
          file: "src/foo.ts",
          exports: [{ name: "foo", line: 1, col: 1, pos: 0 }],
          types: [{ name: "Bar", line: 2, col: 1, pos: 10 }],
          dependencies: [],
          devDependencies: [],
          unlisted: [],
        },
      ],
    });
    // 2 items * 5 = 10, score = 90
    expect(report).toContain("90");
  });

  it("should show warning when score is below 80", () => {
    const files = Array.from({ length: 5 }, (_, i) => `file${i}.ts`);
    const report = runScript({ files, issues: [] });
    // 100 - 25 = 75
    expect(report).toContain("75");
    expect(report).toContain("❌");
  });

  it("should clamp score to 0 when many unused items", () => {
    const files = Array.from({ length: 30 }, (_, i) => `file${i}.ts`);
    const report = runScript({ files, issues: [] });
    expect(report).toContain(" 0 ");
    expect(report).toContain("❌");
  });

  it("should handle missing knip.json gracefully", () => {
    const report = runScript(null);
    expect(report).toContain("100");
    expect(report).toContain("knip result unavailable");
  });

  it("should include category breakdown in report", () => {
    const report = runScript({
      files: ["a.ts"],
      issues: [
        {
          file: "src/foo.ts",
          exports: [{ name: "x", line: 1, col: 1, pos: 0 }],
          types: [],
          dependencies: [{ name: "dep", line: 1, col: 1, pos: 0 }],
          devDependencies: [],
          unlisted: [],
        },
      ],
    });
    expect(report).toContain("Unused files: 1");
    expect(report).toContain("Unused exports: 1");
    expect(report).toContain("Unused dependencies: 1");
  });

  it("should handle empty issues array with all zero counts", () => {
    const report = runScript({ files: [], issues: [] });
    expect(report).toContain("100");
    expect(report).not.toContain("Unused files");
  });

  it("should handle malformed knip.json gracefully", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "health-score-test-"));
    fs.writeFileSync(path.join(tmpDir, "knip.json"), "not valid json{{{");
    const reportPath = path.join(tmpDir, "health-report.md");

    execSync(`node ${SCRIPT_PATH}`, { cwd: tmpDir });

    const report = fs.readFileSync(reportPath, "utf-8");
    fs.rmSync(tmpDir, { recursive: true });

    expect(report).toContain("100");
    expect(report).toContain("knip result unavailable");
  });
});
