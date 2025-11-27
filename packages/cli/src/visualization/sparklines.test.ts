/**
 * Tests for Temperature Sparklines
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  SPARK_CHARS,
  createTempSparkline,
  createPrecipBars,
  createWindArrows,
} from "./sparklines";
import { clearGradientCache } from "./gradient";
import { clearCache as clearTerminalCache } from "./terminal";

describe("Temperature Sparklines", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalIsTTY = process.stdout.isTTY;
    clearGradientCache();
    clearTerminalCache();
    // Enable truecolor for tests
    setTTY(true);
    clearEnvVars();
    process.env.COLORTERM = "truecolor";
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
    });
    clearGradientCache();
    clearTerminalCache();
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
  }

  describe("SPARK_CHARS", () => {
    test("contains exactly 8 characters", () => {
      expect(SPARK_CHARS.length).toBe(8);
    });

    test("contains expected block characters in order", () => {
      expect(SPARK_CHARS[0]).toBe("▁");
      expect(SPARK_CHARS[1]).toBe("▂");
      expect(SPARK_CHARS[2]).toBe("▃");
      expect(SPARK_CHARS[3]).toBe("▄");
      expect(SPARK_CHARS[4]).toBe("▅");
      expect(SPARK_CHARS[5]).toBe("▆");
      expect(SPARK_CHARS[6]).toBe("▇");
      expect(SPARK_CHARS[7]).toBe("█");
    });

    test("all characters are single Unicode code points", () => {
      for (const char of SPARK_CHARS) {
        expect([...char].length).toBe(1);
      }
    });
  });

  describe("createTempSparkline", () => {
    test("returns empty string for empty array", () => {
      expect(createTempSparkline([])).toBe("");
    });

    test("creates sparkline with single value at middle height", () => {
      const result = createTempSparkline([20]);
      // Should contain the middle block character (index 4 = ▅)
      expect(result).toContain("▅");
      // Should have color codes
      expect(result).toMatch(/\x1b\[38;2;\d+;\d+;\d+m/);
    });

    test("creates sparkline with all same values at middle height", () => {
      const result = createTempSparkline([15, 15, 15, 15]);
      // Count block characters (should all be middle height)
      const blocks = result.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(blocks.length).toBe(4);
      // All should be the same height
      expect(blocks.every((b) => b === "▅")).toBe(true);
    });

    test("maps min value to lowest bar and max to highest", () => {
      const result = createTempSparkline([0, 10, 20, 30, 40]);
      const blocks = result.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(blocks.length).toBe(5);
      // First should be lowest (▁), last should be highest (█)
      expect(blocks[0]).toBe("▁");
      expect(blocks[4]).toBe("█");
    });

    test("normalizes heights to data range", () => {
      // Even with high absolute temps, heights should be relative
      const result = createTempSparkline([30, 35, 40]);
      const blocks = result.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(blocks[0]).toBe("▁"); // 30 is min
      expect(blocks[2]).toBe("█"); // 40 is max
    });

    test("applies different colors for different temperatures", () => {
      const coldResult = createTempSparkline([-20, -10, 0]);
      const hotResult = createTempSparkline([30, 35, 40]);

      // Extract RGB values from ANSI codes
      const coldColors = coldResult.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g);
      const hotColors = hotResult.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g);

      expect(coldColors).not.toBeNull();
      expect(hotColors).not.toBeNull();
      // Colors should be different
      expect(coldColors![0]).not.toBe(hotColors![0]);
    });

    test("handles negative temperatures", () => {
      const result = createTempSparkline([-30, -20, -10]);
      const blocks = result.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(blocks.length).toBe(3);
      expect(blocks[0]).toBe("▁"); // -30 is min
      expect(blocks[2]).toBe("█"); // -10 is max
    });

    test("handles mixed positive and negative temperatures", () => {
      const result = createTempSparkline([-10, 0, 10, 20]);
      const blocks = result.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(blocks.length).toBe(4);
      expect(blocks[0]).toBe("▁"); // -10 is min
      expect(blocks[3]).toBe("█"); // 20 is max
    });

    test("produces string with ANSI reset codes", () => {
      const result = createTempSparkline([10, 20, 30]);
      // Each colored character should have a reset code
      const resets = result.match(/\x1b\[0m/g) || [];
      expect(resets.length).toBe(3);
    });

    test("semantic coloring: cold temps are blue-ish, hot temps are red-ish", () => {
      const coldResult = createTempSparkline([-25]);
      const hotResult = createTempSparkline([35]);

      // Extract RGB values
      const coldMatch = coldResult.match(
        /\x1b\[38;2;(\d+);(\d+);(\d+)m/
      );
      const hotMatch = hotResult.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);

      expect(coldMatch).not.toBeNull();
      expect(hotMatch).not.toBeNull();

      const coldR = parseInt(coldMatch![1]);
      const coldB = parseInt(coldMatch![3]);
      const hotR = parseInt(hotMatch![1]);
      const hotB = parseInt(hotMatch![3]);

      // Cold should have more blue than red
      expect(coldB).toBeGreaterThan(coldR);
      // Hot should have more red than blue
      expect(hotR).toBeGreaterThan(hotB);
    });
  });

  describe("createPrecipBars", () => {
    test("returns empty string for empty array", () => {
      expect(createPrecipBars([])).toBe("");
    });

    test("returns space for 0% probability", () => {
      const result = createPrecipBars([0]);
      expect(result).toBe(" ");
    });

    test("returns full block for 100% probability", () => {
      const result = createPrecipBars([100]);
      expect(result).toContain("█");
    });

    test("handles array of probabilities", () => {
      const result = createPrecipBars([0, 25, 50, 75, 100]);
      // First is space (0%)
      expect(result[0]).toBe(" ");
      // Should have blocks for non-zero values
      const blocks = result.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(blocks.length).toBe(4);
    });

    test("clamps values below 0", () => {
      const result = createPrecipBars([-10]);
      expect(result).toBe(" ");
    });

    test("clamps values above 100", () => {
      const result = createPrecipBars([150]);
      expect(result).toContain("█");
    });

    test("uses blue color coding for non-zero probabilities", () => {
      const result = createPrecipBars([50]);
      // Should have blue-ish ANSI color (high blue component)
      expect(result).toMatch(/\x1b\[38;2;\d+;\d+;\d+m/);
    });

    test("maps mid-range probability to mid-height bar", () => {
      const result = createPrecipBars([50]);
      // 50% should map to around index 4 (▄ or ▅)
      expect(result).toMatch(/[▄▅]/);
    });
  });

  describe("createWindArrows", () => {
    test("returns empty string for empty arrays", () => {
      expect(createWindArrows([], [])).toBe("");
      expect(createWindArrows([90], [])).toBe("");
      expect(createWindArrows([], [10])).toBe("");
    });

    test("returns arrow for single direction and speed", () => {
      const result = createWindArrows([0], [5]);
      // North wind = down arrow (wind FROM north)
      expect(result).toContain("↓");
    });

    test("maps compass directions to correct arrows", () => {
      // N=0, E=90, S=180, W=270
      const directions = [0, 90, 180, 270];
      const speeds = [5, 5, 5, 5];
      const result = createWindArrows(directions, speeds);

      expect(result).toContain("↓"); // N
      expect(result).toContain("←"); // E
      expect(result).toContain("↑"); // S
      expect(result).toContain("→"); // W
    });

    test("handles diagonal directions", () => {
      // NE=45, SE=135, SW=225, NW=315
      const directions = [45, 135, 225, 315];
      const speeds = [5, 5, 5, 5];
      const result = createWindArrows(directions, speeds);

      expect(result).toContain("↙"); // NE
      expect(result).toContain("↖"); // SE
      expect(result).toContain("↗"); // SW
      expect(result).toContain("↘"); // NW
    });

    test("normalizes directions > 360", () => {
      const result1 = createWindArrows([0], [5]);
      const result2 = createWindArrows([360], [5]);
      const result3 = createWindArrows([720], [5]);

      // All should have same arrow (north)
      const arrow1 = result1.match(/[↓↙←↖↑↗→↘]/)?.[0];
      const arrow2 = result2.match(/[↓↙←↖↑↗→↘]/)?.[0];
      const arrow3 = result3.match(/[↓↙←↖↑↗→↘]/)?.[0];

      expect(arrow1).toBe(arrow2);
      expect(arrow2).toBe(arrow3);
    });

    test("handles negative directions", () => {
      const result = createWindArrows([-90], [5]);
      // -90 = 270 = West
      expect(result).toContain("→");
    });

    test("applies color based on wind speed", () => {
      const calmResult = createWindArrows([0], [2]);
      const strongResult = createWindArrows([0], [25]);

      // Both should have color codes
      expect(calmResult).toMatch(/\x1b\[38;2;\d+;\d+;\d+m/);
      expect(strongResult).toMatch(/\x1b\[38;2;\d+;\d+;\d+m/);

      // Colors should be different
      const calmColor = calmResult.match(
        /\x1b\[38;2;(\d+);(\d+);(\d+)m/
      );
      const strongColor = strongResult.match(
        /\x1b\[38;2;(\d+);(\d+);(\d+)m/
      );

      expect(calmColor).not.toBeNull();
      expect(strongColor).not.toBeNull();
      expect(calmColor![0]).not.toBe(strongColor![0]);
    });

    test("uses shorter array length when arrays differ", () => {
      const result = createWindArrows([0, 90, 180], [5, 10]);
      // Should only have 2 arrows (shorter array length)
      const arrows = result.match(/[↓↙←↖↑↗→↘]/g) || [];
      expect(arrows.length).toBe(2);
    });

    test("produces colored arrows with reset codes", () => {
      const result = createWindArrows([0, 90], [5, 10]);
      // Should have reset codes
      const resets = result.match(/\x1b\[0m/g) || [];
      expect(resets.length).toBe(2);
    });

    test("calm winds are greenish, strong winds are reddish", () => {
      const calmResult = createWindArrows([0], [3]);
      const strongResult = createWindArrows([0], [28]);

      const calmMatch = calmResult.match(
        /\x1b\[38;2;(\d+);(\d+);(\d+)m/
      );
      const strongMatch = strongResult.match(
        /\x1b\[38;2;(\d+);(\d+);(\d+)m/
      );

      expect(calmMatch).not.toBeNull();
      expect(strongMatch).not.toBeNull();

      const calmG = parseInt(calmMatch![2]);
      const strongR = parseInt(strongMatch![1]);

      // Calm should have significant green
      expect(calmG).toBeGreaterThan(150);
      // Strong should have high red
      expect(strongR).toBeGreaterThan(200);
    });
  });

  describe("integration", () => {
    test("all functions work together for weather display", () => {
      const temps = [15, 18, 22, 25, 23, 20, 17];
      const precip = [10, 20, 40, 60, 30, 10, 5];
      const windDir = [45, 90, 90, 135, 180, 225, 270];
      const windSpd = [5, 8, 12, 15, 10, 7, 4];

      const tempLine = createTempSparkline(temps);
      const precipLine = createPrecipBars(precip);
      const windLine = createWindArrows(windDir, windSpd);

      // All should produce non-empty output
      expect(tempLine.length).toBeGreaterThan(0);
      expect(precipLine.length).toBeGreaterThan(0);
      expect(windLine.length).toBeGreaterThan(0);

      // All should have correct number of visual characters
      const tempBlocks = tempLine.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(tempBlocks.length).toBe(7);

      const windArrows = windLine.match(/[↓↙←↖↑↗→↘]/g) || [];
      expect(windArrows.length).toBe(7);
    });

    test("works with plain text mode", () => {
      clearGradientCache();
      clearTerminalCache();
      clearEnvVars();
      process.env.NO_COLOR = "1";

      const temps = [10, 20, 30];
      const result = createTempSparkline(temps);

      // Should still have block characters
      const blocks = result.match(/[▁▂▃▄▅▆▇█]/g) || [];
      expect(blocks.length).toBe(3);

      // Should NOT have ANSI codes
      expect(result).not.toMatch(/\x1b\[/);
    });
  });
});
