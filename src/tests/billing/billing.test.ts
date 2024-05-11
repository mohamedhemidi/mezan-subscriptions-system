import { beforeAll, describe, expect, it } from "vitest";
import resetDb from "../helpers/resetDb";

describe("billing routes", async () => {
  beforeAll(async () => {
    await resetDb();
  });
  describe("billing", async () => {
    it("should commit test", async () => {
      expect(true).toBe(true);
    });
  });
});
