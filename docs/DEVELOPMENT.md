# Development

Needs Node.js 24.

```
npm install
npm test          # builds both plugins, then runs the shared and per-aircraft tests
npm run check     # type check, with each aircraft's data
npm run pack      # writes dist/dcs2streamdeck-<aircraft>-<version>.streamDeckPlugin for each aircraft
```

## Layout

- `aircraft/<id>/aircraft.ts`: everything specific to one aircraft (names, plugin and app
  IDs, mirror port, light pairs, position names, light colours, combined indicators, dial
  presets). `aircraft/<id>/test/` holds its tests and a DCS-BIOS control fixture.
- `core/`: DCS-BIOS link, control list, key and dial logic, key pictures. Shared.
- `plugin/`: the Stream Deck plugin. `plugin/build.mjs` builds one plugin per aircraft into
  `dist/<uuid>.sdPlugin`, filling in names, IDs and the mirror port. For live work, link a
  built folder once: `streamdeck link dist/com.adamchesters.dcs2streamdeck.sdPlugin`.
- `app/`: the standalone desktop app (see below).

The build picks the aircraft data through the `#aircraft` import in `package.json`
(Node, esbuild and Vite import condition; F/A-18C by default).

To add an aircraft: copy an `aircraft/<id>` folder, give it a new id, module, names,
uuid, appId and mirror port, add it to `#aircraft` and the `check` script in
`package.json`, and replace the data and tests.

## Testing without DCS

- `node tools/fake-dcs.ts --json <path>/FA-18C_hornet.json --magnetic APU_CONTROL_SW:10`
  pretends to be DCS with DCS-BIOS. It applies the commands it receives and drops
  the APU switch after 10 seconds, like the jet. For the F-16C:
  `node --conditions=f16c tools/fake-dcs.ts --json <path>/F-16C_50.json --magnetic HDPT_SW_L:10`.
- `node tools/record.ts recordings/session.jsonl` records a real DCS-BIOS stream;
  `node tools/fake-dcs.ts --play recordings/session.jsonl` plays it back.

## Standalone app (`app/`)

An Electron app that drives the Stream Deck directly (no Elgato app) and has a
deck-only window for OpenKneeboard window capture. One build per aircraft; set
`AIRCRAFT=f16c` for the F-16C (default F/A-18C). Not released yet.

```
cd app
npm install
npm test
npm run build
```

Windows installers are built on Windows with `npm run dist`.
