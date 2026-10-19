// The deck-only window, to keep the deck on screen. Display only; drag anywhere to move.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import type { DeckState } from "./api.ts";
import { api } from "./api.ts";
import { Deck } from "./Deck.tsx";
import "./styles.css";

function DeckOnly() {
	const [state, setState] = useState<DeckState>();
	useEffect(() => {
		void api.state().then(setState);
		return api.onState(setState);
	}, []);
	return state ? <Deck state={state} /> : null;
}

createRoot(document.getElementById("root")!).render(<DeckOnly />);
