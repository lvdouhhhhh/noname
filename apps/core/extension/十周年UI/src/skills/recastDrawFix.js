import { _status, get, lib } from "noname";

let patchedSkill;

function hasModeSpecificRecast(cards, player) {
	return cards.some(card => {
		if (
			lib.config.mode === "stone" &&
			_status.mode === "deck" &&
			!player.isMin() &&
			get.type(card).startsWith("stone")
		) {
			return true;
		}
		const subtype = get.subtype(card);
		return subtype === "spell_gold" || subtype === "spell_silver";
	});
}

export function fixRecastingDraw() {
	if (lib.config.extension_十周年UI_enableRecastInteraction === false) return;

	const skill = lib.skill._recasting;
	if (!skill || typeof skill.content !== "function" || skill === patchedSkill) return;

	const originalContent = skill.content;
	skill.content = async function (event, trigger, player) {
		const cards = event?.cards;
		if (!Array.isArray(cards) || !cards.length || !player || hasModeSpecificRecast(cards, player)) {
			return originalContent.apply(this, arguments);
		}

		// Use the core recast defaults so the draw event is awaited and synchronized online.
		await player.recast(cards);
	};
	patchedSkill = skill;
}
