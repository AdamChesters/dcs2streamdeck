<p align="center">
  <img src="assets/banner.png" alt="dcs2streamdeck: a glass Stream Deck + with live cockpit keys, floating in the cockpit above the clouds" width="746">
</p>

# dcs2streamdeck

by **Adam Chesters**

Stream Deck keys, lights and dials that show what your jet is actually doing in DCS World.

**For the DCS F/A-18C Hornet and F-16C Viper.** Each jet has its own plugin, so the control lists stay short. Install the ones you fly; they work side by side.

## Why

The DCS Stream Deck projects I tried had gone quiet. Some no longer worked with current DCS, and none kept the deck in step with the cockpit: when the jet moved a switch by itself, like a magnetically held APU or JFS switch, the key kept showing the wrong thing. dcs2streamdeck reads the live cockpit through DCS-BIOS, so the deck always matches the jet.

## Examples

<p align="center">
  <img src="assets/examples.png" alt="Example keys. F/A-18C: APU, Master Caution, L BAR, flaps. F-16C: Master Arm, TO/LDG CONFIG, AOA indexer, gear" width="976">
</p>

- **DCS Switch**: any switch, button or lever. Shows its real position (ARM/SAFE, START 1/OFF/START 2) and can light up from its own cockpit light.
- **DCS Light**: caution and warning lights in their cockpit colours, plus combined indicators: AOA indexer and landing gear, and on the Hornet also flaps and L BAR.
- **DCS Dial** (Stream Deck +): turn to set brightness and volume knobs; press to step through a list. Presets for each jet's displays and cockpit lighting.
- **VR**: a live copy of the deck for an OpenKneeboard Web Dashboard tab, at `http://127.0.0.1:31730/` (F/A-18C) or `http://127.0.0.1:31731/` (F-16C).

## Install

1. Install [DCS-BIOS](https://github.com/DCS-Skunkworks/dcs-bios/releases) v0.11 or later.
2. Use the Stream Deck app 7.1 or later.
3. Download the `.streamDeckPlugin` for your jet from [Releases](https://github.com/AdamChesters/dcs2streamdeck/releases) (`dcs2streamdeck-fa18c-…` or `dcs2streamdeck-f16c-…`) and double-click it.

One repo for every jet: a folder per jet in `aircraft/`, shared code in `core/`, the Stream Deck plugin in `plugin/` and a standalone desktop app (not released yet) in `app/`. Building from source: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Credits

- [DCS-BIOS](https://github.com/DCS-Skunkworks/dcs-bios) by DCS-Skunkworks: the cockpit data and controls everything runs on.
- [Stream Deck SDK](https://github.com/elgatosf/streamdeck) by Elgato.
- [OpenKneeboard](https://openkneeboard.com) by Fred Emmott, for putting the deck in your headset.
- [node-elgato-stream-deck](https://github.com/julusian/node-elgato-stream-deck) by Julian Waller, [Electron](https://www.electronjs.org), [React](https://react.dev), [Lucide](https://lucide.dev), [ws](https://github.com/websockets/ws) and [Zod](https://zod.dev).

Licence notices: [LICENSES.md](LICENSES.md). dcs2streamdeck is licensed under the [GPL-3.0](LICENSE).

## Feedback and donations

I love making things. Anything I've ever built has been to have fun, share fun, and make life a bit easier. If you got value from one of these things, and you'd like to chuck us a coffee, a bottle, or a god damned Ferrari, go your hardest. Then hustle over to discord to claim your supporter role!

[GitHub Sponsors](https://github.com/sponsors/AdamChesters) | [Buy Me a Coffee](https://buymeacoffee.com/adamch) | [Donate with PayPal](https://www.paypal.com/donate/?business=KLHSZPXTSVSAU&no_recurring=0&item_name=I%27ve+donated+to+lots+of+small+creators+for+their+useful+little+tools%2C+now+I+create+them.+Dig+one?+I%27d+love+your+support.&currency_code=AUD)

[Join the Discord](https://discord.gg/fs4WyaQPA)
