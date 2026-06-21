// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from "gi://GLib";

export const PRESETS = [1, 2, 3, 5, 10, 15, 20, 30, 60];

export const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const US_PER_SECOND = 1e6;

// Format a preset duration (in minutes) as a short human label.
export function presetLabel(minutes) {
  return minutes < MINUTES_PER_HOUR ? `${minutes} min` : "1 hour";
}

// MessageTray.State.HIDDEN; inlined to keep this module import-pure for gjs tests.
const STATE_HIDDEN = 0;

export class MuteController {
  constructor(tray, onChange) {
    this._tray = tray;
    this._onChange = onChange ?? (() => {});
    this._timerId = 0;
    this._endTimeUs = 0; // monotonic end time, microseconds
    this._guardProto = null;
    this._originalDesc = null;
  }

  // Guard the bannerBlocked setter so panel.js writes can't lift the mute.
  install(proto) {
    const tray = this._tray;
    tray._muteBannersActive = false;
    tray._realBannerBlocked = tray._bannerBlocked;

    this._guardProto = proto;
    this._originalDesc =
      Object.getOwnPropertyDescriptor(proto, "bannerBlocked") ?? null;

    Object.defineProperty(proto, "bannerBlocked", {
      configurable: true,
      get() {
        return this._bannerBlocked;
      },
      set(v) {
        this._realBannerBlocked = v;
        const effective = this._muteBannersActive || v;
        if (this._bannerBlocked === effective) return;
        this._bannerBlocked = effective;
        this._updateState();
      },
    });
  }

  uninstall() {
    if (this._timerId) {
      GLib.source_remove(this._timerId);
      this._timerId = 0;
    }
    const tray = this._tray;
    tray._muteBannersActive = false;

    if (this._guardProto) {
      if (this._originalDesc) {
        Object.defineProperty(this._guardProto, "bannerBlocked", this._originalDesc);
      } else {
        delete this._guardProto.bannerBlocked;
      }
      this._guardProto = null;
      this._originalDesc = null;
    }

    const real = tray._realBannerBlocked;
    if (tray._bannerBlocked !== real) {
      tray._bannerBlocked = real;
      tray._updateState();
    }
    delete tray._muteBannersActive;
    delete tray._realBannerBlocked;
  }

  isActive() {
    return this._timerId !== 0;
  }

  remainingSeconds() {
    if (!this.isActive()) return 0;
    const now = GLib.get_monotonic_time();
    return Math.max(0, Math.ceil((this._endTimeUs - now) / US_PER_SECOND));
  }

  engage(minutes, triggeringNotification = null) {
    const tray = this._tray;

    if (this._timerId) {
      GLib.source_remove(this._timerId);
      this._timerId = 0;
    }

    this._endTimeUs =
      GLib.get_monotonic_time() + minutes * SECONDS_PER_MINUTE * US_PER_SECOND;

    tray._muteBannersActive = true;
    this._recompute();

    // Detach only after the block is active (any _updateState then early-returns).
    if (triggeringNotification)
      this._requeueTriggeringBanner(triggeringNotification);

    this._timerId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      minutes * SECONDS_PER_MINUTE,
      () => {
        this._timerId = 0;
        this._release();
        return GLib.SOURCE_REMOVE;
      },
    );
    GLib.Source.set_name_by_id(this._timerId, "[mute-banners-timer] expiry");

    this._onChange();
  }

  // End mute now and flush the accumulated queue.
  showNow() {
    if (!this.isActive()) return;
    GLib.source_remove(this._timerId);
    this._timerId = 0;
    this._release();
  }

  _release() {
    this._tray._muteBannersActive = false;
    this._recompute();
    this._onChange();
  }

  _recompute() {
    const tray = this._tray;
    const effective = tray._muteBannersActive || tray._realBannerBlocked;
    if (tray._bannerBlocked === effective) return;
    tray._bannerBlocked = effective;
    tray._updateState();
  }

  // Move the triggering banner's notification back into the queue so it rejoins
  // the release burst instead of being lost. Rationale and version notes: ADR 0010.
  _requeueTriggeringBanner(triggeringNotification) {
    const tray = this._tray;
    if (!triggeringNotification) return;

    if (tray._notification === triggeringNotification) {
      // Tear down the shown banner like _hideNotificationCompleted, but keep `n`.
      if (tray._notificationTimeoutId) {
        GLib.source_remove(tray._notificationTimeoutId);
        tray._notificationTimeoutId = 0;
      }
      tray._resetNotificationLeftTimeout();
      tray._notificationFocusGrabber.ungrabFocus();
      if (tray._banner) {
        tray._bannerBin.remove_all_transitions();
        tray._banner.destroy();
        tray._banner = null;
      }
      tray._notification = null;
      tray._notificationState = STATE_HIDDEN;
      tray._notificationRemoved = false;
      tray._pointerInNotification = false;
      tray.hide();
    }

    // Clearing acknowledged keeps it out of the queue filter; push explicitly
    // (GNOME 45 has no reshow hook), guarding against a 46+ auto-push duplicate.
    triggeringNotification.acknowledged = false;
    if (!tray._notificationQueue.includes(triggeringNotification)) {
      tray._notificationQueue.push(triggeringNotification);
      tray._notificationQueue.sort((a, b) => b.urgency - a.urgency);
    }
  }
}
