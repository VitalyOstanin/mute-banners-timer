// SPDX-License-Identifier: GPL-2.0-or-later

import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import { PRESETS, presetLabel } from "./muteController.js";

// On-banner duration dropdown + Mute button, added to the banner's _mediaControls
// row. The preset menu is a floating PopupMenu (in Main.uiGroup, not a banner
// child, so it never changes the banner height). Design notes: ADR 0009.
export class BannerControl {
  constructor(banner, notification, controller, settings) {
    this._banner = banner;
    this._notification = notification ?? null;
    this._controller = controller;
    this._settings = settings ?? null;
    this._menu = null;
    this._menuManager = null;
    this._destroyId = 0;

    const row = banner?._mediaControls;
    if (!row || typeof row.add_child !== "function") return;

    this._dropdown = new St.Button({
      style_class: "message-media-control mbt-duration",
      label: presetLabel(this._currentMinutes()),
      can_focus: true,
    });
    row.add_child(this._dropdown);

    this._menu = new PopupMenu.PopupMenu(this._dropdown, 0.5, St.Side.TOP);
    Main.uiGroup.add_child(this._menu.actor);
    this._menu.actor.hide();
    this._menuManager = new PopupMenu.PopupMenuManager(this._dropdown);
    this._menuManager.addMenu(this._menu);

    for (const min of PRESETS) {
      const item = new PopupMenu.PopupMenuItem(presetLabel(min));
      item.connect("activate", () => {
        // Only persist and reflect the choice; do not start the mute.
        this._settings?.set_int("last-duration", min);
        this._dropdown.label = presetLabel(min);
      });
      this._menu.addMenuItem(item);
    }
    this._dropdown.connect("clicked", () => this._menu.toggle());

    this._muteButton = new St.Button({
      style_class: "message-media-control mbt-mute",
      label: "Mute",
      can_focus: true,
    });
    row.add_child(this._muteButton);
    this._muteButton.connect("clicked", () => {
      this._menu?.close();
      // Detaching the banner destroys it, which fires our destroy() below.
      this._controller.engage(this._currentMinutes(), this._notification);
    });

    this._destroyId = banner.connect("destroy", () => this.destroy());
  }

  _currentMinutes() {
    const v = this._settings?.get_int("last-duration");
    return PRESETS.includes(v) ? v : PRESETS[0];
  }

  destroy() {
    if (this._destroyId && this._banner) {
      this._banner.disconnect(this._destroyId);
      this._destroyId = 0;
    }
    // Lives in Main.uiGroup, not under the banner, so destroy it explicitly.
    this._menu?.destroy();
    this._menu = null;
    this._menuManager = null;
    this._dropdown = null;
    this._muteButton = null;
    this._banner = null;
    this._notification = null;
  }
}
