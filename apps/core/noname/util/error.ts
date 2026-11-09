import StackFrame from "stackframe";
import ErrorStackParser from "error-stack-parser";
import StackTraceGPS from "stacktrace-gps";
import { ErrorManager } from "@/util/sandbox.js";

function getStatusInfo({ lib, get, _status }) {
	if (!_status?.event) return "";

	let str = "";
	const evt = _status.event;
	str += `\nevent.name: ${evt.name}\nevent.step: ${evt.step}`;
	if (evt.parent) {
		str += `\nevent.parent.name: ${evt.parent.name}\nevent.parent.step: ${evt.parent.step}`;
	}
	if (evt.parent && evt.parent.parent) {
		str += `\nevent.parent.parent.name: ${evt.parent.parent.name}\nevent.parent.parent.step: ${evt.parent.parent.step}`;
	}
	if (evt.player || evt.target || evt.source || evt.skill || evt.card) {
		str += "\n-------------";
	}
	if (evt.player) {
		if (lib.translate[evt.player.name]) {
			str += `\nplayer: ${lib.translate[evt.player.name]}[${evt.player.name}]`;
		} else {
			str += "\nplayer: " + evt.player.name;
		}
		let distance = get.distance(_status.roundStart, evt.player, "absolute");
		if (distance != Infinity) {
			str += `\n座位号: ${distance + 1}`;
		}
	}
	if (evt.target) {
		if (lib.translate[evt.target.name]) {
			str += `\ntarget: ${lib.translate[evt.target.name]}[${evt.target.name}]`;
		} else {
			str += "\ntarget: " + evt.target.name;
		}
	}
	if (evt.source) {
		if (lib.translate[evt.source.name]) {
			str += `\nsource: ${lib.translate[evt.source.name]}[${evt.source.name}]`;
		} else {
			str += "\nsource: " + evt.source.name;
		}
	}
	if (evt.skill) {
		if (lib.translate[evt.skill]) {
			str += `\nskill: ${lib.translate[evt.skill]}[${evt.skill}]`;
		} else {
			str += "\nskill: " + evt.skill;
		}
	}
	if (evt.card) {
		if (lib.translate[evt.card.name]) {
			str += `\ncard: ${lib.translate[evt.card.name]}[${evt.card.name}]`;
		} else {
			str += "\ncard: " + evt.card.name;
		}
	}
	return str;
}

function normalizeError(reason: unknown): Error {
	if (reason instanceof Error) return reason;

	if (typeof reason === "string") {
		return new Error(reason);
	}

	try {
		return new Error(JSON.stringify(reason));
	} catch {
		return new Error(String(reason));
	}
}

type ErrorReportEntry = { time: string; text: string };
type ErrorReportWindow = Window & { __nonameReportError?: (text: string) => void };

function createErrorReportViewer() {
	const storageKey = "noname_error_history_v1";
	const maxEntries = 20;
	let entries: ErrorReportEntry[] = [];
	try {
		const saved = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
		if (Array.isArray(saved)) entries = saved.filter(item => typeof item?.text === "string").slice(0, maxEntries);
	} catch {}

	let launcher: HTMLButtonElement | null = null;
	let panel: HTMLDivElement | null = null;
	let toast: HTMLDivElement | null = null;
	let toastTimeout: number | undefined;
	let reportField: HTMLTextAreaElement | null = null;
	let historyList: HTMLDivElement | null = null;
	let status: HTMLDivElement | null = null;

	const save = () => {
		try {
			sessionStorage.setItem(storageKey, JSON.stringify(entries));
		} catch {}
	};

	const copy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			if (status) status.textContent = "已复制到剪贴板";
		} catch {
			if (!reportField) return;
			reportField.value = text;
			reportField.focus();
			reportField.select();
			const copied = document.execCommand("copy");
			if (status) status.textContent = copied ? "已复制到剪贴板" : "已选中内容，请按 Ctrl+C 复制";
		}
	};

	const renderHistory = () => {
		if (!launcher || !historyList) return;
		launcher.textContent = `错误记录 ${entries.length}`;
		historyList.replaceChildren();
		entries.forEach((entry, index) => {
			const item = document.createElement("button");
			item.type = "button";
			item.textContent = `${index + 1}. ${entry.time}`;
			item.style.cssText = "padding:8px 10px;text-align:left;color:#eee;background:#263244;border:1px solid #475569;border-radius:6px;cursor:pointer;";
			item.onclick = () => {
				if (reportField) reportField.value = entry.text;
				if (status) status.textContent = `已打开第 ${index + 1} 条错误记录`;
			};
			historyList?.appendChild(item);
		});
	};

	const openPanel = () => {
		if (panel) {
			panel.style.display = "flex";
			return;
		}
		panel = document.createElement("div");
		panel.setAttribute("role", "dialog");
		panel.setAttribute("aria-label", "错误记录");
		panel.style.cssText = "position:fixed;z-index:2147483001;inset:4vh 3vw;display:flex;flex-direction:column;gap:10px;padding:14px;color:#f8fafc;background:#101827;border:1px solid #64748b;border-radius:12px;box-shadow:0 12px 45px #0009;font:14px sans-serif;";
		const heading = document.createElement("div");
		heading.style.cssText = "display:flex;align-items:center;justify-content:space-between;font-size:18px;font-weight:700;";
		heading.textContent = "错误记录（对局仍可继续）";
		const close = document.createElement("button");
		close.type = "button";
		close.textContent = "关闭";
		close.style.cssText = "padding:7px 12px;color:#fff;background:#334155;border:0;border-radius:6px;cursor:pointer;";
		close.onclick = () => {
			if (panel) panel.style.display = "none";
		};
		heading.appendChild(close);
		historyList = document.createElement("div");
		historyList.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;max-height:22vh;overflow:auto;";
		reportField = document.createElement("textarea");
		reportField.readOnly = true;
		reportField.setAttribute("aria-label", "错误详细内容");
		reportField.style.cssText = "flex:1;min-height:120px;width:100%;resize:none;box-sizing:border-box;padding:10px;color:#f8fafc;background:#0b1220;border:1px solid #475569;border-radius:7px;font:12px/1.45 monospace;user-select:text;white-space:pre;";
		status = document.createElement("div");
		status.style.cssText = "min-height:18px;color:#cbd5e1;";
		const footer = document.createElement("div");
		footer.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
		const makeButton = (label: string, action: () => void) => {
			const button = document.createElement("button");
			button.type = "button";
			button.textContent = label;
			button.style.cssText = "padding:8px 12px;color:#fff;background:#2563eb;border:0;border-radius:6px;cursor:pointer;";
			button.onclick = action;
			return button;
		};
		footer.append(makeButton("复制当前错误", () => copy(reportField?.value || "")));
		footer.append(makeButton("复制全部记录", () => copy(entries.map(entry => `${entry.time}\n${entry.text}`).join("\n\n----------------\n\n"))));
		footer.append(makeButton("清空记录", () => {
			entries = [];
			save();
			renderHistory();
			if (reportField) reportField.value = "";
			if (status) status.textContent = "错误记录已清空";
		}));
		panel.append(heading, historyList, reportField, status, footer);
		(document.body || document.documentElement).appendChild(panel);
		renderHistory();
	};

	const ensureLauncher = () => {
		if (launcher) return;
		launcher = document.createElement("button");
		launcher.type = "button";
		launcher.style.cssText = "position:fixed;z-index:2147483000;right:14px;bottom:14px;padding:9px 13px;color:#fff;background:#b91c1c;border:1px solid #fecaca;border-radius:20px;box-shadow:0 4px 14px #0008;font:14px sans-serif;cursor:pointer;display:none;";
		launcher.onclick = openPanel;
		(document.body || document.documentElement).appendChild(launcher);
	};

	return (text: string) => {
		entries.unshift({ time: new Date().toLocaleString(), text });
		entries = entries.slice(0, maxEntries);
		save();
		ensureLauncher();
		if (launcher) launcher.style.display = "block";
		renderHistory();
		if (!toast?.isConnected) {
			toast = document.createElement("div");
			toast.style.cssText = "position:fixed;z-index:2147483000;right:14px;bottom:58px;max-width:min(92vw,420px);padding:10px 12px;color:#fff;background:#7f1d1d;border:1px solid #fca5a5;border-radius:8px;box-shadow:0 4px 14px #0008;font:14px sans-serif;";
			(document.body || document.documentElement).appendChild(toast);
		}
		toast.textContent = "游戏错误已保存，可复制或稍后查看";
		window.clearTimeout(toastTimeout);
		toastTimeout = window.setTimeout(() => {
			toast?.remove();
			toast = null;
			toastTimeout = undefined;
		}, 8000);
	};
}

/**
 * 目前和StackTrace.fromError一样
 * @param error
 * @param opts
 * @returns
 */
async function fromError(error: Error, opts?: StackTraceGPS.Options): Promise<{ origin: StackFrame; source?: StackFrame }[]> {
	try {
		const gps = new StackTraceGPS(opts);
		const stackframes = ErrorStackParser.parse(error);
		return Promise.all(
			stackframes.map(async sf => {
				try {
					const source = await gps.pinpoint(sf);
					return { origin: sf, source };
				} catch {
					return { origin: sf };
				}
			})
		);
	} catch (e) {
		return [{ origin: new StackFrame({}) }];
	}
}

export function setOnError({ lib, game, get, _status }) {
	const reportError = createErrorReportViewer();
	(window as ErrorReportWindow).__nonameReportError = reportError;

	window.onunhandledrejection = async (event: PromiseRejectionEvent) => {
		const error = normalizeError(event.reason);
		window.onerror?.(error.message, undefined, undefined, undefined, error);
	};

	window.onerror = async (_msg: string | Event, _src?: string, _line?: number, _column?: number, err?: Error) => {
		if (!err) return;
		const stackframes = await fromError(err);
		const frame = stackframes[0].source || stackframes[0].origin;
		const msg = err.message;
		const src = frame.fileName;
		const log: string[] = [];
		log.push(`错误文件: ${typeof src == "string" ? decodeURI(src).replace(lib.assetURL, "") : "未知文件"}`);
		log.push(`错误信息: ${msg}`);
		const tip = lib.getErrorTip(msg);
		if (tip) {
			log.push(`错误提示: ${tip}`);
		}
		log.push(`行号: ${frame.lineNumber}`);
		log.push(`列号: ${frame.columnNumber}`);
		const version = typeof lib.version != "undefined" ? lib.version : "";
		const match = version.match(/[^\d.]/) != null;
		log.push(`${match ? "游戏" : "无名杀"}版本: ${version || "未知版本"}`);
		if (lib.buildInfo == null) {
			log.push("构建信息: unknown");
		} else {
			const { channel, commit, builtAt } = lib.buildInfo;
			log.push(`构建通道: ${channel}`);
			log.push(`构建提交: ${commit}`);
			if (channel === "nightly") {
				log.push(`构建时间: ${builtAt}`);
			}
		}
		if (match) {
			log.push("⚠️您使用的游戏代码不是源于libnoname/noname无名杀官方仓库，请自行寻找您所使用的游戏版本开发者反馈！");
		}
		log.push(getStatusInfo({ lib, get, _status }));
		log.push("-------------");
		const errorReporter = ErrorManager.getErrorReporter(err);
		if (errorReporter) {
			game.print(errorReporter.report(log.join("\n") + "\n代码出现错误"));
		} else {
			if (typeof frame.lineNumber == "number" && (typeof game.readFile == "function" || location.origin != "file://")) {
				/**
				 * @param code 源代码
				 * @param line 代码报错行数
				 */
				const createShowCode = (code: string, line: number) => {
					const lines = code.split("\n");
					const showCode: string[] = [];
					// 10行窗口
					for (let i = Math.max(0, line - 5); i < line + 6 && i < lines.length; i++) {
						showCode.push(`${i + 1}| ${line == i + 1 ? "⚠️" : ""}${lines[i]}`);
					}
					showCode.push("-------------");
					return showCode;
				};
				// 解析step content的错误
				if (frame.functionName === "packStep") {
					const codes = _status.event.content.originals[_status.event.step];
					if (typeof codes == "function") {
						const regex = /<anonymous>:(\d+):\d+/;
						const match = err.stack?.split("\n")[1].match(regex);
						if (match) {
							log.push(...createShowCode(codes.toString(), parseInt(match[1])));
						}
					}
				}
				// 协议名须和html一致(网页端防跨域)，且文件是js
				else if (typeof src == "string" && src.startsWith(location.protocol) && src.endsWith(".js")) {
					//获取sourcemap
					try {
						const source = stackframes[0].source;
						if (!source?.fileName) throw new Error();

						let rawSourceMap = await lib.init.promises.req(src + ".map");
						if (!rawSourceMap) throw new Error();
						const sourceMap = JSON.parse(rawSourceMap);

						function relativeUrl(from: string, to: string): string {
							try {
								const fromUrl = new URL(from);
								const toUrl = new URL(to);

								if (fromUrl.origin !== toUrl.origin) {
									// 不同域名没法相对，直接返回绝对路径
									return to;
								}

								const fromParts = fromUrl.pathname.split("/").filter(Boolean);
								const toParts = toUrl.pathname.split("/").filter(Boolean);

								// 找到公共前缀长度
								let i = 0;
								while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
									i++;
								}

								const backSteps = fromParts.length - i;
								const relativeParts = [...Array(backSteps).fill(".."), ...toParts.slice(i)];

								return relativeParts.join("/") || toParts[toParts.length - 1];
							} catch {
								return to;
							}
						}

						const file = relativeUrl(src, source.fileName);
						const content = sourceMap.sourcesContent[sourceMap.sources.indexOf(file)];

						log.push(...createShowCode(content, frame.lineNumber || 0));
					} catch (e) {
						let code = await lib.init.promises.req(src);
						if (code) log.push(...createShowCode(code, frame.lineNumber || 0));
					}
				}
			}
			if (err && err.stack) {
				log.push(`${err.name}: ${err.message}`);
				log.push(
					...stackframes.map(frame => {
						const f = frame.source || frame.origin;
						return `    at ${f.functionName || "(anonymous)"} (${decodeURI(f.fileName || "").replace(new RegExp(lib.assetURL, "g"), "")}:${f.lineNumber}:${f.columnNumber})`;
					})
				);
			}
			reportError(log.join("\n"));
			game.print(log.join("\n"));
		}
	};
}
