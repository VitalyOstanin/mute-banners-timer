// SPDX-License-Identifier: GPL-2.0-or-later

import GObject from "gi://GObject";
import GLib from "gi://GLib";
import St from "gi://St";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as BoxPointer from "resource:///org/gnome/shell/ui/boxpointer.js";

import { PRESETS, SECONDS_PER_MINUTE, presetLabel } from "./muteController.js";

// Always a bell; only the colour changes (red when muted, green when idle).
const ICON_BELL = "preferences-system-notifications-symbolic";
const STYLE_IDLE = "system-status-icon mbt-icon-idle";
const STYLE_MUTED = "system-status-icon mbt-icon-muted";

export const MuteIndicator = GObject.registerClass(
  class MuteIndicator extends PanelMenu.Button {
    _init(controller) {
      super._init(0.5, "Mute Banners Timer");
      this._controller = controller;
      this._tickId = 0;
      this._remainingItem = null;

      this._icon = new St.Icon({
        icon_name: ICON_BELL,
        style_class: STYLE_IDLE,
      });
      this.add_child(this._icon);

      this.sync();
    }

    sync() {
      const active = this._controller.isActive();
      this._icon.style_class = active ? STYLE_MUTED : STYLE_IDLE;
      this._buildMenu(active);
      if (active) this._startTick();
      else this._stopTick();
    }

    _buildMenu(active) {
      this.menu.removeAll();
      this._remainingItem = null;

      if (active) {
        this._remainingItem = new PopupMenu.PopupMenuItem("", {
          reactive: false,
        });
        this.menu.addMenuItem(this._remainingItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const showNow = new PopupMenu.PopupMenuItem("Unmute now");
        showNow.connect("activate", () => {
          // sync() rebuilds the menu, which destroys the item mid-emission and
          // strips the AFTER auto-close handler; close explicitly first.
          this.menu.close(BoxPointer.PopupAnimation.FULL);
          this._controller.showNow();
        });
        this.menu.addMenuItem(showNow);

        this._updateRemaining();
      } else {
        const header = new PopupMenu.PopupMenuItem("Mute all banners for…", {
          reactive: false,
        });
        this.menu.addMenuItem(header);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        for (const min of PRESETS) {
          const item = new PopupMenu.PopupMenuItem(presetLabel(min));
          item.connect("activate", () => {
            // See "Unmute now": close before engage() rebuilds the menu.
            this.menu.close(BoxPointer.PopupAnimation.FULL);
            this._controller.engage(min);
          });
          this.menu.addMenuItem(item);
        }
      }
    }

    _formatRemaining(sec) {
      const m = Math.floor(sec / SECONDS_PER_MINUTE);
      const s = sec % SECONDS_PER_MINUTE;
      return `${m}:${s.toString().padStart(2, "0")}`;
    }

    _updateRemaining() {
      if (!this._remainingItem || !this._controller.isActive()) return;
      this._remainingItem.label.text = `Muted — ${this._formatRemaining(
        this._controller.remainingSeconds(),
      )} left`;
    }

    _startTick() {
      if (this._tickId) return;
      this._tickId = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        1,
        () => {
          if (!this._controller.isActive()) {
            this._tickId = 0;
            return GLib.SOURCE_REMOVE;
          }
          this._updateRemaining();
          return GLib.SOURCE_CONTINUE;
        },
      );
      GLib.Source.set_name_by_id(this._tickId, "[mute-banners-timer] tick");
    }

    _stopTick() {
      if (this._tickId) {
        GLib.source_remove(this._tickId);
        this._tickId = 0;
      }
    }

    destroy() {
      this._stopTick();
      super.destroy();
    }
  },
);
