<p align="center">
  <img src="assets/banner.png" alt="dcs2streamdeck alpha version: an F/A-18C and an F-16C at sunset, a Stream Deck + with live cockpit keys, and the glass deck panel in VR" width="1280">
</p>

# dcs2streamdeck

> [!CAUTION]
> ## ALPHA VERSION: TESTERS WANTED
> **Find a bug? Got a feature idea (e.g. the 3 gear lights combined into one custom button)? Drop us a line, details below.**
> **Alpha : Not every function exhaustively tested yet. Help me!**
> **Taking next module suggestions : The plugin and the standalone app will notify you as they drop**

## What

Sync Stream Deck keys, lights and dials to what your jet is actually doing in DCS World. Live updating. 

Two ways to run this. Both cover every supported jet: each key picks its jet, and new keys start on the jet DCS is flying.
- **Stream Deck plugin: Fully integrated.** Installs into Elgato's Stream Deck app, with your other plugins, profiles and pages.
- **Standalone Desktop app: Lightweight** Standalone app, cannot be run with Elgato's software. Drives your deck directly. Includes popout window for OpenKneeboard VR capture.
- **There are dependencies** See the How section. You need DCS-Bios installed. 

## Why

The DCS Streamdeck projects I tried had gone quiet. Most no longer worked with the hornet, and none kept the deck in step with the cockpit: when the jet moved a switch by itself, like a magnetically held APU or JFS switch, the key kept showing the wrong thing. dcs2streamdeck reads the live cockpit through DCS-BIOS, so the deck always matches the jet. Then we applied common sense : You don't need 3 keys to show 3 gear lights, and that can double up as gear up/down toggle. Etc etc. Taking ideas! 

## Examples

<p align="center">
  <img src="assets/examples.png" alt="Example keys. F/A-18C: APU, Master Caution, L BAR, flaps. F-16C: Master Arm, TO/LDG CONFIG, AOA indexer, gear" width="976">
</p>

- **DCS Switches**: any switch, button or lever. Shows its real position (ARM/SAFE, START 1/OFF/START 2) and can light up from its own cockpit light.
- **DCS Caution/status Lights**: caution and warning lights in their cockpit colours, plus combined indicators: AOA indexer and landing gear, and on the Hornet also flaps and L BAR.
- **DCS Dials** (Stream Deck +): turn to set brightness and volume knobs; press to step through a list. Presets for each jet's displays and cockpit lighting.
- **VR**: a live copy of the deck for an OpenKneeboard Web Dashboard tab, at `http://127.0.0.1:31730/`. See your streamdeck mirrored in VR. Finally. 

## Option 1 : Install the plugin

1. Install [DCS-BIOS](https://github.com/DCS-Skunkworks/dcs-bios/releases) v0.11 or later.
2. Use the Stream Deck app 7.1 or later.
3. Download `dcs2streamdeck-<version>.streamDeckPlugin` from [Releases](https://github.com/AdamChesters/dcs2streamdeck/releases) and double-click it.
4. Had the separate F-16C plugin (0.3 or older)? Remove it in the Stream Deck app and set its keys up again in the new one. F/A-18C keys carry over.

## Option 2 : Use the desktop app (Windows)

1. Install [DCS-BIOS](https://github.com/DCS-Skunkworks/dcs-bios/releases) v0.11 or later.
2. Download `dcs2streamdeck-<version>-win.zip` from [Releases](https://github.com/AdamChesters/dcs2streamdeck/releases), unzip it to any folder and run `dcs2streamdeck.exe`. It is not code-signed yet, so Windows may show a warning first.
3. Close the Elgato Stream Deck app: only one program can drive the deck at a time.

## Updating
- **Automatic** - Both Plugin and Standalone app check for updates and will notify you. Plugin: the top row of any key's settings shows your version, green with a tick when up to date, red ("Update available") when a newer one is out; click it for the releases page. App: the version light in the top bar.
- **Manual** - Plugin, download, open. It'll launch the stream deck up, update. All buttons will be saved. Standalone, unzip the new zip over your install folder, run from there. Your keys are saved in your Windows profile, not the app folder. 

## Credits

- [DCS-BIOS](https://github.com/DCS-Skunkworks/dcs-bios) by DCS-Skunkworks: the cockpit data and controls everything runs on.
- [Stream Deck SDK](https://github.com/elgatosf/streamdeck) by Elgato.
- [OpenKneeboard](https://openkneeboard.com) by Fred Emmott, for putting the deck in your headset.
- [node-elgato-stream-deck](https://github.com/julusian/node-elgato-stream-deck) by Julian Waller, [Electron](https://www.electronjs.org), [React](https://react.dev), [Lucide](https://lucide.dev), [ws](https://github.com/websockets/ws) and [Zod](https://zod.dev).

Licence notices: [LICENSES.md](LICENSES.md). dcs2streamdeck is licensed under the [GPL-3.0](LICENSE).

## Feedback and support

Thanks for using dcs2streamdeck. I like to fix bugs and implement features rapidly. Issue? Idea? Let's work on it! Contact me anywhere you prefer.

[Discord](https://discord.gg/fs4WyaQPA) | [Reddit](https://www.reddit.com/r/AdamChsLab/) | [GitHub](https://github.com/AdamChesters) | [LinkedIn](https://www.linkedin.com/in/adamchesters/) | [AdamCh.com](https://adamch.com)

### Support

I love making things to have fun, share fun, and make life a lil better. If you got value out of one of them, feel free to buy us a coffee. Or a house. Push comes to shove, I prefer Aston Martin. Supporters get golden crowns on the Discord / tags on the subreddit!

[GitHub Sponsors](https://github.com/sponsors/AdamChesters) | [Buy Me a Coffee](https://buymeacoffee.com/adamch) | [Support with PayPal](https://www.paypal.com/donate/?business=KLHSZPXTSVSAU&no_recurring=0&item_name=I%27ve+donated+to+lots+of+small+creators+for+their+useful+little+tools%2C+now+I+create+them.+Dig+one?+I%27d+love+your+support.&currency_code=AUD)
