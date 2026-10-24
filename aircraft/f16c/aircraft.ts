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

/** Position names by DCS-BIOS value (0, 1), where DCS-BIOS has none the parser can read. */
export const POSITION_NAMES: Record<string, string[]> = {
	// Descriptions the parser misses ("EPU/GEN /OFF", "NORM/ WING FIRST", "100 percent/NORM"); resting name at 0.
	EPU_GEN_TEST_SW: ["OFF", "EPU/GEN"],
	EXT_FUEL_TRANS_SW: ["NORM", "WING FIRST"],
	OXY_DILUTER_LVR: ["NORM", "100%"],
	// No names in DCS; ON/OFF order assumed like the "X/OFF" switches.
	UHF_SQUELCH_SW: ["OFF", "ON"],
	// DCS-BIOS lists these 3-position switches top first, but value 0 is the bottom: names by value from
	// ED's own key binds, which send the same command and value as DCS-BIOS (checked 24 Oct, DCS-BIOS v0.11.7).
	AB_RESET_SW: ["ENG DATA", "NORM", "AB RESET"],
	CANOPY_SW: ["CLOSE", "HOLD", "OPEN"],
	ENG_ANTI_ICE: ["OFF", "AUTO", "ON"],
	EPU_SW: ["OFF", "NORM", "ON"],
	HOT_MIC_SW: ["CIPHER", "OFF", "HOT MIC"],
	HUD_ALT_SW: ["AUTO", "BARO", "RADAR"],
	HUD_BRT_SW: ["NIGHT", "AUTO BRT", "DAY"],
	HUD_DED_DATA_SW: ["OFF", "PFL", "DED"],
	HUD_DEPRESS_RET_SW: ["OFF", "PRI", "STBY"],
	HUD_FP_MARKER_SW: ["OFF", "FPM", "ATT/FPM"],
	HUD_SCALES_SW: ["OFF", "VAH", "VV/VAH"],
	HUD_SPEED_SW: ["GND SPD", "TAS", "CAS"],
	HUD_TEST_SW: ["OFF", "ON", "STEP"],
	ICP_DRIFT_SW: ["WARN RESET", "NORM", "DRIFT C/O"],
	ICP_FLIR_GAIN_SW: ["AUTO", "LVL", "GAIN"],
	JFS_SW: ["START 2", "OFF", "START 1"],
	LAND_TAXI_LIGHT_SW: ["TAXI", "OFF", "LANDING"],
	MAIN_PWR_SW: ["OFF", "BATT", "MAIN PWR"],
	MAL_IND_LTS_BRT_SW: ["DIM", "CENTER", "BRT"],
	MASTER_ARM_SW: ["SIMULATE", "OFF", "MASTER ARM"],
	OXY_EMERG_LVR: ["TEST MASK", "NORMAL", "EMERGENCY"],
	OXY_SUPPLY_LVR: ["OFF", "ON", "PBG"],
	PLAIN_CIPHER_SW: ["CRAD 2", "PLAIN", "CRAD 1"],
	POS_FUSELAGE_LIGHT_SW: ["DIM", "OFF", "BRT"],
	POS_WING_TAIL_LIGHT_SW: ["DIM", "OFF", "BRT"],
	PROBE_HEAT_SW: ["TEST", "OFF", "PROBE HEAT"],
	RDR_ALT_PWR_SW: ["OFF", "STBY", "RDR ALT"],
	ZEROIZE_SW: ["DATA", "OFF", "OFP"],
	// No names in DCS-BIOS; ED's key binds by value.
	COMM1_MODE_KNB: ["OFF", "SQL", "GD"],
	COMM2_MODE_KNB: ["OFF", "SQL", "GD"],
	ECM_PW_SW: ["OFF", "STBY", "OPR"],
	ECM_XMIT_SW: ["3", "2", "1"],
};

/**
 * Not yet checked in DCS: 2-position switches are drawn with position 1 up, 3-position with position 2 up
 * (with the names above, the first name in DCS's tooltip is on top: MASTER ARM, LANDING, MAIN PWR).
 */
export const HIGH_END_OF_THREE = "up";

/**
 * Switches that point elsewhere at their highest position. These keep position 0 up, as before
 * 0.5.1: DCS-BIOS's names already go by value and the physical order is not checked.
 */
export const HIGH_END: Record<string, "up" | "down" | "left" | "right"> = {
	ALT_MODE_LV: "down",
	ECM_PW_SW: "down",
	ECM_XMIT_SW: "down",
	FLCS_PWR_TEST_SW: "down",
	IFF_ENABLE_SW: "down",
	IFF_M4_CODE_SW: "down",
	IFF_M4_REPLY_SW: "down",
	SEAT_ADJ: "down",
};

/**
 * Switches DCS-BIOS treats as spring-loaded at both ends where ED's key binds latch one end
 * (by value; `from` = the positions that spring back to the middle).
 */
export const SPRING_LOADED: Record<string, { from: number[]; rest?: number }> = {
	CANOPY_SW: { from: [0] },
	FLCS_PWR_TEST_SW: { from: [2] },
	ICP_DRIFT_SW: { from: [0] },
	OXY_EMERG_LVR: { from: [0] },
	PROBE_HEAT_SW: { from: [0] },
	// PARKING BRAKE is held by the aircraft, not by the pilot.
	ANTI_SKID_SW: { from: [] },
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
