import { _status, game, lib } from "noname";
import { initRecast } from "./recast.js";
import { fixRecastingDraw } from "./recastDrawFix.js";
import { animateSkill } from "./animate.js";
import { baseSkill } from "./base.js";
import { inheritSkill } from "./inherit.js";
import { inheritComplexSkill } from "./inherit-complex.js";
import { guhuoSkill } from "./guhuo.js";
import { inheritSubSkill, factionOptimizeSkill } from "./sub-skills.js";

const inheritSkills = { ...inheritSkill, ...inheritComplexSkill, ...guhuoSkill };

function initSkills() {
	if (!_status.connectMode) {
		decadeUI.animateSkill = animateSkill;
		decadeUI.skill = baseSkill;
		decadeUI.inheritSkill = inheritSkills;
		decadeUI.inheritSubSkill = inheritSubSkill;
		for (const skill of Object.keys(animateSkill)) {
			lib.skill[skill] = animateSkill[skill];
			game.addGlobalSkill(skill);
		}
		Object.assign(lib.skill, baseSkill);
		for (const skill of Object.keys(inheritSkills)) {
			if (lib.skill[skill]) Object.assign(lib.skill[skill], inheritSkills[skill]);
		}
		for (const skill of Object.keys(inheritSubSkill)) {
			if (!lib.skill[skill]?.subSkill) continue;
			for (const subSkill of Object.keys(inheritSubSkill[skill])) {
				if (lib.skill[skill].subSkill[subSkill]) {
					Object.assign(lib.skill[skill].subSkill[subSkill], inheritSubSkill[skill][subSkill]);
				}
			}
		}
		if (lib.config["extension_十周年UI_shiliyouhua"]) {
			Object.defineProperty(lib, "group", {
				get: () => ["wei", "shu", "wu", "qun", "jin"],
				set: () => {},
			});
			lib.skill._slyh = factionOptimizeSkill._slyh;
		}
	}

	initRecast();
	fixRecastingDraw();
}

export { animateSkill, baseSkill, inheritSubSkill, initSkills };
