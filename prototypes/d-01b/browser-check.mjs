// Optional browser check: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node browser-check.mjs
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const click = (action) => page.locator(`[data-action="${action}"]`).click();
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("machine-d01b-borrowbox-v3")));
try {
  await page.goto("http://127.0.0.1:4173");
  await page.screenshot({
    path: "docs/evidence/d-01b-overview.png",
    fullPage: true,
  });
  await click("decision");
  assert.ok(await page.getByRole("heading", { name: "No blocking decisions" }).isVisible());
  assert.equal((await saved()).state, "Ready");
  await page.getByRole("link", { name: "Review ready task" }).click();
  await click("authorize");
  await click("map");
  await click("start");
  await click("finish");
  assert.equal((await saved()).state, "Awaiting review");
  await page.screenshot({
    path: "docs/evidence/d-01b-review.png",
    fullPage: true,
  });
  await page.reload();
  assert.equal((await saved()).artifacts.length, 1);
  await click("revision");
  await click("authorize");
  await click("map");
  await click("start");
  await click("finish");
  assert.equal((await saved()).artifacts.length, 2);
  await page.locator("#artifact").selectOption("1");
  assert.ok(await page.locator('[data-action="accept"]').isDisabled());
  await page.locator("#artifact").selectOption("2");
  await click("accept");
  assert.equal((await saved()).state, "Completed");
  await page.getByLabel("Project navigation").getByRole("link", { name: "Decisions", exact: true }).click();
  await page.reload();
  assert.ok(await page.getByRole("heading", { name: "No blocking decisions" }).isVisible());
  for (const scenario of [
    "Worker unavailable",
    "Connector unavailable",
    "Connector conflict",
    "Failure",
    "Blocked input",
  ]) {
    await click("reset");
    await click("decision");
    await page.getByRole("link", { name: "Review ready task" }).click();
    await page.locator("#scenario").selectOption(scenario);
    await click("authorize");
    await click("map");
    if (scenario === "Worker unavailable") {
      await click("cancel");
      await click("uncertain");
      await click("confirmCancel");
      assert.equal((await saved()).state, "Cancelled");
      continue;
    }
    if (scenario.startsWith("Connector")) await click("reconcile");
    await click("start");
    await click("finish");
    if (scenario === "Failure") {
      assert.equal((await saved()).state, "Failed");
      await click("authorize");
      assert.equal((await saved()).auth.length, 2);
    }
    if (scenario === "Blocked input") {
      await click("answer");
      assert.equal((await saved()).state, "Continue ready");
      await click("authorize");
      assert.equal((await saved()).auth.length, 2);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await click("reset");
  await page.goto("http://127.0.0.1:4173/#overview");
  assert.ok(await page.getByRole("link", { name: "Back to decisions" }).isVisible());
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: direction B queue, no-decisions state, authorization distinction, revision/staleness, five alternate scenarios, mobile navigation/overflow, no page errors",
  );
} finally {
  await browser.close();
}
