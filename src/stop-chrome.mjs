import { chromium } from "playwright-core";
import { CDP_URL } from "./config.mjs";

try {
  const browser = await chromium.connectOverCDP(CDP_URL);
  console.log(`Closing dedicated Chrome session at ${CDP_URL}...`);
  await browser.close();
  console.log("Dedicated Chrome session closed.");
} catch (error) {
  console.log(`No reachable dedicated Chrome session at ${CDP_URL}.`);
  console.log("It may already be closed.");
}
