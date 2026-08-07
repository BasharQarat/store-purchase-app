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

function setActiveTabButton(name) {
  document.querySelectorAll("#tabs button[data-screen]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.screen === name);
  });
}

async function showScreen(name) {
  for (const [key, screen] of Object.entries(SCREENS)) {
    screen.el.classList.toggle("active", key === name);
  }
  setActiveTabButton(name);
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
