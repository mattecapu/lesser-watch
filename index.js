#! /usr/bin/env node


'use strict';

var _flatten = require('ramda/src/flatten');

var _flatten2 = _interopRequireDefault(_flatten);

var _uniq = require('ramda/src/uniq');

var _uniq2 = _interopRequireDefault(_uniq);

var _zipObj = require('ramda/src/zipObj');

var _zipObj2 = _interopRequireDefault(_zipObj);

var _debounce = require('debounce');

var _debounce2 = _interopRequireDefault(_debounce);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

var _getDependencyTree = require('get-dependency-tree.js');

var _getDependencyTree2 = _interopRequireDefault(_getDependencyTree);

var _child_process = require('child_process');

var _safe = require('colors/safe');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var log = function log(arg) {
	return console.error((0, _safe.yellow)("[lesser-watcher]"), (0, _safe.yellow)(arg.toString()));
};

var argv = require('yargs').command('watch-less -o [less options..] -e [entry files..] -d [output dir]', 'watch LESS files and selectively recompile when imported files changes').help().alias('o', 'options').describe('options', 'Options to pass to LESS').alias('e', 'entries').describe('entries', 'Entry files. Any of them will recompile if one of its direct or indirect dependencies gets updated').alias('d', 'dest').describe('dest', 'Destination folder. Compiled files are output there, reflecting the source folder structure').argv;

var lessOptions = argv.options;
var entryFiles = argv.entries;
var destDir = argv.dest;

/* Map<File, DepsList> */
var flattenedDepTrees = (0, _zipObj2.default)(entryFiles, entryFiles.map(_getDependencyTree2.default));

/* all the dependencies, deduped */
var depsFiles = (0, _uniq2.default)((0, _flatten2.default)(flattenedDepTrees));

/* Map<source filename, compiled filename> */
var buildNames = (0, _zipObj2.default)(entryFiles, entryFiles.map(function (file) {
	return path.join(destDir, path.basename(file).replace('.less', '.css'));
}));

var compileFile = function compileFile(file) {
	log('Recompiling ' + file + '...');

	var writeStream = fs.createWriteStream(buildNames[file]);

	var command = (0, _child_process.spawn)('node_modules/.bin/lessc', lessOptions, { stdio: ['ignore', writeStream, 'pipe'] });

	command.on('close', function () {
		log('Done');
	});
	command.on('error', function (error) {
		console.error('An error occurred while recompiling ' + file, error.stack);
	});
};

/* per-file debouncing of compilation */
var debouncedCompilationFunctions = entryFiles.map(function (file) {
	return (0, _debounce2.default)(function () {
		return compileFile(file);
	}, 200);
});
var debouncedCompileFile = function debouncedCompileFile(file) {
	return debouncedCompilationFunctions[file]();
};

/* watch dependencies */
var DepsWatcher = _chokidar2.default.watch(depsFiles, { persistent: true });
/* watch entries */
var EntriesWatcher = _chokidar2.default.watch(entryFiles, { persistent: true });

var errorCallback = function errorCallback(error) {
	console.error('An error occurred watching files:', error.message);
};

EntriesWatcher.on('change', function (file) {
	flattenedDepTrees[file] = (0, _getDependencyTree2.default)(file);
	debouncedCompileFile(file);
}).on('error', errorCallback);

DepsWatcher.on('change', function (file) {
	entryFiles.filter(function (entry) {
		return ~flattenedDepTrees[entry].indexOf(file);
	}).forEach(debouncedCompileFile);
}).on('error', errorCallback);

