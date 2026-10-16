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
 * Position names by DCS-BIOS value (0, 1, 2), where DCS-BIOS has none or has them wrong.
 * From DCS's own key bindings, which give each position's value. DCS-BIOS names most
 * 3-position switches in the order the cockpit lists them, top first, but the top is value 2.
 */
export const POSITION_NAMES: Record<string, string[]> = {
	LAUNCH_BAR_SW: ["RETRACT", "EXTEND"],
	GEAR_LEVER: ["DOWN", "UP"],
	HOOK_LEVER: ["DOWN", "UP"],
	ANTI_SKID_SW: ["OFF", "ON"],
	LDG_TAXI_SW: ["OFF", "ON"],
	GAIN_SWITCH: ["NORM", "ORIDE"],
	GAIN_SWITCH_COVER: ["CLOSED", "OPEN"],
	LEFT_FIRE_BTN_COVER: ["CLOSED", "OPEN"],
	RIGHT_FIRE_BTN_COVER: ["CLOSED", "OPEN"],
	EJECTION_SEAT_ARMED: ["ARMED", "SAFE"],
	HIDE_STICK_TOGGLE: ["SHOW", "HIDE"],
	FLAP_SW: ["FULL", "HALF", "AUTO"],
	BATTERY_SW: ["ORIDE", "OFF", "ON"],
	CABIN_PRESS_SW: ["RAM/DUMP", "DUMP", "NORM"],
	ECS_MODE_SW: ["OFF/RAM", "MAN", "AUTO"],
	ENG_ANTIICE_SW: ["TEST", "OFF", "ON"],
	WSHIELD_ANTI_ICE_SW: ["RAIN", "OFF", "ANTI ICE"],
	COCKKPIT_LIGHT_MODE_SW: ["DAY", "NITE", "NVG"],
	STROBE_SW: ["DIM", "OFF", "BRT"],
	CANOPY_SW: ["CLOSE", "HOLD", "OPEN"],
	FLIR_SW: ["OFF", "STBY", "ON"],
	IR_COOL_SW: ["OFF", "NORM", "ORIDE"],
	HUD_ATT_SW: ["STBY", "AUTO", "INS"],
	HUD_SYM_REJ_SW: ["REJ 2", "REJ 1", "NORM"],
	HUD_VIDEO_CONTROL_SW: ["OFF", "VID", "W/B"],
	UFC_ADF: ["2", "OFF", "1"],
	AMPCD_NIGHT_DAY: ["NIGHT", "OFF", "DAY"],
	AMPCD_SYM_SW: ["DOWN", "OFF", "UP"],
	AMPCD_CONT_SW: ["DOWN", "OFF", "UP"],
	AMPCD_GAIN_SW: ["DOWN", "OFF", "UP"],
	LEFT_DDI_HDG_SW: ["LEFT", "OFF", "RIGHT"],
	LEFT_DDI_CRS_SW: ["LEFT", "OFF", "RIGHT"],
	COMM1_ANT_SELECT_SW: ["LOWER", "AUTO", "UPPER"],
	IFF_ANT_SELECT_SW: ["LOWER", "BOTH", "UPPER"],
	COM_COMM_RELAY_SW: ["PLAIN", "OFF", "CIPHER"],
	COM_COMM_G_XMT_SW: ["COMM 2", "OFF", "COMM 1"],
	COM_CRYPTO_SW: ["ZERO", "NORM", "HOLD"],
	COM_IFF_MODE4_SW: ["OFF", "DIS", "DIS/AUD"],
	MC_SW: ["2 OFF", "NORM", "1 OFF"],
	PROBE_SW: ["EMERG EXTD", "RETRACT", "EXTEND"],
	EXT_PWR_SW: ["OFF", "NORM", "RESET"],
	GND_PWR_1_SW: ["B ON", "AUTO", "A ON"],
	GND_PWR_2_SW: ["B ON", "AUTO", "A ON"],
	GND_PWR_3_SW: ["B ON", "AUTO", "A ON"],
	GND_PWR_4_SW: ["B ON", "AUTO", "A ON"],
	FIRE_TEST_SW: ["TEST B", "OFF", "TEST A"],
	CMSD_DISPENSE_SW: ["OFF", "ON", "BYPASS"],
	THROTTLE_DISP_SW: ["FLARE", "OFF", "CHAFF"],
	EMERGENCY_PARKING_BRAKE_ROTATE: ["EMERG", "PARK", "RELEASE"],
};

/** On the F/A-18C a switch's highest position is up (forward on the consoles), unless listed in HIGH_END. */
export const HIGH_END_OF_THREE = "up";

/**
 * Switches that point elsewhere at their highest position, as seen from the seat (DCS manual
 * pictures). The fuel, FCS, APU, fire test and ground power panels on the left console are
 * mounted sideways, so most of their switches move left and right.
 */
export const HIGH_END: Record<string, "up" | "down" | "left" | "right"> = {
	LAUNCH_BAR_SW: "down",
	SEAT_HEIGHT_SW: "down",
	ENGINE_CRANK_SW: "down",
	APU_CONTROL_SW: "right",
	GAIN_SWITCH: "right",
	PROBE_SW: "right",
	EXT_WNG_TANK_SW: "right",
	EXT_CNT_TANK_SW: "right",
	FUEL_DUMP_SW: "right",
	FIRE_TEST_SW: "right",
	EXT_PWR_SW: "right",
	GND_PWR_1_SW: "right",
	GND_PWR_2_SW: "right",
	GND_PWR_3_SW: "right",
	GND_PWR_4_SW: "right",
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
