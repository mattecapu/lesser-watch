#! /usr/bin/env node

'use strict';

import R from 'ramda';
import debounce from 'debounce';

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

import chokidar from 'chokidar';
import getFlattenedDependencyTree from './get-dependency-tree';

import { info, error } from './loggers';

const argv = require('yargs')
	/* command syntax description */
	.usage('lesser-watch <command> [options]')
	.command(
		'lesser-watch',
		"watch LESS files and selectively recompiles them whenever (directly or indirectly) @import-ed files change"
	)
	/* mandatory args */
	.demand([ 'entries', 'dest' ])
	/* print usage on '--help' */
	.help()
	.alias('h', 'help')

	.version()

	.alias('c', 'command')
	.describe(
		'command',
		"The command to execute to recompile a file.\n" +
		"The command will receive the file contents from stdin and its stdout will get piped to the output file\n" +
		"Useful if you have a non-trivial build pipeline (e.g. 'lessc - | postcss') or if you need to provide options to LESS. If you need to provide the source filename as an argument, the env variable SOURCE_FILE_PATH will be set to that when calling the provided command."
	)
	.default('command', 'node_modules/.bin/lessc -')

	.alias('e', 'entries')
	.describe(
		'entries',
		"Entry files. Any of them will recompile if one of its direct or indirect dependencies gets updated"
	)
	.array('entries')

	.alias('d', 'dest')
	.describe(
		'dest',
		'Destination folder. Compiled files are put here'
	)

	.alias('p', 'polling')
	.describe(
		'polling',
		"If set to 0, disable polling. Otherwise, watch with polling using the interval provided (in milliseconds)"
	)
	.default('polling', 0)

	.example(
		`lesser-watch -c 'lessc -x -' -e main.less page.less -d static`,
		"Watch main.less and page.less and their dependencies, recompile with the provided command (notice the '-' to make lessc read from stdin).\n" +
		"Built files main.css and page.css will be created in the folder 'static'."
	)
	.example(
		`lesser-watch -c 'lessc --source-map-map-inline | postcss --map | exorcist static/\`basename $SOURCE_FILE_PATH\`.map' -e main.less critical.less -d static`,
		"Watch main.less and critical.less. Recompile creating sourcemaps and then save them as main.less.map and critical.less.map"
	)

	.argv;

let entryFiles = argv.entries;
const command = argv.command;
const destDir = argv.dest;
const polling = argv.polling;

/* Map<entry file, dependencies list> */
const flattenedDepTrees =
	R.zipObj(
		entryFiles,
		entryFiles.map(getFlattenedDependencyTree)
	);

/* Map<source filename, compiled filename> */
const buildNames =
	R.zipObj(
		entryFiles,
		entryFiles.map(file => path.join(destDir, path.basename(file).replace('.less', '.css')))
	);

const compileFile = (file) => {
	const inputStream =
		fs.createReadStream(file);
	const outputStream =
		fs.createWriteStream(buildNames[file]);

	const compilationCommand = spawn(
		command,
		[],
		{
			env: { ...process.env, SOURCE_FILE_PATH: file },
			shell: true
		}
	);

	inputStream.pipe(compilationCommand.stdin);
	compilationCommand.stdout.pipe(outputStream);
	compilationCommand.stderr.pipe(process.stderr);

	compilationCommand
		.on('close', () =>
			info(`Done with ${file}`)
		)
		.on('error', (error) =>
			console.error(`An error occurred while recompiling ${file}`, error.stack)
		);
};

/* per-file debouncing of compilation */
const debouncedCompilationFunctions =
	R.zipObj(
		entryFiles,
		entryFiles.map(file => debounce(() => compileFile(file), 200))
	);
const debouncedCompileFile = (file) =>
	debouncedCompilationFunctions[file]();

/* all the dependencies, deduped */
const getAllDepsFiles = () =>
	R.uniq(R.flatten(R.values(flattenedDepTrees)));
let depsFiles = getAllDepsFiles();

const watcherOptions = {
	persistent: true,
	usePolling: polling || false,
	interval: polling || 100
};

/* watch entries */
const EntriesWatcher =
	chokidar.watch(entryFiles, watcherOptions);
/* watch dependencies */
const DepsWatcher =
	chokidar.watch(depsFiles, watcherOptions);

const errorCallback = (error) =>
	console.error('An error occurred watching files:', error.message);

info(`Starting...`);
if (command) {
	info(`Using the following compiling pipeline: ${command}`);
}
if (polling) {
	info(`Using polling with interval ${polling || 100}ms`);
}

EntriesWatcher
	.on('ready', () =>
		info(`Watching ${entryFiles.length} entry files...`)
	)
	.on('change', (file) => {
		info(`Change detected in entry file: ${file}.`);
		info(`Recompiling ${file}...`);

		/* update dependencies */
		const newDeps = getFlattenedDependencyTree(file);
		const oldDeps = flattenedDepTrees[file];

		const addedDeps = R.difference(newDeps, depsFiles);
		const removedDeps = R.difference(oldDeps, newDeps);

		flattenedDepTrees[file] = newDeps;
		depsFiles = getAllDepsFiles();

		if (addedDeps.length) {
			info(`Watching new deps: ${addedDeps.join(' ')}...`);
			DepsWatcher.add(addedDeps);
		}
		if (removedDeps.length) {
			info(`Unwatching dropped deps: ${removedDeps.join(' ')}...`);
			DepsWatcher.unwatch(removedDeps);
		}

		debouncedCompileFile(file);
	})
	.on('unlink', (file) => {
		/* remove stuff associated with the file */
		delete flattenedDepTrees[file];
		delete buildNames[file];
		delete debouncedCompilationFunctions[file];

		entryFiles = entryFiles.filter(x => x !== file);
	})
	.on('error', errorCallback);

DepsWatcher
	.on('ready', () =>
		info(`Watching ${depsFiles.length} deps...`)
	)
	.on('change', (file) => {
		info(`Change detected in dep: ${file}.`);
		entryFiles
			.filter(entry => ~flattenedDepTrees[entry].indexOf(file))
			.map(R.tap((file) => info(`Recompiling ${file}...`)))
			.forEach(debouncedCompileFile)
	})
	.on('error', errorCallback);

