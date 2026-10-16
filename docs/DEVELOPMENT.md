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
  position names, light colours, combined indicators, dial presets).
  `aircraft/<id>/test/` holds its tests and a DCS-BIOS control fixture.
- `core/`: DCS-BIOS link, every aircraft's control list, key and dial logic, key pictures,
  update check. Shared. `core/aircraft.data.ts` lists the aircraft and holds the plugin and
  app IDs and the mirror port.
- `plugin/`: the Stream Deck plugin (one for all aircraft). `plugin/build.mjs` builds it into
  `dist/<uuid>.sdPlugin`, filling in IDs and the mirror port. For live work, link the
  built folder once: `streamdeck link dist/com.adamchesters.dcs2streamdeck.sdPlugin`.
- `app/`: the standalone desktop app (see below).

Each key and dial saves its aircraft (`aircraft` setting). Keys without one were made with
the F/A-18C plugin before 0.4.0 and stay F/A-18C keys; a new key starts on the jet DCS is
flying. Keys of another jet stay dark and show its name.

To add an aircraft: copy an `aircraft/<id>` folder, give it a new id, module and names,
add it to `AIRCRAFT_LIST` in `core/aircraft.data.ts`, and replace the data and tests.

## Testing without DCS

- `node tools/fake-dcs.ts --json <path>/FA-18C_hornet.json --magnetic APU_CONTROL_SW:10`
  pretends to be DCS with DCS-BIOS. It applies the commands it receives and drops
  the APU switch after 10 seconds, like the jet. For the F-16C:
  `node tools/fake-dcs.ts --aircraft F-16C_50 --json <path>/F-16C_50.json --magnetic HDPT_SW_L:10`.
- `node tools/record.ts recordings/session.jsonl` records a real DCS-BIOS stream;
  `node tools/fake-dcs.ts --play recordings/session.jsonl` plays it back.
- `D2S_RELEASES_API=<url>` points the plugin's update check at another releases list.

## Standalone app (`app/`)

An Electron app that drives the Stream Deck directly (no Elgato app) and has a
deck-only window for OpenKneeboard window capture. One app for all aircraft.

```
cd app
npm install
npm test
npm run build
```

The portable Windows zip (`app/release/dcs2streamdeck-<version>-win.zip`) is built on Windows with `npm run dist`. The app version must match the plugin version in the root `package.json`.
