// SPDX-License-Identifier: GPL-2.0-or-later

import GObject from "gi://GObject";
import GLib from "gi://GLib";
import St from "gi://St";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import { PRESETS } from "./muteController.js";

const ICON_IDLE = "preferences-system-notifications-symbolic";
const ICON_ACTIVE = "notifications-disabled-symbolic";

export const MuteIndicator = GObject.registerClass(
  class MuteIndicator extends PanelMenu.Button {
    _init(controller, settings) {
      super._init(0.5, "Mute Banners Timer");
      this._controller = controller;
      this._settings = settings ?? null;
      this._tickId = 0;
      this._remainingItem = null;

      this._icon = new St.Icon({
        icon_name: ICON_IDLE,
        style_class: "system-status-icon",
      });
      this.add_child(this._icon);

      this.sync();
    }

    sync() {
      const active = this._controller.isActive();
      this._icon.icon_name = active ? ICON_ACTIVE : ICON_IDLE;
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

        const showNow = new PopupMenu.PopupMenuItem("Show now");
        showNow.connect("activate", () => this._controller.showNow());
        this.menu.addMenuItem(showNow);

        this._updateRemaining();
      } else {
        const header = new PopupMenu.PopupMenuItem("Mute all banners for…", {
          reactive: false,
        });
        this.menu.addMenuItem(header);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        for (const min of PRESETS) {
          const item = new PopupMenu.PopupMenuItem(this._presetLabel(min));
          item.connect("activate", () => {
            this._settings?.set_int("last-duration", min);
            this._controller.engage(min);
          });
          this.menu.addMenuItem(item);
        }
      }
    }

    _presetLabel(min) {
      return min < 60 ? `${min} min` : "1 hour";
    }

    _formatRemaining(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
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
