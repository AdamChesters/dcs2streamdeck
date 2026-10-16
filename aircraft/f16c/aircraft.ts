/**
 * Everything specific to the F-16C Viper (DCS-BIOS module "F-16C_50", control reference v0.11.7).
 * The rest of the code is the same for every aircraft; core/aircraft.data.ts lists the aircraft.
 */

/** DCS-BIOS module (its JSON file name), names, and the ID saved in each key's settings (never change it). */
export const AIRCRAFT = {
	id: "f16c",
	module: "F-16C_50",
	name: "F-16C",
	fullName: "F-16C Viper",
} as const;

/**
 * Switch → its own light. The F-16C puts 129 of its 130 lights in one DCS-BIOS
 * category ("Warning, Caution and IndicatorLights"), so the same-panel name rule
 * in catalog.ts finds no pairs at all; every pair is listed here.
 */
export const KNOWN_LAMPS: Record<string, string> = {
	MASTER_CAUTION: "LIGHT_MASTER_CAUTION",
	// LG handle and the red warning light in the handle.
	GEAR_HANDLE: "LIGHT_GEAR_WARN",
	HOOK_SW: "LIGHT_HOOK",
	ANTI_SKID_SW: "LIGHT_ANTI_SKID",
	JFS_SW: "LIGHT_JFS_RUN",
	// EPU run light on the EPU panel.
	EPU_SW: "LIGHT_EPU",
	// ENG CONT in SEC lights the SEC caution.
	ENG_CONT_SW: "LIGHT_SEC",
	DIGI_BAK_SW: "LIGHT_DBU_ON",
	// FLCP BIT switch and its RUN light.
	BIT_SW: "LIGHT_FL_RUN",
	STORES_CONFIG_SW: "LIGHT_STORES_CONFIG",
	SEAT_EJECT_SAFE: "LIGHT_SEAT_NOT",
	CANOPY_HANDLE: "LIGHT_CANOPY",
	// AR door open → RDY on the AR status indicator.
	AIR_REFUEL_SW: "LIGHT_RDY",
	PROBE_HEAT_SW: "LIGHT_PROBE_HEAT",
	// The reset button clears the ELEC SYS caution.
	ELEC_CAUTION: "LIGHT_ELEC_SYS",
	// ADV MODE button legends: ACTIVE (green) and STBY (yellow). Uncertain which suits a key best.
	ADV_MODE_SW: "LIGHT_ACTIVE",
	// RWR control panel buttons (each button has its legend light(s)).
	RWR_PWR_BTN: "LIGHT_RWR_POWER",
	RWR_SEARCH_BTN: "LIGHT_RWR_SEARCH",
	RWR_LAUNCH_BTN: "LIGHT_RWR_MSL_LAUNCH",
	RWR_MODE_BTN: "LIGHT_RWR_MODE_PRI",
	RWR_UNKNOWN_SHIP_BTN: "LIGHT_RWR_SHIP_UNK",
	// Two-segment buttons: segment choice uncertain (other segment in brackets).
	RWR_HANDOFF_BTN: "LIGHT_RWR_HANDOFF_H", // [LIGHT_RWR_HANDOFF_UP]
	RWR_SYS_TEST_BTN: "LIGHT_RWR_SYSTEST_ON", // [LIGHT_RWR_SYSTEST]
	RWR_T_BTN: "LIGHT_RWR_TGTSEP_UP", // [LIGHT_RWR_TGTSEP_DN]
	RWR_ALT_BTN: "LIGHT_RWR_ALT_LOW", // [LIGHT_RWR_ALT]
	RWR_ACT_PWR_BTN: "LIGHT_RWR_ACT_POWER", // [LIGHT_RWR_ACTIVITY]
	// ECM program buttons: each has S/A/F/T lights; S (standby/selected) chosen. Unnumbered LIGHT_ECM_S/A/F/T are button 6.
	ECM_1_BTN: "LIGHT_ECM_1_S",
	ECM_2_BTN: "LIGHT_ECM_2_S",
	ECM_3_BTN: "LIGHT_ECM_3_S",
	ECM_4_BTN: "LIGHT_ECM_4_S",
	ECM_5_BTN: "LIGHT_ECM_5_S",
	ECM_6_BTN: "LIGHT_ECM_S",
	ECM_FRM_BTN: "LIGHT_ECM_FRM_S",
	ECM_SPL_BTN: "LIGHT_ECM_SPL_S",
};

/**
 * 2-position switches whose DCS-BIOS description has no position names the parser can read,
 * as [name of position 1, name of position 0] like the descriptions ("ARM/OFF": 1 = ARM).
 */
export const KNOWN_LABELS: Record<string, [string, string]> = {
	// Descriptions the parser misses ("EPU/GEN /OFF", "NORM/ WING FIRST", "100 percent/NORM"); [position 1, position 0], resting name at 0.
	EPU_GEN_TEST_SW: ["EPU/GEN", "OFF"],
	EXT_FUEL_TRANS_SW: ["WING FIRST", "NORM"],
	OXY_DILUTER_LVR: ["100%", "NORM"],
	// No names in DCS; ON/OFF order assumed like the "X/OFF" switches.
	UHF_SQUELCH_SW: ["ON", "OFF"],
};

/** Push buttons (press = 1, release = 0) that DCS-BIOS does not mark as momentary. None needed for the F-16C. */
export const KNOWN_PUSH_BUTTONS: string[] = [];

/** Levers drawn with a special knob: the landing gear handle (wheel). */
export const LEVER_KNOBS: Record<string, "wheel" | "hook"> = {
	GEAR_HANDLE: "wheel",
};

/** Lights whose DCS-BIOS description gives no colour. */
export const KNOWN_COLOURS: Record<string, "green" | "yellow" | "red" | "white" | "blue"> = {
	// Oxygen regulator flow blinker (white when flowing). Uncertain.
	FLOW_INDICATOR_LIGHT: "white",
};

/** Multi-light indicators DCS-BIOS lists as separate lights, shown on one key. */
export const INDICATORS: { name: string; kind: "aoa" | "gear" | "flaps"; roles: Record<string, string> }[] = [
	{
		name: "AOA Indexer",
		kind: "aoa",
		roles: { high: "LIGHT_AOA_UP", normal: "LIGHT_AOA_MID", low: "LIGHT_AOA_DN" },
	},
	{
		name: "Landing Gear",
		kind: "gear",
		roles: { nose: "LIGHT_GEAR_N", left: "LIGHT_GEAR_L", right: "LIGHT_GEAR_R", handle: "LIGHT_GEAR_WARN" },
	},
];

/** Dial presets: [name, knob list as "IDENTIFIER | Label" lines]. */
export const DIAL_PRESETS: [string, string][] = [
	[
		"Cockpit lighting",
		"PRI_CONSOLES_BRT_KNB | CONSOLES\nPRI_INST_PNL_BRT_KNB | INST PNL\nFLOOD_CONSOLES_BRT_KNB | FLOOD CONS\nFLOOD_INST_PNL_BRT_KNB | FLOOD INST\nPRI_DATA_DISPLAY_BRT_KNB | DATA ENTRY\nAOA_INDEX_BRT_KNB | AOA IDX\nAR_STATUS_BRT_KNB | AR STATUS",
	],
	[
		"Displays",
		"ICP_HUD_BRT_KNB | HUD SYM\nHMCS_INT_KNB | HMCS\nICP_RASTER_BRT_KNB | RASTER BRT\nICP_RASTER_CONTR_KNB | RASTER CON\nRWR_INTENS_KNB | RWR BRT",
	],
	[
		"Audio: radios",
		"COMM1_PWR_KNB | COMM 1\nCOMM2_PWR_KNB | COMM 2\nINTERCOM_KNB | INTERCOM\nSEC_VOICE_KNB | SEC VOICE\nUHF_VOL_KNB | UHF BACKUP",
	],
	[
		"Audio: tones",
		"MSL_KNB | MSL TONE\nTHREAT_KNB | THREAT\nTF_KNB | TF TONE\nTACAN_KNB | TACAN\nILS_PWR_KNB | ILS",
	],
	// Multi-turn knobs: the default step may need tuning in DCS.
	["Baro, heading, course", "ALT_BARO_SET_KNB | BARO\nEHSI_HDG_SET_KNB | HDG SET\nEHSI_CRS_SET_KNB | CRS SET"],
];
