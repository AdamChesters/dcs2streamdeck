/**
 * Everything specific to the Ka-50 Black Shark (DCS-BIOS module "Ka-50", control reference v0.11.9).
 * The rest of the code is the same for every aircraft; core/aircraft.data.ts lists the aircraft.
 */

/**
 * DCS-BIOS module (its JSON file name), names, and the ID saved in each key's settings (never change it).
 * One module covers the Ka-50 Black Shark 3 and the older Ka-50.
 */
export const AIRCRAFT = {
	id: "ka50",
	module: "Ka-50",
	dcsNames: ["Ka-50_3", "Ka-50"],
	name: "Ka-50",
	fullName: "Ka-50 Black Shark",
} as const;

/** Switch → its own light, for pairs the panel/name rule in catalog.ts cannot find (the lit buttons pair by name). */
export const KNOWN_LAMPS: Record<string, string> = {
	GEAR_LEVER: "GEAR_NOSE_DOWN",
	WEAPONS_MASTER_ARM: "ML_MASTER_ARM",
	WEAPONS_TRAINING_MODE: "ML_WEAPONS_TRAIN",
	ELEC_DC_GROUND_POWER: "ELEC_LAMP_DC_GROUND_POWER",
	ELEC_AC_GROUND_POWER: "ELEC_LAMP_AC_GROUND_POWER",
	LIGHT_CPT_INT: "PLAFOND_LAMP",
	LWS_POWER: "LWS_OPER",
};

const OFF_ON = ["OFF", "ON"];
const CLOSED_OPEN = ["CLOSED", "OPEN"];
const named = (names: string[], ...ids: string[]) => Object.fromEntries(ids.map((id) => [id, names]));

/**
 * Position names by DCS-BIOS value; DCS-BIOS gives the Ka-50 none. From DCS's own key binds where they
 * give a value (master arm, cannon switches, PVI-800 and weapon modes, engine selector, autopilot
 * switches), else by value from the Helios Black Shark interface, which sets each cockpit argument.
 * Not checked in DCS.
 */
export const POSITION_NAMES: Record<string, string[]> = {
	...named(
		OFF_ON,
		"ABRIS_POWER", "OP_PITOT_PORT_HEAT", "OP_PITOT_RAM_HEAT", "OP_ROTOR_DEICE",
		"COMM_INTERCOM_POWER", "COMM_VHF1_POWER", "COMM_VHF2_POWER", "COMM_DATALINK_TLK_POWER",
		"COMM_DATALINK_VHF_TLK_POWER", "COMM_DATALINK_SA_TLF_POWER",
		"ELEC_DC_GROUND_POWER", "ELEC_BATTERY_1", "ELEC_BATTERY_2", "ELEC_AC_GROUND_POWER", "ELEC_AC_L_GEN", "ELEC_AC_R_GEN",
		"ELEC_AUX_LIGHTS", "ELEC_HYD_TRAN_EKRAN_POWER",
		"FUEL_FORWARD_PUMP_POWER", "FUEL_AFT_PUMP_POWER", "FUEL_INNER_PUMP_POWER", "FUEL_OUTER_PUMP_POWER", "FUEL_METER_POWER",
		"FUEL_L_ENG_VLV", "FUEL_R_ENG_VLV", "FUEL_APU_VLV", "FUEL_XFEED_VLV",
		"ENG_L_ENG_EEG", "ENG_R_ENG_EEG", "ENG_ROTOR_BREAK", "ENG_L_CUTOFF_VLV_HANDLE", "ENG_R_CUTOFF_VLV_HANDLE",
		"HYD_POWER", "IFF_POWER", "NAV_POWER", "WEAPONS_POWER", "SAI_POWER", "LWS_POWER", "PVI_POWER", "FLARES_POWER",
		"LIGHT_BEACON", "LIGHT_ROTOR_TIP", "LIGHT_ADI_SAI", "LIGHT_COCKPIT_NVG", "LIGHT_COCKPIT", "LIGHT_CPT_INT",
		"PPK800_CTRL_COMP_BIT", "PPK800_INU_POWER", "PPK800_INU_HEAT", "PPK800_EMER_INU_ALIGN", "PPK800_SLING_STAB",
		"PPK800_VIDEO_TAPE_REC", "UV26_POWER", "UV26_TEST", "R800_SQUELCH", "R828_SQUELCH",
		"K041_POWER", "HMS_POWER", "LASER_STANDBY", "HUD_FILTER_HANDLE",
	),
	// One cover confirmed by value in DCS's key binds (laser mode): the others taken to open the same way.
	...named(
		CLOSED_OPEN,
		"LASER_MODE_COVER", "ADI_TEST_COVER", "ENG_L_ENG_EEG_COVER", "ENG_R_ENG_EEG_COVER", "ENG_EEG_GG_TEST_OPER_COVER",
		"ENG_EEG_PT1_OPER_PT2_COVER", "ELEC_HYD_TRAN_EKRAN_POWER_COVER", "ELEC_DC_GROUND_POWER_COVER", "ELEC_BATTERY_1_COVER",
		"ELEC_BATTERY_2_COVER", "FIREEXT_EXT_MODE_COVER", "FIREEXT_AUTO_MANUAL_COVER", "FUEL_L_ENG_VLV_COVER",
		"FUEL_R_ENG_VLV_COVER", "FUEL_APU_VLV_COVER", "FUEL_XFEED_VLV_COVER", "GEAR_EMER_HYD_COVER", "HYD_POWER_COVER",
		"IFF_POWER_COVER", "WEAPONS_POWER_COVER", "UV26_POWER_COVER", "UV26_TEST_COVER",
	),
	// ADF, radios
	ADF_CHANNEL: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
	ADF_CMPS_ANT: ["COMPASS", "ANTENNA"],
	ADF_TLF_TLG: ["TLF", "TLG"],
	ADF_NDB_MODE: ["OUTER", "AUTO", "INNER"],
	R800_AM_FM: ["FM", "AM"],
	R800_EMER_RCVR: ["NORMAL", "EMERGENCY"],
	R800_ADF: ["NORMAL", "ADF"],
	R800_DATA_TRANSFER_RATE: ["50", "100"],
	R828_CHANNEL: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
	RADIO_SELECTOR: ["VHF-2", "VHF-1", "SW", "GROUND"],
	// Autopilot
	AP_BARO_RALT: ["BARO", "MIDDLE", "RALT"],
	AP_DH_DT: ["DESIRED HDG", "MIDDLE", "DESIRED TRK"],
	HSI_DH_DTA_MANUAL_AUTO: ["AUTO", "MANUAL"],
	// Clock: pushing springs back.
	CLK_L_LEVER: ["PULLED", "NORMAL", "PUSHED"],
	// Datalink
	DLNK_SELF_ID: ["1", "2", "3", "4"],
	DLNK_MASTER_MODE: ["DISABLE", "RECEIVE", "WINGMAN", "COMMANDER"],
	// Engines
	ENG_EEG_GG_TEST_OPER: ["OPERATE", "TEST"],
	ENG_STARTUP_MODE: ["START", "CRANK", "FALSE START"],
	ENG_SELECTOR: ["APU", "LEFT ENG", "RIGHT ENG", "TURBO GEAR"],
	OP_ENG_DEICE: ["DUST PROTECTION", "OFF", "DE-ICE"],
	// Ejection system
	EJECT_SYS_SELECTOR: ["1", "2", "3", "4", "5", "6", "7"],
	// Electrics
	ELEC_DC_AC: ["MANUAL", "OFF", "AUTO"],
	// Fire extinguishers. The sensor group test: taken to rest at 0 with the groups springing back (DCS binds each group with a release).
	FIREEXT_MONITOR: ["OFF", "WARN"],
	FIREEXT_AUTO_MANUAL: ["MANUAL", "AUTO"],
	FIREEXT_WARN_TEST: ["OFF", "GROUP 1", "GROUP 2", "GROUP 3"],
	// HUD, Shkval, laser
	HUD_MODE: ["NIGHT", "DAY", "STBY"],
	HUD_DECLUTTER: ["FULL DATA", "DECLUTTER"],
	SHKVAL_POLARITY: ["WHITE", "BLACK"],
	SHKVAL_OPTICS_SCAN_RATE: ["0.25", "0.5", "0.75", "1.0", "1.5", "2.0", "2.5", "3"],
	LASER_MODE: ["NORM", "STBY"],
	LASER_CODE: ["1", "2", "3"],
	SC_ODS_MODE: ["STBY", "ON"],
	// Landing gear, lights
	GEAR_LEVER: ["UP", "DOWN"],
	GEAR_EMER_HYD: ["COMMON", "MAIN"],
	LIGHT_LANDING_ON_RETR_OFF: ["RETRACT", "OFF", "ON"],
	LIGHT_LANDING_MAIN_BACKUP: ["BACKUP", "MAIN"],
	LIGHT_FORMATION: ["OFF", "10%", "30%", "100%"],
	// The last position (flashes a code) springs back.
	OP_NAV_LIGHTS: ["OFF", "10%", "30%", "100%", "CODE"],
	OP_WINDSHIELD_WIPER: ["OFF", "FAST", "SPEED 1", "SPEED 2", "RETURN"],
	VOICE_MSG_EMER: ["EMERGENCY", "NORMAL"],
	// Navigation
	NAV_GYRO_MAG_MAN_HDG: ["GYRO", "MAG", "MAN"],
	PSHK7_NORTH_SOUTH: ["SOUTH", "NORTH"],
	PVI_INU_FIX: ["FLY OVER", "SHKVAL"],
	PVI_MODES: ["OFF", "CHECK", "ENT", "OPER", "STM", "K-1", "K-2"],
	SLING_AUT_MAN: ["MANUAL", "AUTO"],
	// UV-26
	UV26_DISPENSERS_SELECTOR: ["LEFT", "BOTH", "RIGHT"],
	UV26_MODE: ["REMAINING", "PROGRAM"],
	// Weapons
	WEAPONS_MASTER_ARM: ["DISARM", "ARM"],
	WEAPONS_JETTISON_ARM_MODE: ["DISARM", "ARM"],
	WEAPONS_MANUAL_AUTO: ["AUTO", "MAN"],
	WEAPONS_CANNON_ROUND: ["AP", "HE"],
	WEAPONS_CANNON_BURST: ["SHORT", "MEDIUM", "LONG"],
	WEAPONS_CANNON_RATE: ["HI", "LOW"],
	WEAPONS_TRAINING_MODE: ["OFF", "TRAINING"],
	WEAPONS_AUTOTRACK_GUNSIGHT: ["RET", "AT"],
	WEAPONS_MODE: ["MOV", "FIX", "MAN", "FAIL", "NAV"],
};

/** Not yet checked in DCS: 2-position switches are drawn with position 1 up, 3-position with position 2 up. */
export const HIGH_END_OF_THREE = "up";

/** Switches whose highest position is down (the names say so). */
export const HIGH_END: Record<string, "up" | "down" | "left" | "right"> = {
	GEAR_LEVER: "down",
};

/**
 * Positions that spring back, where the DCS-BIOS switch type does not say (by value; `from` = the positions
 * that spring back, to the middle unless `rest` says otherwise). From DCS's own key binds (a bind with a release).
 */
export const SPRING_LOADED: Record<string, { from: number[]; rest?: number }> = {
	CLK_L_LEVER: { from: [2] },
	OP_NAV_LIGHTS: { from: [4], rest: 3 },
	FIREEXT_WARN_TEST: { from: [1, 2, 3], rest: 0 },
};

/**
 * Push buttons (press = 1, release = 0) that DCS-BIOS gives as 2-position switches. The lit ones show their
 * light through their own LED control (PVI_WAYPOINTS_BTN, PVI_WAYPOINTS_LED).
 */
export const KNOWN_PUSH_BUTTONS: string[] = [
	"SC_MASTER_CAUTION_BTN", "SC_ROTOR_RPM_BTN",
	"AP_BANK_HOLD_BTN", "AP_HDG_HOLD_BTN", "AP_PITCH_HOLD_BTN", "AP_ALT_HOLD_BTN", "AP_FD_BTN",
	"DLNK_SEND_BTN", "DLNK_ESCAPE_BTN", "DLNK_ERASE_BTN", "DLNK_CLEAN_BTN", "DLNK_WINGMAN_ALL_BTN", "DLNK_WINGMAN_1_BTN",
	"DLNK_WINGMAN_2_BTN", "DLNK_WINGMAN_3_BTN", "DLNK_WINGMAN_4_BTN", "DLNK_TARGET_VEHICLE_BTN", "DLNK_TARGET_SAM_BTN",
	"DLNK_TARGET_OTHER_BTN", "DLNK_TARGET_POINT_BTN",
	"PVI_0", "PVI_1", "PVI_2", "PVI_3", "PVI_4", "PVI_5", "PVI_6", "PVI_7", "PVI_8", "PVI_9",
	"PVI_WAYPOINTS_BTN", "PVI_INU_INFLIGHT_REALIGN_BTN", "PVI_FIXPOINTS_BTN", "PVI_INU_PRECISE_ALIGN_BTN", "PVI_AIRFIELDS_BTN",
	"PVI_INU_NORMAL_ALIGN_BTN", "PVI_TARGETS_BTN", "PVI_ENTER_BTN", "PVI_RESET_BTN", "PVI_INIT_PNT_BTN", "PVI_SELF_COOR_BTN",
	"PVI_DTA_DH_BTN", "PVI_WIND_HDG_SPEED_BTN", "PVI_THDG_TIME_RANGE_BTN", "PVI_BEARING_RANGE_BTN",
	"WEAPONS_AUTO_TURN_BTN", "WEAPONS_AIRBORNE_TARGET_BTN", "WEAPONS_FORWARD_HEMI_TARGET_BTN", "WEAPONS_GROUND_TARGET_BTN",
	"WEAPONS_TARGET_RESET_BTN", "WEAPONS_EXPEDITE_ATGM_JETTISON",
	"FLARES_RED", "FLARES_GREEN", "FLARES_WHITE", "FLARES_YELLOW",
];

/** Levers drawn with a special knob: the landing gear lever (wheel). */
export const LEVER_KNOBS: Record<string, "wheel" | "hook"> = {
	GEAR_LEVER: "wheel",
};

/** Lights whose DCS-BIOS description gives no colour. */
export const KNOWN_COLOURS: Record<string, "green" | "yellow" | "red" | "white" | "blue"> = {
	// Like the AC ground power lamp beside it.
	ELEC_LAMP_DC_GROUND_POWER: "green",
};

/** Multi-light indicators DCS-BIOS lists as separate lights, shown on one key: the three green gear-down lamps. */
export const INDICATORS: { name: string; kind: "aoa" | "gear" | "flaps"; roles: Record<string, string> }[] = [
	{
		name: "Landing Gear",
		kind: "gear",
		roles: { nose: "GEAR_NOSE_DOWN", left: "GEAR_L_MAIN_DOWN", right: "GEAR_R_MAIN_DOWN" },
	},
];

/** Dial presets: [name, knob list as "IDENTIFIER | Label" lines]. */
export const DIAL_PRESETS: [string, string][] = [
	[
		"Cockpit lighting",
		"LIGHT_COCKPIT_BRIGHTNESS | PANEL\nLIGHT_HSI_ADI_BRIGHTNESS | HSI / ADI\nLIGHT_AUX_BRIGHTNESS | NVG\nELEC_AUX_BRIGHTNESS | AUX PANEL\nOP_WARNLIGHTS_BRIGHTNESS | WARN LTS",
	],
	[
		"Displays",
		"HUD_BRIGHTNESS | HUD\nSHKVAL_BRIGHTNESS | SHKVAL BRT\nSKHVAL_CONTRAST | SHKVAL CON\nHMS_BRIGHTNESS | HMS\nABRIS_BRIGHTNESS | ABRIS\nPVI_BRIGHTNESS | PVI-800",
	],
	["Radio volumes", "R828_VOLUME | R-828\nADF_VOLUME | ADF"],
	// Multi-turn knobs: the default step may need tuning in DCS.
	["Baro, heading, course", "ALT_QFE_KNOB | QFE\nHSI_HDG_ROT | HDG\nHSI_COURSE_ROT | COURSE\nRALT_SAFE_ALT_KNOB | SAFE ALT"],
];
