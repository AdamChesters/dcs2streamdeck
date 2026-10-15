/**
 * Light action: a key that shows a cockpit light or indicator (caution lights,
 * L BAR, AOA indexer, flaps, gear). Same as a DCS Switch with no control.
 */
import { AIRCRAFT } from "../../../core/aircraft.data.ts";
import { DcsSwitch } from "./switch.ts";

export class DcsLight extends DcsSwitch {
	override readonly manifestId: string = `${AIRCRAFT.uuid}.light`;
}
