# Development

Needs Node.js 24.

```
npm install
npm test          # builds the plugin, then runs unit and end-to-end tests
npm run pack      # writes dist/com.adamchesters.dcs2streamdeck.streamDeckPlugin
```

All aircraft-specific data (light pairs, position names, light colours, combined
indicators, dial presets) is in `src/core/aircraft.data.ts`. Everything else is
shared code.

## Testing without DCS

- `node tools/fake-dcs.ts --json <path>/FA-18C_hornet.json --magnetic APU_CONTROL_SW:10`
  pretends to be DCS with DCS-BIOS. It applies the commands it receives and drops
  the APU switch after 10 seconds, like the jet.
- `node tools/record.ts recordings/session.jsonl` records a real DCS-BIOS stream;
  `node tools/fake-dcs.ts --play recordings/session.jsonl` plays it back.

## Standalone app (`app/`)

An Electron app that drives the Stream Deck directly (no Elgato app) and has a
deck-only window for OpenKneeboard window capture. Not released yet.

```
cd app
npm install
npm test
npm run build
```

Windows installers are built on Windows with `npm run dist`.
