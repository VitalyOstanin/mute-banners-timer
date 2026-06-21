// SPDX-License-Identifier: GPL-2.0-or-later

import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import { PRESETS, presetLabel } from "./muteController.js";

// A single "mute" button placed under the banner text. Clicking it opens a
// floating preset menu; picking a preset starts the mute right away. The menu
// lives in Main.uiGroup (not a banner child), so it never grows the banner.
export class BannerControl {
  constructor(banner, notification, controller) {
    this._banner = banner;
    this._notification = notification ?? null;
    this._controller = controller;
    this._menu = null;
    this._menuManager = null;

    const column = this._bannerColumn(banner);
    if (!column) return;

    this._button = new St.Button({
      style_class: "message-media-control mbt-mute",
      label: "mute",
      can_focus: true,
      x_align: Clutter.ActorAlign.END,
    });
    column.add_child(this._button);

    this._menu = new PopupMenu.PopupMenu(this._button, 0.5, St.Side.TOP);
    Main.uiGroup.add_child(this._menu.actor);
    this._menu.actor.hide();
    this._menuManager = new PopupMenu.PopupMenuManager(this._button);
    this._menuManager.addMenu(this._menu);

    for (const min of PRESETS) {
      const item = new PopupMenu.PopupMenuItem(presetLabel(min));
      item.connect("activate", () => {
        this._menu?.close();
        // Detaching the banner destroys it, which fires our destroy() below.
        this._controller.engage(min, this._notification);
      });
      this._menu.addMenuItem(item);
    }
    this._button.connect("clicked", () => this._menu.toggle());

    // Foreign object: key the handler on `this` so destroy() drops it with one
    // disconnectObject(this), matching the convention in the other extensions.
    banner.connectObject("destroy", () => this.destroy(), this);
  }

  // The Message's top-level vertical box (set_child(vbox) on all versions). It
  // spans the full banner width, so a right-aligned button sits under the whole
  // message rather than only under the text column to the right of the icon.
  _bannerColumn(banner) {
    return banner.get_first_child();
  }

  destroy() {
    this._banner?.disconnectObject(this);
    // The menu lives in Main.uiGroup (not under the banner), so destroy it
    // explicitly; that also drops the preset items' handlers. Destroying the
    // button removes it from the banner and drops its "clicked" handler.
    this._menu?.destroy();
    this._button?.destroy();
    this._menu = null;
    this._menuManager = null;
    this._button = null;
    this._banner = null;
    this._notification = null;
  }
}
