import chalk from "chalk";
import { accessSync, constants, copyFileSync, existsSync, mkdirSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";
import { Action, MatchMode } from "./constants.js";
import { CrossSeedError } from "./errors.js";

const require = createRequire(import.meta.url);
const packageDotJson = require("../package.json");

export interface FileConfig {
	action?: Action;
	pconfigVersion?: number;
	delay?: number;
	includeSingleEpisodes?: boolean;
	outputDir?: string;
	rtorrentRpcUrl?: string;
	includeNonVideos?: boolean;
	seasonFromEpisodes?: number;
	fuzzySizeThreshold?: number;
	excludeOlder?: string;
	excludeRecentSearch?: string;
	dataDirs?: string[];
	matchMode?: MatchMode;
	skipRecheck?: boolean;
	autoResumeMaxDownload?: number;
	linkDir?: string;
	linkType?: string;
	flatLinking?: boolean;
	maxDataDepth?: number;
	linkCategory?: string;
	torrentDir?: string;
	torznab?: string[];
	qbittorrentUrl?: string;
	transmissionRpcUrl?: string;
	delugeRpcUrl?: string;
	duplicateCategories?: boolean;
	notificationWebhookUrl?: string;
	port?: number;
	host?: string;
	searchCadence?: string;
	rssCadence?: string;
	snatchTimeout?: string;
	searchTimeout?: string;
	searchLimit?: number;
	blockList?: string[];
	apiKey?: string;
	sonarr?: string[];
	radarr?: string[];
}

export const UNPARSABLE_CONFIG_MESSAGE = `
Your config file is improperly formatted. The location of the error is above, \
but you may have to look backwards to see the root cause.
Make sure that
  - strings (words, URLs, etc) are wrapped in "quotation marks"
  - any arrays (lists of things, even one thing) are wrapped in [square brackets]
  - every entry has a comma after it, including inside arrays
`.trim();

export function appDir(): string {
	const appDir =
		process.env.CONFIG_DIR ||
		(process.platform === "win32"
			? path.resolve(process.env.LOCALAPPDATA!, packageDotJson.name)
			: path.resolve(process.env.HOME!, `.${packageDotJson.name}`));
	try {
		accessSync(appDir, constants.R_OK | constants.W_OK);
	} catch (e) {
		if (e.code === "ENOENT") {
			return appDir;
		}
		const dockerMessage =
			process.env.DOCKER_ENV === "true"
				? ` Use chown to set the owner to ${process.getuid!()}:${process.getgid!()}`
				: "";
		throw new CrossSeedError(
			`cross-seed does not have R/W permissions on your config directory.${dockerMessage}`,
		);
	}
	return appDir;
}

export function createAppDir(): void {
	mkdirSync(path.join(appDir(), "torrent_cache"), { recursive: true });
	mkdirSync(path.join(appDir(), "logs"), { recursive: true });
}

export function generateConfig(): void {
	createAppDir();
	const dest = path.join(appDir(), "config.js");
	const templatePath = path.join("./config.template.cjs");
	if (existsSync(dest)) {
		console.log("Configuration file already exists.");
		return;
	}
	copyFileSync(new URL(templatePath, import.meta.url), dest);
	console.log("Configuration file created at", chalk.yellow.bold(dest));
}

export async function getFileConfig(): Promise<FileConfig> {
	if (process.env.DOCKER_ENV === "true") {
		generateConfig();
	}

	const configPath = path.join(appDir(), "config.js");

	try {
		return (await import(pathToFileURL(configPath).toString())).default;
	} catch (e) {
		if (e.code === "ERR_MODULE_NOT_FOUND") {
			return {};
		} else if (e instanceof SyntaxError) {
			const location = e.stack!.split("\n").slice(0, 3).join("\n");
			throw new CrossSeedError(
				`\n${chalk.red(location)}\n\n${UNPARSABLE_CONFIG_MESSAGE}`,
			);
		} else {
			throw e;
		}
	}
}
