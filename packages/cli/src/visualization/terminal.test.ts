/**
 * Tests for Terminal Capability Detection
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  RenderTier,
  detectColorSupport,
  supportsAnimation,
  clearCache,
} from "./terminal";

describe("Terminal Capability Detection", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalIsTTY = process.stdout.isTTY;
    clearCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
    });
    clearCache();
  });

  function setTTY(value: boolean): void {
    Object.defineProperty(process.stdout, "isTTY", {
      value,
      writable: true,
    });
  }

  function clearEnvVars(): void {
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    delete process.env.COLORTERM;
    delete process.env.TERM;
    delete process.env.CI;
    delete process.env.CONTINUOUS_INTEGRATION;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITLAB_CI;
    delete process.env.CIRCLECI;
    delete process.env.TRAVIS;
    delete process.env.JENKINS_URL;
    delete process.env.BUILDKITE;
    delete process.env.TEAMCITY_VERSION;
    delete process.env.TF_BUILD;
  }

  describe("RenderTier enum", () => {
    test("has correct values", () => {
      expect(RenderTier.RICH as string).toBe("rich");
      expect(RenderTier.FULL as string).toBe("full");
      expect(RenderTier.STANDARD as string).toBe("standard");
      expect(RenderTier.COMPAT as string).toBe("compat");
      expect(RenderTier.PLAIN as string).toBe("plain");
    });
  });

  describe("detectColorSupport", () => {
    describe("NO_COLOR precedence", () => {
      test("returns PLAIN when NO_COLOR is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.NO_COLOR = "1";
        process.env.COLORTERM = "truecolor";

        expect(detectColorSupport()).toBe(RenderTier.PLAIN);
      });

      test("returns PLAIN when NO_COLOR is empty string", () => {
        clearEnvVars();
        setTTY(true);
        process.env.NO_COLOR = "";
        process.env.COLORTERM = "truecolor";

        expect(detectColorSupport()).toBe(RenderTier.PLAIN);
      });

      test("NO_COLOR takes precedence over FORCE_COLOR", () => {
        clearEnvVars();
        setTTY(true);
        process.env.NO_COLOR = "";
        process.env.FORCE_COLOR = "3";

        expect(detectColorSupport()).toBe(RenderTier.PLAIN);
      });
    });

    describe("FORCE_COLOR handling", () => {
      test("FORCE_COLOR=0 returns PLAIN", () => {
        clearEnvVars();
        setTTY(true);
        process.env.FORCE_COLOR = "0";

        expect(detectColorSupport()).toBe(RenderTier.PLAIN);
      });

      test("FORCE_COLOR=false returns PLAIN", () => {
        clearEnvVars();
        setTTY(true);
        process.env.FORCE_COLOR = "false";

        expect(detectColorSupport()).toBe(RenderTier.PLAIN);
      });

      test("FORCE_COLOR=1 returns COMPAT", () => {
        clearEnvVars();
        setTTY(true);
        process.env.FORCE_COLOR = "1";

        expect(detectColorSupport()).toBe(RenderTier.COMPAT);
      });

      test("FORCE_COLOR=2 returns STANDARD", () => {
        clearEnvVars();
        setTTY(true);
        process.env.FORCE_COLOR = "2";

        expect(detectColorSupport()).toBe(RenderTier.STANDARD);
      });

      test("FORCE_COLOR=3 returns RICH when TTY", () => {
        clearEnvVars();
        setTTY(true);
        process.env.FORCE_COLOR = "3";

        expect(detectColorSupport()).toBe(RenderTier.RICH);
      });

      test("FORCE_COLOR=3 returns FULL when not TTY", () => {
        clearEnvVars();
        setTTY(false);
        process.env.FORCE_COLOR = "3";

        expect(detectColorSupport()).toBe(RenderTier.FULL);
      });

      test("FORCE_COLOR=true returns RICH when TTY", () => {
        clearEnvVars();
        setTTY(true);
        process.env.FORCE_COLOR = "true";

        expect(detectColorSupport()).toBe(RenderTier.RICH);
      });

      test("FORCE_COLOR empty string returns RICH when TTY", () => {
        clearEnvVars();
        setTTY(true);
        process.env.FORCE_COLOR = "";

        expect(detectColorSupport()).toBe(RenderTier.RICH);
      });
    });

    describe("TERM=dumb handling", () => {
      test("returns PLAIN for dumb terminal", () => {
        clearEnvVars();
        setTTY(true);
        process.env.TERM = "dumb";

        expect(detectColorSupport()).toBe(RenderTier.PLAIN);
      });

      test("dumb terminal is case-insensitive", () => {
        clearEnvVars();
        setTTY(true);
        process.env.TERM = "DUMB";

        expect(detectColorSupport()).toBe(RenderTier.PLAIN);
      });
    });

    describe("COLORTERM detection", () => {
      test("COLORTERM=truecolor returns RICH when TTY", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";

        expect(detectColorSupport()).toBe(RenderTier.RICH);
      });

      test("COLORTERM=truecolor returns FULL when not TTY", () => {
        clearEnvVars();
        setTTY(false);
        process.env.COLORTERM = "truecolor";

        expect(detectColorSupport()).toBe(RenderTier.FULL);
      });

      test("COLORTERM=24bit returns RICH when TTY", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "24bit";

        expect(detectColorSupport()).toBe(RenderTier.RICH);
      });

      test("COLORTERM is case-insensitive", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "TRUECOLOR";

        expect(detectColorSupport()).toBe(RenderTier.RICH);
      });
    });

    describe("TERM 256-color detection", () => {
      test("TERM=xterm-256color returns STANDARD", () => {
        clearEnvVars();
        setTTY(true);
        process.env.TERM = "xterm-256color";

        expect(detectColorSupport()).toBe(RenderTier.STANDARD);
      });

      test("TERM containing 256color returns STANDARD", () => {
        clearEnvVars();
        setTTY(true);
        process.env.TERM = "screen-256color";

        expect(detectColorSupport()).toBe(RenderTier.STANDARD);
      });

      test("TERM with 256-color variant returns STANDARD", () => {
        clearEnvVars();
        setTTY(true);
        process.env.TERM = "tmux-256-color";

        expect(detectColorSupport()).toBe(RenderTier.STANDARD);
      });
    });

    describe("TTY fallback", () => {
      test("returns COMPAT when TTY without other indicators", () => {
        clearEnvVars();
        setTTY(true);
        process.env.TERM = "xterm";

        expect(detectColorSupport()).toBe(RenderTier.COMPAT);
      });

      test("returns PLAIN when not TTY and no other indicators", () => {
        clearEnvVars();
        setTTY(false);
        process.env.TERM = "xterm";

        expect(detectColorSupport()).toBe(RenderTier.PLAIN);
      });
    });

    describe("caching", () => {
      test("caches result across multiple calls", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";

        const first = detectColorSupport();
        process.env.COLORTERM = ""; // Change after first call
        const second = detectColorSupport();

        expect(first).toBe(RenderTier.RICH);
        expect(second).toBe(RenderTier.RICH);
      });

      test("clearCache resets cached values", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";

        const first = detectColorSupport();
        clearCache();
        delete process.env.COLORTERM;
        process.env.TERM = "xterm";
        const second = detectColorSupport();

        expect(first).toBe(RenderTier.RICH);
        expect(second).toBe(RenderTier.COMPAT);
      });
    });
  });

  describe("supportsAnimation", () => {
    test("returns true when RICH tier, TTY, and not CI", () => {
      clearEnvVars();
      setTTY(true);
      process.env.COLORTERM = "truecolor";

      expect(supportsAnimation()).toBe(true);
    });

    test("returns false when not TTY", () => {
      clearEnvVars();
      setTTY(false);
      process.env.COLORTERM = "truecolor";

      expect(supportsAnimation()).toBe(false);
    });

    test("returns false when color support is not RICH", () => {
      clearEnvVars();
      setTTY(true);
      process.env.TERM = "xterm-256color";

      expect(supportsAnimation()).toBe(false);
    });

    describe("CI environment detection", () => {
      test("returns false when CI is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";
        process.env.CI = "true";

        expect(supportsAnimation()).toBe(false);
      });

      test("returns false when CONTINUOUS_INTEGRATION is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";
        process.env.CONTINUOUS_INTEGRATION = "true";

        expect(supportsAnimation()).toBe(false);
      });

      test("returns false when GITHUB_ACTIONS is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";
        process.env.GITHUB_ACTIONS = "true";

        expect(supportsAnimation()).toBe(false);
      });

      test("returns false when GITLAB_CI is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";
        process.env.GITLAB_CI = "true";

        expect(supportsAnimation()).toBe(false);
      });

      test("returns false when CIRCLECI is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";
        process.env.CIRCLECI = "true";

        expect(supportsAnimation()).toBe(false);
      });

      test("returns false when TRAVIS is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";
        process.env.TRAVIS = "true";

        expect(supportsAnimation()).toBe(false);
      });

      test("returns false when JENKINS_URL is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";
        process.env.JENKINS_URL = "http://jenkins.example.com";

        expect(supportsAnimation()).toBe(false);
      });

      test("returns false when BUILDKITE is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";
        process.env.BUILDKITE = "true";

        expect(supportsAnimation()).toBe(false);
      });

      test("returns false when TEAMCITY_VERSION is set", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";
        process.env.TEAMCITY_VERSION = "2023.1";

        expect(supportsAnimation()).toBe(false);
      });

      test("returns false when TF_BUILD is set (Azure Pipelines)", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";
        process.env.TF_BUILD = "True";

        expect(supportsAnimation()).toBe(false);
      });
    });

    describe("caching", () => {
      test("caches animation support result", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";

        const first = supportsAnimation();
        process.env.CI = "true"; // Change after first call
        const second = supportsAnimation();

        expect(first).toBe(true);
        expect(second).toBe(true);
      });

      test("clearCache resets animation cache", () => {
        clearEnvVars();
        setTTY(true);
        process.env.COLORTERM = "truecolor";

        const first = supportsAnimation();
        clearCache();
        process.env.CI = "true";
        const second = supportsAnimation();

        expect(first).toBe(true);
        expect(second).toBe(false);
      });
    });
  });
});
