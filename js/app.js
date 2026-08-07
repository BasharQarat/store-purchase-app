import { openDb } from "./db.js";
import { renderLogPurchase } from "./screens/logPurchase.js";
import { renderToday } from "./screens/today.js";
import { renderItems } from "./screens/items.js";
import { renderLabels } from "./screens/labels.js";

const SCREENS = {
  log: { el: document.getElementById("screen-log"), render: renderLogPurchase },
  today: { el: document.getElementById("screen-today"), render: renderToday },
  items: { el: document.getElementById("screen-items"), render: renderItems },
  labels: { el: document.getElementById("screen-labels"), render: renderLabels },
};

let db;

async function showScreen(name) {
  for (const [key, screen] of Object.entries(SCREENS)) {
    screen.el.classList.toggle("active", key === name);
  }
  await SCREENS[name].render(SCREENS[name].el, db);
}

document.getElementById("tabs").addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-screen]");
  if (!btn) return;
  showScreen(btn.dataset.screen);
});

async function main() {
  db = await openDb();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
  await showScreen("log");
}

main();
