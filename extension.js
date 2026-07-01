// SPDX-License-Identifier: GPL-2.0-or-later

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as MessageTray from "resource:///org/gnome/shell/ui/messageTray.js";
import {
  Extension,
  InjectionManager,
} from "resource:///org/gnome/shell/extensions/extension.js";

import { MuteController } from "./lib/muteController.js";
import { MuteIndicator } from "./lib/indicator.js";
import { BannerControl } from "./lib/bannerControl.js";

const INDICATOR_ROLE = "mute-banners-timer";

export default class MuteBannersTimerExtension extends Extension {
  enable() {
    const tray = Main.messageTray;
    const proto = MessageTray.MessageTray.prototype;

    this._controller = new MuteController(tray, () => this._indicator?.sync());
    this._controller.install(proto);

    this._indicator = new MuteIndicator(this._controller);
    Main.panel.addToStatusArea(INDICATOR_ROLE, this._indicator);

    this._bannerControl = null;

    // Add the on-banner controls after each banner is shown. Only one banner shows
    // at a time, so a single live BannerControl is enough.
    this._injectionManager = new InjectionManager();
    const self = this;
    this._injectionManager.overrideMethod(
      proto,
      "_showNotification",
      (original) =>
        function (...args) {
          // finally: a co-installed extension may also wrap _showNotification
          // and throw in its post-show hook after the banner is built. Still
          // attach our control; its error keeps propagating to be logged.
          try {
            original.apply(this, args);
          } finally {
            self._addBannerControl(this._banner, this._notification);
          }
        },
    );
  }

  _addBannerControl(banner, notification) {
    if (!banner) return;
    if (banner._muteBannersControlAdded) return;
    banner._muteBannersControlAdded = true;

    this._bannerControl?.destroy();
    this._bannerControl = new BannerControl(
      banner,
      notification ?? banner.notification ?? null,
      this._controller,
    );
  }

  disable() {
    if (this._injectionManager) {
      this._injectionManager.clear();
      this._injectionManager = null;
    }

    this._bannerControl?.destroy();
    this._bannerControl = null;

    this._indicator?.destroy();
    this._indicator = null;

    this._controller?.uninstall();
    this._controller = null;
  }
}
