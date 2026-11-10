/**
 * Everything specific to the A-10C and A-10C II (DCS-BIOS module "A-10C", control reference v0.11.9).
 * The rest of the code is the same for every aircraft; core/aircraft.data.ts lists the aircraft.
 */

/**
 * DCS-BIOS module (its JSON file name), names, and the ID saved in each key's settings (never change it).
 * One module covers both aircraft: the ARC-210 and HMCS controls are the A-10C II's, the TISL panel
 * and the VHF AM radio the first A-10C's.
 */
export const AIRCRAFT = {
	id: "a10c",
	module: "A-10C",
	dcsNames: ["A-10C_2", "A-10C"],
	name: "A-10C",
	fullName: "A-10C Warthog",
} as const;

/** Switch → its own light, for pairs the panel/name rule in catalog.ts cannot find. */
export const KNOWN_LAMPS: Record<string, string> = {
	GEAR_LEVER: "HANDLE_GEAR_WARNING",
	FIRE_LENG_PULL: "L_ENG_FIRE",
	FIRE_APU_PULL: "APU_FIRE",
	FIRE_RENG_PULL: "R_ENG_FIRE",
	UFC_MASTER_CAUTION: "MASTER_CAUTION",
	SASP_TO_TRIM: "TAKE_OFF_TRIM",
	TACAN_TEST_BTN: "TACAN_TEST",
	// Each emergency disengage switch has a left and a right light: the left one is chosen.
	EFCP_AILERON_EMER_DISENGAGE: "L_AILERON_EMER_DISENGAGE",
	EFCP_ELEVATOR_EMER_DISENGAGE: "L_ELEVATOR_EMER_DISENGAGE",
	FSCP_RCVR_LEVER: "AIR_REFUEL_READY",
	CANOPY_OPEN: "CANOPY_UNLOCKED",
	IFF_REPLY_TEST: "IFF_REPLY",
};

const OFF_ON = ["OFF", "ON"];
const CLOSED_OPEN = ["CLOSED", "OPEN"];
const named = (names: string[], ...ids: string[]) => Object.fromEntries(ids.map((id) => [id, names]));

/**
 * Position names by DCS-BIOS value. DCS binds most of this cockpit by keyboard command (no device or
 * value), so only a few names come from DCS's own key binds (HMCS power, ARC-210 knobs, seat and STEER
 * rockers); the rest are by value from the Helios A-10C interface, which sets each cockpit argument.
 * DCS-BIOS's own descriptions and position lists are not all in value order (flaps, gear lever,
 * position lights, oxygen lever). Not checked in DCS.
 */
export const POSITION_NAMES: Record<string, string[]> = {
	...named(
		OFF_ON,
		"AAP_CDUPWR", "AAP_EGIPWR", "AHCP_TGP", "AHCP_CICU", "AHCP_JTRS", "EPP_EMER_FLOOD",
		"EFCP_SPDBK_EMER_RETR", "EFCP_FLAPS_EMER_RETR", "ENVCP_PITOT_HEAT", "ENVCP_BLEED_AIR", "ENVCP_AIR_SUPPLY",
		"FSCP_EXT_TANKS_WING", "FSCP_EXT_TANKS_FUS", "FSCP_CROSSFEED", "FSCP_BOOST_WING_L", "FSCP_BOOST_WING_R",
		"FSCP_BOOST_MAIN_L", "FSCP_BOOST_MAIN_R", "ILS_PWR", "INT_HM", "LCP_NOSE_ILLUM", "LCP_ACCEL_COMP",
		"EMER_BRAKE", "OXY_SUPPLY", "KY58_DELAY", "KY58_PWR", "KY58_ZEROIZE",
		// Held on by the aircraft: ON only stays while the system accepts it.
		"LASTE_EAC", "ANTI_SKID_SWITCH", "LCP_ANTICOLLISION",
		// The intercom volume knobs, pulled out.
		"INT_INT_UNMUTE", "INT_FM_UNMUTE", "INT_VHF_UNMUTE", "INT_UHF_UNMUTE", "INT_AIM_UNMUTE", "INT_IFF_UNMUTE",
		"INT_ILS_UNMUTE", "INT_TCN_UNMUTE",
	),
	...named(["OFF", "ENGAGE"], "SASP_YAW_SAS_L", "SASP_YAW_SAS_R", "SASP_PITCH_SAS_L", "SASP_PITCH_SAS_R"),
	...named(CLOSED_OPEN, "GND_SAFE_OVERRIDE_COVER", "LADDER_EXTEND_COVER", "KY58_ZEROIZE_COVER"),
	...named(["OFF", "PWR"], "EPP_APU_GEN_PWR", "EPP_AC_GEN_PWR_L", "EPP_AC_GEN_PWR_R", "EPP_BATTERY_PWR"),
	// AAP
	AAP_STEERPT: ["FLT PLAN", "MARK", "MISSION"],
	AAP_STEER: ["DOWN", "OFF", "UP"],
	AAP_PAGE: ["OTHER", "POSITION", "STEER", "WAYPT"],
	// AHCP
	AHCP_MASTER_ARM: ["TRAIN", "SAFE", "ARM"],
	AHCP_GUNPAC: ["GUNARM", "SAFE", "ARM"],
	AHCP_LASER_ARM: ["TRAIN", "SAFE", "ARM"],
	AHCP_ALT_SCE: ["RADAR", "DELTA", "BARO"],
	AHCP_HUD_DAYNIGHT: ["NIGHT", "DAY"],
	AHCP_HUD_MODE: ["STBY", "NORM"],
	AHCP_IFFCC: ["OFF", "TEST", "ON"],
	// ARC-210 (A-10C II): DCS binds positions 0, 1, 2 and 4 of the master knob and 2, 3, 5 and 6 of the
	// secondary knob by value; the others follow the panel.
	ARC210_MASTER: ["OFF", "TR G", "TR", "ADF", "CHNG PRST", "TEST", "ZERO"],
	ARC210_SEC_SW: ["ECCM MASTER", "ECCM", "PRST", "MAN", "MAR", "243", "121"],
	A102_HMCS_PW: ["BAT", "OFF", "ON"],
	// Altimeter, antennas, lights
	ALT_ELECT_PNEU: ["ELECT", "OFF", "PNEU"],
	ANT_IFF: ["LOWER", "BOTH", "UPPER"],
	ANT_UHF: ["LOWER", "BOTH", "UPPER"],
	ALCP_NVIS_LTS: ["OFF", "ALL", "TOP"],
	ALCP_HARSSAS: ["NORM", "OVERRIDE"],
	LCP_POSITION: ["STEADY", "OFF", "FLASH"],
	LCP_SIGNAL_LIGHTS: ["DIM", "BRT"],
	// CDU, UFC: the sideways rockers.
	CDU_BRT: ["LEFT", "OFF", "RIGHT"],
	UFC_INTEN: ["LEFT", "OFF", "RIGHT"],
	// CMSP
	CMSP_JTSN: ["OFF", "JTSN"],
	CMSP_MWS: ["OFF", "ON", "MENU"],
	CMSP_JMR: ["OFF", "ON", "MENU"],
	CMSP_RWR: ["OFF", "ON", "MENU"],
	CMSP_DISP: ["OFF", "ON", "MENU"],
	CMSP_MODE: ["OFF", "STBY", "MAN", "SEMI", "AUTO"],
	// DVADR
	DVADR_FUNCTION: ["OFF", "STBY", "REC"],
	DVADR_VIDEO: ["HUD", "AUTO", "TVM"],
	// Electrical power
	EPP_INVERTER: ["TEST", "OFF", "STBY"],
	// Emergency flight control
	EFCP_TRIM_OVERRIDE: ["EMER", "NORM"],
	EFCP_AILERON_EMER_DISENGAGE: ["LEFT", "OFF", "RIGHT"],
	EFCP_ELEVATOR_EMER_DISENGAGE: ["LEFT", "OFF", "RIGHT"],
	EFCP_MRFCS: ["MAN REVERSION", "NORM"],
	EFCP_EMER_TRIM: ["CENTER", "NOSE DN", "RWD", "NOSE UP", "LWD"],
	// Environment control
	ENVCP_WINDSHIELD_DEFOG: ["OFF", "DEFOG/DEICE"],
	ENVCP_WRRW: ["WASH", "OFF", "RAIN REMOVAL"],
	ENVCP_TEMP_PRESS: ["RAM", "DUMP", "NORM"],
	// Fuel
	FQIS_SELECT: ["INT", "MAIN", "WING", "EXT WING", "EXT CTR"],
	FSCP_TK_GATE: ["CLOSE", "OPEN"],
	FSCP_AMPL: ["OVERRIDE", "NORM"],
	FSCP_RCVR_LEVER: ["OPEN", "CLOSED"],
	// Glare shield
	FIRE_LENG_PULL: ["NORMAL", "PULLED"],
	FIRE_APU_PULL: ["NORMAL", "PULLED"],
	FIRE_RENG_PULL: ["NORMAL", "PULLED"],
	// HARS
	HARS_SLAVE_DG: ["DG", "SLAVE"],
	HARS_NS: ["S", "N"],
	HARS_MAGVAR: ["-15", "0", "+15"],
	// IFF
	IFF_MASTER: ["OFF", "STBY", "LOW", "NORM", "EMER"],
	// Named from the DCS-BIOS description, with HOLD springing back: order not confirmed by another source.
	IFF_CODE: ["ZERO", "B", "A", "HOLD"],
	IFF_OUT_AUDIO_LIGHT: ["LIGHT", "OUT", "AUDIO"],
	IFF_TEST_M1: ["OUT", "ON", "TEST"],
	IFF_TEST_M2: ["OUT", "ON", "TEST"],
	IFF_TEST_M3: ["OUT", "ON", "TEST"],
	IFF_TEST_M4: ["OUT", "ON", "TEST"],
	IFF_RADTEST: ["MON", "OUT", "RAD TEST"],
	IFF_MIC_IDENT: ["MIC", "OUT", "IDENT"],
	IFF_ON_OUT: ["OUT", "ON"],
	// LASTE
	LASTE_AP_MODE: ["ALT", "ALT/HDG", "PATH"],
	LASTE_RDR_ALTM: ["DIS", "NRM"],
	// Landing gear and flaps
	GEAR_LEVER: ["UP", "DOWN"],
	FLAPS_SWITCH: ["UP", "MVR", "DN"],
	// MFCDs
	LMFD_PWR: ["OFF", "NT", "DAY"],
	RMFD_PWR: ["OFF", "NT", "DAY"],
	// Misc
	GND_SAFE_OVERRIDE: ["SAFE", "OVERRIDE"],
	SEAT_ADJUST: ["UP", "OFF", "DOWN"],
	CANOPY_OPEN: ["OPEN", "HOLD", "CLOSE"],
	SEAT_ARM: ["ARMED", "SAFE"],
	STICK_HIDE: ["SHOW", "HIDE"],
	NMSP_ABLE_STOW: ["ABLE", "STOW"],
	// Oxygen
	OXY_EMERGENCY: ["TEST MASK", "NORMAL", "EMERGENCY"],
	OXY_DILUTER: ["NORMAL", "100%"],
	// SAS
	SASP_MONITOR_TEST: ["LEFT", "OFF", "RIGHT"],
	// KY-58
	KY58_PLAIN: ["C/RAD 1", "PLAIN", "C/RAD 2"],
	KY58_1TO5: ["1", "2", "3", "4", "5", "6"],
	KY58_MODE: ["OP", "LD", "RV"],
	// TACAN
	TACAN_XY: ["X", "Y"],
	TACAN_MODE: ["OFF", "REC", "T/R", "A/A REC", "A/A T/R"],
	// TISL (first A-10C)
	TISL_MODE: ["OFF", "CAGE", "DIVE", "LVL NAR", "LVL WIDE"],
	TISL_SLANT_RANGE: ["UNDER 5", "5-10", "OVER 10"],
	TISL_AUX: ["AUX", "BOTH", "TISL"],
	// Throttle
	ENGINE_FUEL_FLOW_L: ["OVERRIDE", "NORM"],
	ENGINE_FUEL_FLOW_R: ["OVERRIDE", "NORM"],
	ENGINE_OPER_L: ["MOTOR", "NORM", "IGN"],
	ENGINE_OPER_R: ["MOTOR", "NORM", "IGN"],
	ENGINE_APU_START: ["OFF", "START"],
	// UHF
	UHF_100MHZ_SEL: ["2", "3", "A"],
	UHF_T_TONE: ["TONE", "OFF", "T"],
	UHF_SQUELCH: ["ON", "OFF"],
	// Panel order, not confirmed by value.
	UHF_POINT25_SEL: ["00", "25", "50", "75"],
	// VHF
	VHFAM_SQUELCH: ["SQUELCH", "OFF", "TONE"],
	VHFFM_SQUELCH: ["SQUELCH", "OFF", "TONE"],
};

/** Not yet checked in DCS: a 3-position switch is drawn with position 2 up (ARM, FLASH, IGN), a 2-position one with position 1 up. */
export const HIGH_END_OF_THREE = "up";

/** Switches whose highest position is down (the names say so): gear handle, flap lever, seat switch, UHF squelch. */
export const HIGH_END: Record<string, "up" | "down" | "left" | "right"> = {
	GEAR_LEVER: "down",
	FLAPS_SWITCH: "down",
	SEAT_ADJUST: "down",
	UHF_SQUELCH: "down",
};

/**
 * Positions that spring back, where the DCS-BIOS switch type does not say (by value; `from` = the positions
 * that spring back, to the middle unless `rest` says otherwise). From DCS's own key binds (a bind with a
 * release) and DCS's switch types: one end of these is a button, the other stays.
 */
export const SPRING_LOADED: Record<string, { from: number[]; rest?: number }> = {
	// TEST springs back, STBY stays.
	EPP_INVERTER: { from: [0] },
	// TEST MASK springs back, EMERGENCY stays.
	OXY_EMERGENCY: { from: [0] },
	// IGN springs back, MOTOR stays.
	ENGINE_OPER_L: { from: [2] },
	ENGINE_OPER_R: { from: [2] },
	// CLOSE has to be held, OPEN stays.
	CANOPY_OPEN: { from: [2] },
	// MENU springs back to ON, OFF stays.
	CMSP_MWS: { from: [2] },
	CMSP_JMR: { from: [2] },
	CMSP_RWR: { from: [2] },
	CMSP_DISP: { from: [2] },
	// IFF: TEST, RAD TEST and IDENT spring back; OUT, MON and MIC stay (as on the real panel; DCS binds none by value).
	IFF_TEST_M1: { from: [2] },
	IFF_TEST_M2: { from: [2] },
	IFF_TEST_M3: { from: [2] },
	IFF_TEST_M4: { from: [2] },
	IFF_RADTEST: { from: [2] },
	IFF_MIC_IDENT: { from: [2] },
	IFF_CODE: { from: [3], rest: 2 },
	// TONE is a button on the squelch switch.
	VHFAM_SQUELCH: { from: [2] },
	VHFFM_SQUELCH: { from: [2] },
	UHF_T_TONE: { from: [0, 2] },
	// The emergency trim hat springs back to the centre.
	EFCP_EMER_TRIM: { from: [1, 2, 3, 4], rest: 0 },
	// COLD and HOT spring back to MAN.
	ENVCP_AC_OPER: { from: [2, 3], rest: 0 },
};

/** Push buttons (press = 1, release = 0) that DCS-BIOS does not mark as momentary. None needed for the A-10C. */
export const KNOWN_PUSH_BUTTONS: string[] = [];

/** Levers drawn with a special knob: the landing gear handle (wheel). */
export const LEVER_KNOBS: Record<string, "wheel" | "hook"> = {
	GEAR_LEVER: "wheel",
};

/** Lights whose DCS-BIOS description gives no colour. */
export const KNOWN_COLOURS: Record<string, "green" | "yellow" | "red" | "white" | "blue"> = {
	// Like the light on the DVADR itself.
	DVADR_EOT_REMOTE: "yellow",
};

/** Multi-light indicators DCS-BIOS lists as separate lights, shown on one key. */
export const INDICATORS: { name: string; kind: "aoa" | "gear" | "flaps"; roles: Record<string, string> }[] = [
	{
		name: "AOA Indexer",
		kind: "aoa",
		roles: { high: "AOA_INDEXER_HIGH", normal: "AOA_INDEXER_NORMAL", low: "AOA_INDEXER_LOW" },
	},
	{
		name: "Landing Gear",
		kind: "gear",
		roles: { nose: "GEAR_N_SAFE", left: "GEAR_L_SAFE", right: "GEAR_R_SAFE", handle: "HANDLE_GEAR_WARNING" },
	},
];

/** Dial presets: [name, knob list as "IDENTIFIER | Label" lines]. */
export const DIAL_PRESETS: [string, string][] = [
	[
		"Cockpit lighting",
		"LCP_ENG_INST | ENG INST\nLCP_FLIGHT_INST | FLT INST\nLCP_AUX_INST | AUX INST\nLCP_FLOOD | FLOOD\nLCP_CONSOLE | CONSOLE\nLCP_FORMATION | FORMATION",
	],
	[
		"Intercom volumes",
		"INT_VOL | INTERCOM\nINT_INT_VOL | INT\nINT_FM_VOL | FM\nINT_VHF_VOL | VHF\nINT_UHF_VOL | UHF\nINT_AIM_VOL | AIM\nINT_IFF_VOL | IFF\nINT_ILS_VOL | ILS\nINT_TCN_VOL | TCN",
	],
	["Radio volumes", "UHF_VOL | UHF\nVHFAM_VOL | VHF AM\nVHFFM_VOL | VHF FM\nTACAN_VOL | TACAN\nILS_VOL | ILS"],
	["Countermeasures and RWR", "CMSC_BRT | CMSC BRT\nCMSC_RWR_VOL | RWR VOL\nCMSP_BRT | CMSP BRT\nRWR_BRT | RWR BRT"],
	// Multi-turn knobs: the default step may need tuning in DCS.
	["Baro, heading, course", "ALT_SET_PRESSURE | BARO\nHSI_HDG_KNOB | HDG\nHSI_CRS_KNOB | CRS"],
];
