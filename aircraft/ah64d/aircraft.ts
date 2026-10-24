/**
 * Everything specific to the AH-64D Apache (DCS-BIOS module "AH-64D", control reference v0.11.7).
 * The rest of the code is the same for every aircraft; core/aircraft.data.ts lists the aircraft.
 * Controls both seats have are listed once (without PLT_ / CPG_) and follow the player's seat.
 */

/** DCS-BIOS module (its JSON file name), DCS's name, names, and the ID saved in each key's settings (never change it). */
export const AIRCRAFT = {
	id: "ah64d",
	module: "AH-64D",
	dcsName: "AH-64D_BLK_II",
	name: "AH-64D",
	fullName: "AH-64D Apache",
} as const;

/** Pilot (back seat) and CP/G (front seat): DCS-BIOS reports which one the player is in. */
export const SEATS = {
	position: "SEAT_POSITION",
	seats: [
		{ prefix: "PLT_", category: "PLT ", description: "Pilot ", name: "pilot" },
		{ prefix: "CPG_", category: "CPG ", description: "Gunner ", name: "CP/G" },
	],
};

/** Switch → its own light. All lights are in one DCS-BIOS category, away from their buttons. */
export const KNOWN_LAMPS: Record<string, string> = {
	INTL_MWARN_BTN: "MASTER_WARNING_L",
	INTL_MCAUTION_BTN: "MASTER_CAUTION_L",
	// Fire buttons light FIRE (yellow); their RDY lights (green) are separate lights.
	FIRE_ENG1_BTN: "ENG_1_FIRE_L",
	FIRE_ENG2_BTN: "ENG_2_FIRE_L",
	FIRE_APU_BTN: "APU_FIRE_L",
	FIRE_PRIME_EXT: "FIRE_EXT_DISCH_PRI_L",
	FIRE_RES_EXT: "FIRE_EXT_DISCH_RES_L",
	// A/S button: ARM (yellow); SAFE (green) is a separate light.
	MASTER_ARM_BTN: "MASTER_ARM_ARM_L",
	GROUND_OVERRIDE_BTN: "GROUND_OVERRIDE_L",
	EMERG_GUARD_BTN: "EMERG_GUARD_L",
	EMERG_XPNDR_BTN: "EMERG_XPNDR_L",
	EMERG_HYD_BTN: "EMERG_HYD_L",
	T_WHEEL_UNLOCK_BTN: "T_WHEEL_UNLOCK_L",
	COLLECTIVE_TAIL_WHEEL: "T_WHEEL_UNLOCK_L",
	PLT_APU_BTN: "PLT_APU_L",
	JETT_STORE_LO: "JETT_L_OUTBOARD_L",
	JETT_STORE_LI: "JETT_L_INBOARD_L",
	JETT_STORE_RI: "JETT_R_INBOARD_L",
	JETT_STORE_RO: "JETT_R_OUTBOARD_L",
	JETT_STORE_LW: "JETT_L_TIP_L",
	JETT_STORE_RW: "JETT_R_TIP_L",
};

/**
 * Position names by DCS-BIOS value (0, 1, 2), where DCS-BIOS's own list is wrong or missing.
 * Checked against DCS's own key bindings (value per name) and Chuck's Guide AH-64D.
 */
export const POSITION_NAMES: Record<string, string[]> = {
	// DCS-BIOS lists M, Off, R; in DCS rockets (R) are left = 0 and missiles (M) right = 2.
	CYCLIC_WEAPON_LR: ["R", "Off", "M"],
	// DCS names the right position AL (attitude hold), DCS-BIOS just A.
	CYCLIC_TRIM_LR: ["AT", "Off", "AL"],
	// DCS-BIOS lists UP, DOWN; the stick is folded down at 0.
	CPG_STICK_FOLD: ["DOWN", "UP"],
	// The panel says NT.
	MPD_L_MODE: ["MONO", "NT", "DAY"],
	MPD_R_MODE: ["MONO", "NT", "DAY"],
	// No names in DCS-BIOS.
	EMERG_ZERO_SW: ["OFF", "ZEROIZE"],
	PLT_CMWS_JETT: ["OFF", "JETT"],
	PLT_VIDEO_AUTO_CON: ["OFF", "ACM"],
};

/** 2-position switches are drawn with position 1 up; 3-position with this end up. */
export const HIGH_END_OF_THREE = "up";

/**
 * Switches that point elsewhere at their highest position. Grip hats: the _UD half moves fore/aft
 * (forward = up, the highest value), the _LR half left/right (right = the highest value).
 */
export const HIGH_END: Record<string, "up" | "down" | "left" | "right"> = {
	// SP 1 (0) is forward, SP 2 (2) aft.
	CPG_PROC_SEL_SW: "down",
	// Pulled out towards the pilot.
	PLT_PARK_BRAKE: "down",
	// Sideways toggles.
	FIRE_DETECT_TEST: "right",
	PLT_GEN_RESET: "right",
	COLLECTIVE_BS_PLRT: "right",
	COLLECTIVE_SEARCHLIGHT_LR: "right",
	COLLECTIVE_FCR_MODE_LR: "right",
	COLLECTIVE_FCR_SCAN_SIZE_LR: "right",
	COLLECTIVE_SIGHT_SELECT_LR: "right",
	CYCLIC_RTS: "right",
	CYCLIC_TRIM_LR: "right",
	CYCLIC_WEAPON_LR: "right",
	CPG_LHG_CURSOR_L_R: "right",
	CPG_LHG_FCR_L_R: "right",
	CPG_LHG_TADS_FOV_L_R: "right",
	CPG_LHG_WPN_L_R: "right",
	CPG_RHG_FCR_SCAN_L_R: "right",
	CPG_RHG_MAN_TRK_L_R: "right",
	CPG_RHG_SIGHT_L_R: "right",
	CPG_TEDAC_AZ: "right",
};

/** Push buttons (press = 1, release = 0) that DCS-BIOS does not mark as momentary. None needed for the AH-64D. */
export const KNOWN_PUSH_BUTTONS: string[] = [];

/** Levers drawn with a special knob. None for the AH-64D. */
export const LEVER_KNOBS: Record<string, "wheel" | "hook"> = {};

/** Lights whose DCS-BIOS colour is wrong or missing. */
export const KNOWN_COLOURS: Record<string, "green" | "yellow" | "red" | "white" | "blue"> = {};

/** Multi-light indicators. None for the AH-64D. */
export const INDICATORS: { name: string; kind: "aoa" | "gear" | "flaps"; roles: Record<string, string> }[] = [];

/** Switches that turn rather than flip, and which way their highest position is (clockwise unless "ccw"). */
export const ROTARY_KNOBS: Record<string, "cw" | "ccw"> = {
	PLT_MASTER_IGN_SW: "cw",
	PLT_CMWS_PW: "cw",
	// DAY is counter-clockwise, MONO / OFF clockwise.
	MPD_L_MODE: "ccw",
	MPD_R_MODE: "ccw",
	CPG_TEDAC_DISP_MODE: "ccw",
};

/**
 * Positions that spring back, where the DCS-BIOS switch type does not say (by value; `from` = the positions
 * that spring back, to `rest` or the middle). Every other DCS-BIOS spring-loaded switch springs back from both ends.
 */
export const SPRING_LOADED: Record<string, { from: number[]; rest?: number }> = {
	// STOW springs back; ON stays.
	COLLECTIVE_SEARCHLIGHT: { from: [0] },
	// TEST springs back to ON; OFF stays.
	PLT_CMWS_PW: { from: [2] },
	// The trigger springs back to Off from either detent.
	CYCLIC_TRIGGER: { from: [1, 2], rest: 0 },
};

/**
 * Thumb sticks DCS-BIOS gives as knobs (its axis commands, with no key commands): keys push them while held
 * and centre them on release. [low end, high end]; high (+1) assumed Up and Right like ED's own keys (not checked in DCS).
 */
export const CENTRED: Record<string, [string, string]> = {
	COLLECTIVE_CURSOR_UD: ["Down", "Up"],
	COLLECTIVE_CURSOR_LR: ["Left", "Right"],
};

/** Dial presets: [name, knob list as "IDENTIFIER | Label" lines]. PLT_ knobs are in the pilot's seat only. */
export const DIAL_PRESETS: [string, string][] = [
	[
		"Cockpit lighting",
		"INTL_PRIMARY_L_KNB | PRIMARY\nINTL_FLOOD_L_KNB | FLOOD\nINTL_SIGNAL_L_KNB | SIGNAL\nPLT_INTL_STBYINST_L_KNB | STBY INST",
	],
	[
		"Displays",
		"MPD_L_BRT | L MPD BRT\nMPD_R_BRT | R MPD BRT\nEUFD_BRT | EUFD BRT\nKU_BRT | KU BRT\nMPD_L_VIDEO | L MPD VID\nMPD_R_VIDEO | R MPD VID",
	],
	[
		"Audio: radios",
		"COM_MASTER_VOL | MASTER\nCOM_VHF_VOL | VHF\nCOM_UHF_VOL | UHF\nCOM_FM1_VOL | FM1\nCOM_FM2_VOL | FM2\nCOM_HF_VOL | HF",
	],
	["Audio: other", "COM_ATA_VOL | ATA\nCOM_RLWR_VOL | RLWR\nCOM_IFF_VOL | IFF\nCOM_ADF_VOL | ADF\nCOM_VCR_VOL | VCR\nCOM_SENS_KNB | SENS"],
	[
		"Helmet video (pilot)",
		"PLT_VIDEO_IHADSS_BRT | IHADSS BRT\nPLT_VIDEO_IHADSS_CON | IHADSS CON\nPLT_VIDEO_SYM_BRT | SYM BRT\nPLT_VIDEO_FLIR_GAIN | FLIR GAIN\nPLT_VIDEO_FLIR_LVL | FLIR LVL",
	],
	["Altimeter (pilot)", "PLT_ALT_SET_KNB | BARO"],
];
