import { game, lib, ui, _status } from "noname";

function isInUsePhase(event, player) {
	for (let current = event; current; current = current.parent) {
		if (current.name === "phaseUse" && (!current.player || current.player === player)) return true;
	}
	if (event?.getParent?.("phaseUse")?.name === "phaseUse") return true;
	return player?.isPhaseUsing?.(true) === true;
}

function canShowRecastButton() {
	const event = _status.event;
	const player = event?.player || game.me;
	const recasting = lib.skill._recasting;
	if (!event || !player || player !== game.me || event.name === "_recasting" || event.skill === "_recasting") return false;
	if (!isInUsePhase(event, player)) return false;
	try {
		if (typeof recasting?.filter === "function" && recasting.filter(event, player)) return true;
	} catch {}
	try {
		return player.hasCard(card => player.canRecast(card, null, true), "he");
	} catch {
		return false;
	}
}

export function updateRecastingButton(confirm) {
	if (!confirm) return;
	let button = confirm._recastingButton;
	if (!canShowRecastButton()) {
		button?.remove();
		confirm._recastingButton = null;
		return;
	}
	if (button?.parentNode === confirm) return;

	button = document.createElement("div");
	button.link = "_recasting";
	button.className = "recasting-btn";
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
	button.style.transform = "scale(0.75)";
	button.style.setProperty("padding", "25px 10px", "important");
	button.style.setProperty("margin", "0 -12px", "important");
	button.querySelector("img").style.cssText = "width: 100%; height: 100%; object-fit: contain; pointer-events: none;";
	button.addEventListener(lib.config.touchscreen ? "touchend" : "click", function (event) {
		event.stopPropagation();
		if (_status.event?.skill === "_recasting" || !canShowRecastButton()) return;
		ui.click.skill(this.link);
		ui.updateSkillControl?.(game.me, true);
	});
	button.style.order = "-1";
	confirm.appendChild(button);
	confirm._recastingButton = button;
}
