const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createServer } = require("vite");

test("sorting returns a success result on every completed path", async (t) => {
  const server = await createServer({
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { sort } = await server.ssrLoadModule("/src/row-manager/timsort.ts");
    for (const size of [0, 1, 10, 31, 32]) {
      await t.test(`${size} items`, async () => {
        const values = Array.from({ length: size }, (_, index) => (index * 7) % 11);
        const expected = [...values].sort((a, b) => a - b);
        const result = await sort(values, (a, b) => a - b, () => false);
        assert.deepEqual(values, expected);
        assert.deepEqual(result, { ok: true });
      });
    }
    await t.test("cancellation still reports failure", async () => {
      const values = Array.from({ length: 64 }, (_, index) => index);
      const result = await sort(values, (a, b) => a - b, () => true);
      assert.deepEqual(result, { ok: false, error: "sorting-cancelled" });
    });
  } finally {
    await server.close();
  }
});
