import { game, lib, ui, _status } from "noname";

let recastingButton = null;
let updateHookInstalled = false;
let gameHooksInstalled = false;

function isInUsePhase(event, player) {
	for (let current = event; current; current = current.parent) {
		if (current.name === "phaseUse" && (!current.player || current.player === player)) return true;
	}
	if (event?.getParent?.("phaseUse")?.name === "phaseUse") return true;
	try {
		return player?.isPhaseUsing?.(true) === true;
	} catch {
		return false;
	}
}

function hasRecastableCard(player, event) {
	const filter = lib.skill._recasting?.filter;
	if (typeof filter === "function") {
		try {
			if (filter(event, player)) return true;
		} catch {}
	}
	try {
		return player.hasCard(card => player.canRecast(card, null, true), "he");
	} catch {
		return false;
	}
}

function canShowRecastButton() {
	const event = _status.event;
	const player = event?.player || game.me;
	if (lib.config.extension_十周年UI_enableRecastInteraction === false) return false;
	if (!event || !player || player !== game.me || event.name === "_recasting" || event.skill === "_recasting") return false;
	return isInUsePhase(event, player) && hasRecastableCard(player, event);
}

function getButtonParent(confirm) {
	const skillControl = ui.skillControl;
	return skillControl?.node?.enable || skillControl?.node?.combined || confirm || null;
}

function syncRecastingButton(confirm = ui.confirm) {
	if (!canShowRecastButton()) {
		recastingButton?.remove();
		recastingButton = null;
		return;
	}
	const parent = getButtonParent(confirm);
	if (!parent) return;
	if (parent.querySelector('[data-id="_recasting"]:not(.recasting-btn)')) {
		recastingButton?.remove();
		recastingButton = null;
		return;
	}
	if (recastingButton?.parentNode === parent) return;
	recastingButton?.remove();

	const button = document.createElement("div");
	button.link = "_recasting";
	button.className = "skillitem enable-skill recasting-btn";
	button.dataset.id = "_recasting";
	button.dataset.type = "skill2";
	button.title = "重铸";
	button.setAttribute("aria-label", "重铸");
	button.innerHTML = `<img draggable='false' src='${lib.assetURL}extension/十周年UI/ui/assets/lbtn/uibutton/CZ.png'>`;
	button.style.backgroundImage = `url('${lib.assetURL}extension/十周年UI/ui/assets/lbtn/uibutton/game_btn_bg2.png')`;
	button.style.backgroundSize = "100% 100%";
	button.style.display = "inline-flex";
	button.style.alignItems = "center";
	button.style.justifyContent = "center";
	button.style.flex = "0 0 auto";
	button.style.padding = "0";
	button.querySelector("img").style.cssText = "width:72%;height:72%;object-fit:contain;pointer-events:none;";
	button.addEventListener(lib.config.touchscreen ? "touchend" : "click", function (event) {
		event.stopPropagation();
		if (!canShowRecastButton()) return;
		ui.click.skill(this.link);
		ui.updateSkillControl?.(game.me, true);
	});
	parent.appendChild(button);
	recastingButton = button;
}

function installSkillControlUpdateHook() {
	if (updateHookInstalled || typeof ui.updateSkillControl !== "function") return;
	const original = ui.updateSkillControl;
	ui.updateSkillControl = function (...args) {
		const result = original.apply(this, args);
		const schedule = window.requestAnimationFrame || (callback => window.setTimeout(callback, 0));
		schedule(() => syncRecastingButton());
		return result;
	};
	updateHookInstalled = true;
}

function installGameHooks() {
	if (gameHooksInstalled) return;
	const update = () => {
		installSkillControlUpdateHook();
		syncRecastingButton();
	};
	let installed = false;
	if (lib.hooks?.checkBegin) {
		lib.hooks.checkBegin.add("_decadeUI_recasting_button_begin", update);
		installed = true;
	}
	if (lib.hooks?.checkEnd) {
		lib.hooks.checkEnd.add("_decadeUI_recasting_button_end", update);
		installed = true;
	}
	gameHooksInstalled = installed;
}

export function updateRecastingButton(confirm) {
	installGameHooks();
	installSkillControlUpdateHook();
	syncRecastingButton(confirm);
}
