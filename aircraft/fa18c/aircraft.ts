/**
 * Everything specific to the F/A-18C Hornet (DCS-BIOS module "FA-18C_hornet").
 * The rest of the code is the same for every aircraft; core/aircraft.data.ts lists the aircraft.
 */

/** DCS-BIOS module (its JSON file name), names, and the ID saved in each key's settings (never change it). */
export const AIRCRAFT = {
	id: "fa18c",
	module: "FA-18C_hornet",
	name: "F/A-18C",
	fullName: "F/A-18C Hornet",
} as const;

/** Switch → its own light, for pairs the panel/name rule in catalog.ts cannot find. */
export const KNOWN_LAMPS: Record<string, string> = {
	APU_CONTROL_SW: "APU_READY_LT",
	HOOK_LEVER: "ARRESTING_HOOK_LT",
	GEAR_LEVER: "LANDING_GEAR_HANDLE_LT",
	SPIN_RECOVERY_SW: "SPIN_LT",
};

/**
 * 2-position switches whose DCS-BIOS description has no position names,
 * as [name of position 1, name of position 0] like the descriptions ("ARM/SAFE": 1 = ARM).
 */
export const KNOWN_LABELS: Record<string, [string, string]> = {
	LAUNCH_BAR_SW: ["EXTEND", "RETRACT"],
	GEAR_LEVER: ["UP", "DOWN"],
	HOOK_LEVER: ["UP", "DOWN"],
	ANTI_SKID_SW: ["ON", "OFF"],
	LDG_TAXI_SW: ["ON", "OFF"],
	GAIN_SWITCH: ["ORIDE", "NORM"],
	GAIN_SWITCH_COVER: ["OPEN", "CLOSED"],
	LEFT_FIRE_BTN_COVER: ["OPEN", "CLOSED"],
	RIGHT_FIRE_BTN_COVER: ["OPEN", "CLOSED"],
};

/** Push buttons (press = 1, release = 0) that DCS-BIOS does not mark as momentary. */
export const KNOWN_PUSH_BUTTONS: string[] = ["FCS_RESET_BTN", "TO_TRIM_BTN"];

/** Levers drawn with a special knob: the gear handle (wheel) and the hook handle (hook). */
export const LEVER_KNOBS: Record<string, "wheel" | "hook"> = {
	GEAR_LEVER: "wheel",
	HOOK_LEVER: "hook",
};

/** Lights whose DCS-BIOS description gives no colour. */
export const KNOWN_COLOURS: Record<string, "green" | "yellow" | "red" | "white" | "blue"> = {
	ARRESTING_HOOK_LT: "red",
	LANDING_GEAR_HANDLE_LT: "red",
	SAI_ATT_WARN_FLAG_L: "red",
};

/** Multi-light indicators DCS-BIOS lists as separate lights, shown on one key. */
export const INDICATORS: { name: string; kind: "aoa" | "gear" | "flaps"; roles: Record<string, string> }[] = [
	{
		name: "AOA Indexer",
		kind: "aoa",
		roles: { high: "AOA_INDEXER_HIGH", normal: "AOA_INDEXER_NORMAL", low: "AOA_INDEXER_LOW" },
	},
	{
		name: "Flaps",
		kind: "flaps",
		roles: { half: "FLP_LG_HALF_FLAPS_LT", full: "FLP_LG_FULL_FLAPS_LT", flaps: "FLP_LG_FLAPS_LT" },
	},
	{
		name: "Landing Gear",
		kind: "gear",
		roles: { nose: "FLP_LG_NOSE_GEAR_LT", left: "FLP_LG_LEFT_GEAR_LT", right: "FLP_LG_RIGHT_GEAR_LT", handle: "LANDING_GEAR_HANDLE_LT" },
	},
];

/** Dial presets: [name, knob list as "IDENTIFIER | Label" lines]. */
export const DIAL_PRESETS: [string, string][] = [
	["Left DDI: brightness, contrast", "LEFT_DDI_BRT_CTL | L DDI BRT\nLEFT_DDI_CONT_CTL | L DDI CONT"],
	["Right DDI: brightness, contrast", "RIGHT_DDI_BRT_CTL | R DDI BRT\nRIGHT_DDI_CONT_CTL | R DDI CONT"],
	[
		"Cockpit lighting",
		"CONSOLES_DIMMER | CONSOLES\nINST_PNL_DIMMER | INST PNL\nFLOOD_DIMMER | FLOOD\nCHART_DIMMER | CHART\nWARN_CAUTION_DIMMER | WARN/CAUT\nIFEI | IFEI\nHUD_AOA_INDEXER | AOA IDX",
	],
	["Displays", "HUD_SYM_BRT | HUD BRT\nUFC_BRT | UFC BRT\nAMPCD_BRT_CTL | AMPCD BRT\nHMD_OFF_BRT | HMD BRT"],
];
