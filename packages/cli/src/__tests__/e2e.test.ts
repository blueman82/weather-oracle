/**
 * End-to-end tests for Weather Oracle CLI.
 *
 * These tests spawn the actual CLI process and validate:
 * - Command-line argument parsing
 * - Help/version output
 * - Input validation
 *
 * Note: Tests that require API calls use the integration tests
 * with MSW mocking instead (integration.test.ts).
 */

import { describe, it, expect } from "bun:test";
import { spawn } from "bun";
import { join } from "path";

/**
 * Run CLI command and capture output
 */
async function runCli(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  // The CLI entry point is at src/index.ts relative to packages/cli
  const cliPath = join(import.meta.dir, "../index.ts");

  const proc = spawn({
    cmd: ["bun", "run", cliPath, ...args],
    env: {
      ...process.env,
      NO_COLOR: "1", // Disable color output for testing
      FORCE_COLOR: "0",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

describe("CLI E2E Tests", () => {
  describe("help command", () => {
    it("should display help with --help", async () => {
      const result = await runCli(["--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("weather-oracle");
      expect(result.stdout).toContain("forecast");
      expect(result.stdout).toContain("compare");
      expect(result.stdout).toContain("Options:");
      expect(result.stdout).toContain("Commands:");
    });

    it("should display forecast command help", async () => {
      const result = await runCli(["forecast", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("forecast");
      expect(result.stdout).toContain("<location>");
      expect(result.stdout).toContain("--days");
      expect(result.stdout).toContain("--models");
      expect(result.stdout).toContain("--format");
    });

    it("should display compare command help", async () => {
      const result = await runCli(["compare", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("compare");
      expect(result.stdout).toContain("<location>");
      expect(result.stdout).toContain("--days");
      expect(result.stdout).toContain("--models");
    });

    it("should display config command help", async () => {
      const result = await runCli(["config", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("config");
    });
  });

  describe("version command", () => {
    it("should show version with --version", async () => {
      const result = await runCli(["--version"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it("should show version with -V", async () => {
      const result = await runCli(["-V"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe("argument validation", () => {
    it("should error when forecast location is missing", async () => {
      const result = await runCli(["forecast"]);

      // Should fail due to missing required argument
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.length).toBeGreaterThan(0);
    });

    it("should error when compare location is missing", async () => {
      const result = await runCli(["compare"]);

      // Should fail due to missing required argument
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.length).toBeGreaterThan(0);
    });

    it("should error on unknown command", async () => {
      const result = await runCli(["unknowncommand"]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("error");
    });
  });

  describe("global options parsing", () => {
    it("should recognize --units option in help", async () => {
      const result = await runCli(["--help"]);

      expect(result.stdout).toContain("--units");
      expect(result.stdout).toMatch(/metric|imperial/);
    });

    it("should recognize --days option in help", async () => {
      const result = await runCli(["--help"]);

      expect(result.stdout).toContain("--days");
    });

    it("should recognize --verbose option in help", async () => {
      const result = await runCli(["--help"]);

      expect(result.stdout).toContain("--verbose");
    });

    it("should recognize --format option in help", async () => {
      const result = await runCli(["--help"]);

      expect(result.stdout).toContain("--format");
    });
  });

  describe("forecast command options", () => {
    it("should show --no-cache option in forecast help", async () => {
      const result = await runCli(["forecast", "--help"]);

      expect(result.stdout).toContain("--no-cache");
    });

    it("should show format options in forecast help", async () => {
      const result = await runCli(["forecast", "--help"]);

      expect(result.stdout).toMatch(/table|json|narrative|minimal/);
    });
  });

  describe("compare command options", () => {
    it("should show days limit in compare help", async () => {
      const result = await runCli(["compare", "--help"]);

      expect(result.stdout).toContain("--days");
      expect(result.stdout).toMatch(/1-7/);
    });
  });
});

describe("CLI Output Consistency", () => {
  describe("help format consistency", () => {
    it("should have consistent help formatting", async () => {
      const mainHelp = await runCli(["--help"]);
      const forecastHelp = await runCli(["forecast", "--help"]);
      const compareHelp = await runCli(["compare", "--help"]);

      // All should succeed
      expect(mainHelp.exitCode).toBe(0);
      expect(forecastHelp.exitCode).toBe(0);
      expect(compareHelp.exitCode).toBe(0);

      // All should have Options section
      expect(mainHelp.stdout).toContain("Options:");
      expect(forecastHelp.stdout).toContain("Options:");
      expect(compareHelp.stdout).toContain("Options:");
    });
  });

  describe("error message format", () => {
    it("should display error message for missing argument", async () => {
      const result = await runCli(["forecast"]);

      // Should have non-zero exit code
      expect(result.exitCode).not.toBe(0);
      // Should have some error output
      expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0);
    });
  });
});
