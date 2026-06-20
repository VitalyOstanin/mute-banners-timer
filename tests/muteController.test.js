// SPDX-License-Identifier: GPL-2.0-or-later
//
// Unit tests for MuteController. Run: gjs -m tests/muteController.test.js
// A real GLib timer does not fire without a main loop, so every engage is
// followed by showNow()/uninstall() to remove the source.

import { MuteController, PRESETS } from "../lib/muteController.js";

let failures = 0;
let total = 0;

function check(name, cond, extra) {
  total++;
  const mark = cond ? "OK" : "FAIL";
  if (!cond) failures++;
  print(`[${mark}] ${name}${extra !== undefined ? "  -> " + extra : ""}`);
}

// A separate class per tray -> a separate prototype, so the guard defined on
// constructor.prototype does not leak between tests.
function makeTray(initialBlocked = false) {
  class FakeTray {
    _updateState() {
      this.updateCalls++;
    }
  }
  const t = new FakeTray();
  t._bannerBlocked = initialBlocked;
  t.updateCalls = 0;
  return t;
}

// --- preset set ----------------------------------------------------------

{
  check(
    "presets: [1,2,3,5,10,15,20,30,60]",
    JSON.stringify(PRESETS) === "[1,2,3,5,10,15,20,30,60]",
    JSON.stringify(PRESETS),
  );
}

// --- install and uninstall the guard -------------------------------------

{
  const tray = makeTray(false);
  const proto = tray.constructor.prototype;
  check("install: no bannerBlocked accessor before install", !("bannerBlocked" in proto));

  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);
  const desc = Object.getOwnPropertyDescriptor(proto, "bannerBlocked");
  check("install: bannerBlocked accessor defined", !!desc && typeof desc.set === "function");
  check("install: shadow fields seeded", tray._muteBannersActive === false && tray._realBannerBlocked === false);

  c.uninstall();
  check("uninstall: accessor removed (none originally)", !("bannerBlocked" in proto));
  check("uninstall: shadow fields cleared", !("_muteBannersActive" in tray) && !("_realBannerBlocked" in tray));
}

// --- guard: external write outside a mute behaves normally ----------------

{
  const tray = makeTray(false);
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);

  tray.bannerBlocked = true; // panel opened the shade
  check("guard idle: writing true sets _bannerBlocked", tray._bannerBlocked === true);
  check("guard idle: _updateState called", tray.updateCalls === 1, "calls=" + tray.updateCalls);

  tray.bannerBlocked = true; // same value -> early return
  check("guard idle: same value does not re-run _updateState", tray.updateCalls === 1, "calls=" + tray.updateCalls);

  tray.bannerBlocked = false; // panel closed the shade
  check("guard idle: writing false clears the block", tray._bannerBlocked === false);

  c.uninstall();
}

// --- engage blocks, showNow clears and updates ---------------------------

{
  let changes = 0;
  const tray = makeTray(false);
  const c = new MuteController(tray, () => {
    changes++;
  });
  c.install(tray.constructor.prototype);

  check("engage: inactive before", c.isActive() === false);
  c.engage(5);
  check("engage: active", c.isActive() === true);
  check("engage: _muteBannersActive=true", tray._muteBannersActive === true);
  check("engage: _bannerBlocked=true", tray._bannerBlocked === true);
  check("engage: onChange called", changes === 1, "changes=" + changes);

  const callsAfterEngage = tray.updateCalls;
  c.showNow();
  check("showNow: inactive", c.isActive() === false);
  check("showNow: _muteBannersActive=false", tray._muteBannersActive === false);
  check("showNow: _bannerBlocked reset to the real value", tray._bannerBlocked === false);
  check("showNow: _updateState called again (burst)", tray.updateCalls === callsAfterEngage + 1, "calls=" + tray.updateCalls);
  check("showNow: onChange called again", changes === 2, "changes=" + changes);

  c.uninstall();
}

// --- guard during a mute: the panel does not lift the block ---------------

{
  const tray = makeTray(false);
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);

  c.engage(10);
  check("mute+panel: block is set", tray._bannerBlocked === true);

  tray.bannerBlocked = false; // panel closed the shade during the mute
  check("mute+panel: block NOT lifted by writing false", tray._bannerBlocked === true);
  check("mute+panel: real value remembered as false", tray._realBannerBlocked === false);

  c.showNow();
  check("mute+panel: after showNow the block falls to the real value (false)", tray._bannerBlocked === false);

  // and the panel keeps working normally afterwards
  tray.bannerBlocked = true;
  check("after: panel can set the block again", tray._bannerBlocked === true);
  tray.bannerBlocked = false;
  check("after: and clear it", tray._bannerBlocked === false);

  c.uninstall();
}

// --- guard during a mute on top of a real true ----------------------------

{
  // The shade was open when the mute engaged: the real value is true.
  const tray = makeTray(true);
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);
  check("real-true: install remembered real true", tray._realBannerBlocked === true);

  c.engage(3);
  check("real-true: block is set", tray._bannerBlocked === true);
  c.showNow();
  // mute is off, but the panel's real block remains
  check("real-true: after showNow the real block true remains", tray._bannerBlocked === true);

  c.uninstall();
  check("real-true: uninstall restored _bannerBlocked to the real true", tray._bannerBlocked === true);
}

// --- remainingSeconds ----------------------------------------------------

{
  const tray = makeTray(false);
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);

  check("remaining: 0 outside a mute", c.remainingSeconds() === 0);
  c.engage(2); // 120 seconds
  const r = c.remainingSeconds();
  check("remaining: ~120 s after engage(2)", r > 117 && r <= 120, "r=" + r);
  c.showNow();
  check("remaining: 0 again after showNow", c.remainingSeconds() === 0);

  c.uninstall();
}

// --- re-engage replaces the timer ----------------------------------------

{
  const tray = makeTray(false);
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);

  c.engage(1);
  check("re-engage: active after the first", c.isActive() === true);
  c.engage(30); // restart with a new duration
  check("re-engage: still active", c.isActive() === true);
  const r = c.remainingSeconds();
  check("re-engage: remaining recomputed for 30 min", r > 1797 && r <= 1800, "r=" + r);

  c.showNow();
  c.uninstall();
}

// --- requeue the triggering banner on engage(minutes, notification) -------

// A fake banner widget that records its own teardown.
function makeBanner() {
  return { destroyed: false, destroy() { this.destroyed = true; } };
}

{
  // The triggering notification is the one currently shown.
  const tray = makeTray(false);
  tray._notificationQueue = [];
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);

  const n = { acknowledged: true, urgency: 0 };
  tray._notification = n;
  tray._banner = makeBanner();
  const banner = tray._banner;
  tray._bannerBin = { remove_all_transitions() {} };
  tray._notificationState = 2; // SHOWN
  let hidden = false;
  tray.hide = () => { hidden = true; };

  c.engage(5, n);
  check("requeue/current: notification queued", tray._notificationQueue.includes(n));
  check("requeue/current: acknowledged cleared", n.acknowledged === false);
  check("requeue/current: _notification detached", tray._notification === null);
  check("requeue/current: state reset to HIDDEN(0)", tray._notificationState === 0);
  check("requeue/current: banner widget destroyed", banner.destroyed === true);
  check("requeue/current: _banner nulled", tray._banner === null);
  check("requeue/current: tray.hide() called", hidden === true);

  c.showNow();
  c.uninstall();
}

{
  // The triggering notification is NOT the current one: only re-queue it,
  // leave the shown banner alone.
  const tray = makeTray(false);
  tray._notificationQueue = [];
  const other = { acknowledged: true, urgency: 0 };
  tray._notification = other;
  tray._banner = makeBanner();
  const banner = tray._banner;
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);

  const n = { acknowledged: true, urgency: 0 };
  c.engage(5, n);
  check("requeue/other: notification queued", tray._notificationQueue.includes(n));
  check("requeue/other: acknowledged cleared", n.acknowledged === false);
  check("requeue/other: current banner left intact", banner.destroyed === false && tray._notification === other);

  c.showNow();
  c.uninstall();
}

{
  // No duplicate push if the notification is already in the queue.
  const tray = makeTray(false);
  const n = { acknowledged: false, urgency: 0 };
  tray._notificationQueue = [n];
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);

  c.engage(5, n);
  const count = tray._notificationQueue.filter((x) => x === n).length;
  check("requeue/dup: not pushed twice", count === 1, "count=" + count);

  c.showNow();
  c.uninstall();
}

{
  // CRITICAL sorts ahead of normal in the queue.
  const tray = makeTray(false);
  const normal = { acknowledged: false, urgency: 0 };
  tray._notificationQueue = [normal];
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);

  const critical = { acknowledged: true, urgency: 2 };
  c.engage(5, critical);
  check("requeue/sort: critical first", tray._notificationQueue[0] === critical);

  c.showNow();
  c.uninstall();
}

{
  // Without a triggering notification the queue is untouched.
  const tray = makeTray(false);
  tray._notificationQueue = [];
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);

  c.engage(5);
  check("requeue/none: queue stays empty", tray._notificationQueue.length === 0);

  c.showNow();
  c.uninstall();
}

// --- uninstall during an active mute -------------------------------------

{
  const tray = makeTray(false);
  const c = new MuteController(tray, () => {});
  c.install(tray.constructor.prototype);

  c.engage(15);
  check("uninstall-active: active", c.isActive() === true);
  c.uninstall();
  check("uninstall-active: inactive (timer removed)", c.isActive() === false);
  check("uninstall-active: accessor removed", !("bannerBlocked" in tray.constructor.prototype));
  check("uninstall-active: shadow fields cleared", !("_muteBannersActive" in tray));
}

// --- summary -------------------------------------------------------------

print(`\n${total - failures}/${total} passed`);
print(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
if (failures > 0) imports.system.exit(1);
