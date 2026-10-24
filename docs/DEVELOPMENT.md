# Development

Needs Node.js 24.

```
npm install
npm test          # builds the plugin, then runs the shared and per-aircraft tests
npm run check     # type check
npm run pack      # writes dist/dcs2streamdeck-<version>.streamDeckPlugin
```

## Layout

- `aircraft/<id>/aircraft.ts`: everything specific to one aircraft (names, light pairs,
  position names, which way each switch points, light colours, combined indicators, dial
  presets). Check position names against DCS's own key bindings: DCS-BIOS often lists
  3-position names top first, which is the reverse of their values.
  `aircraft/<id>/test/` holds its tests and a DCS-BIOS control fixture.
- `core/`: DCS-BIOS link, every aircraft's control list, key and dial logic, key pictures,
  update check. Shared. `core/aircraft.data.ts` lists the aircraft and holds the plugin and
  app IDs and the mirror port.
- `plugin/`: the Stream Deck plugin (one for all aircraft). `plugin/build.mjs` builds it into
  `dist/<uuid>.sdPlugin`, filling in IDs and the mirror port. For live work, link the
  built folder once: `streamdeck link dist/com.adamchesters.dcs2streamdeck.sdPlugin`.
- `app/`: the standalone desktop app (see below).

Each key and dial saves its aircraft (`aircraft` setting). Keys without one were made with
the F/A-18C plugin before 0.4.0 and stay F/A-18C keys; a new key starts on the aircraft DCS is
flying. Keys of another aircraft stay dark and show its name.

Two-seat aircraft (AH-64D) set `SEATS` in their data: a control both seats have (`PLT_KU_ENT`,
`CPG_KU_ENT`) is listed once (`KU_ENT`) and reads and sends as the seat DCS-BIOS says the player
is in (`SEAT_POSITION`). A control only one seat has keeps its identifier. If DCS calls the
aircraft something other than the DCS-BIOS module, `dcsName` says what (`AH-64D_BLK_II`).

What a key press can do ("Press does") comes from the control (`keyModes` in
`core/dcsbios/controls.ts`): a spring-loaded position gets "Hold X" (press goes there, release
springs back), a position that stays gets "Set X", a static switch also gets "Next position"
(one key cycles it) and Step up/down, a knob gets Turn up/down (a short press is a small step;
holding turns faster on a smooth curve), and a rocker with its own push (`CYCLIC_RTS` and
`CYCLIC_RTS_PRESS`) gets "Depress". DCS-BIOS's spring-loaded and rocker switches count as
spring-loaded at both ends; `SPRING_LOADED` in the aircraft data corrects that by value.

To add an aircraft: copy an `aircraft/<id>` folder, give it a new id, module (and `dcsName` if DCS
uses another name) and names,
add it to `AIRCRAFT_LIST` in `core/aircraft.data.ts`, and replace the data and tests. Check every
2- and 3-position switch against DCS's own key bindings (`Input/<module>/joystick/default.lua`):
a bind with the same command and value as DCS-BIOS gives the position's name, and a bind with
a release means that position springs back. Put names that differ in `POSITION_NAMES`, and
switches that latch at one end, or that spring back although DCS-BIOS does not treat them as
spring-loaded, in `SPRING_LOADED`.

## Testing without DCS

- `node tools/fake-dcs.ts --json <path>/FA-18C_hornet.json --magnetic APU_CONTROL_SW:10`
  pretends to be DCS with DCS-BIOS. It applies the commands it receives and drops
  the APU switch after 10 seconds, like the jet. For the F-16C:
  `node tools/fake-dcs.ts --aircraft F-16C_50 --json <path>/F-16C_50.json --magnetic HDPT_SW_L:10`.
  For the AH-64D: `--aircraft AH-64D --json <path>/AH-64D.json`; send it `SEAT_POSITION 1` to
  move to the front seat.
- `node tools/record.ts recordings/session.jsonl` records a real DCS-BIOS stream;
  `node tools/fake-dcs.ts --play recordings/session.jsonl` plays it back.
- `D2S_RELEASES_API=<url>` points the plugin's and the app's update check at another releases
  list; downloads may then come from that server too (otherwise only GitHub release downloads).
- Updates are downloaded with their size and SHA-256 checked against GitHub's. The plugin opens
  the new `.streamDeckPlugin` (the Stream Deck app installs it); the app runs a PowerShell
  helper (`app/main/self-update.ts`) that waits for it to close, unzips the new zip over its
  folder and starts it again, logging to `%APPDATA%\dcs2streamdeck\update.log`.
  `D2S_INSTALL_UPDATE=1` makes the app install an available update at once (Windows tests).

## Standalone app (`app/`)

An Electron app that drives the Stream Deck directly (no Elgato app), serves the
same VR page as the plugin (`core/mirror.ts`, same port) and has a deck-only window.
One app for all aircraft.

```
cd app
npm install
npm test
npm run build
```

The portable Windows zip (`app/release/dcs2streamdeck-<version>-win.zip`) is built on Windows with `npm run dist`. The app version must match the plugin version in the root `package.json`.
