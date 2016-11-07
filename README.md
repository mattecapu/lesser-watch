# lesser-watch
### watch LESS files and selectively recompiles them whenever (directly or indirectly) @import-ed files change

## Motivation
This package provides a smarter way to watch LESS files.
If you like your stylesheets to be DRY and modular
Yet not *all* of the stylesheets will import a file.
So you can watch your entire `styles/` directory and recompile all of your "root" files everytime something changes (which is unefficient if you have a large codebase and *literally hell* if you use something like `livereload`), or **you can do it better by selectively recompile only those "root" files which are affected by the change**. This is exactly what `lesser-watch` does.

## Installation
```
$ npm install lesser-watch --save-dev
```
This is a CLI tool, so you might want it installed globally.
Anyway, **`lesser-watch` expects LESS to be installed in the same directory it is installed**, be it local or global.

## Usage
Get usage information by running `lesser-watch --help`:
```
lesser-watch <command> [options]

Commands:
  lesser-watch  watch LESS files and selectively recompiles them whenever (directly or indirectly) @import-ed files change

Options:
  --version      Show version number  [boolean]
  -h, --help     Show help  [boolean]
  -c, --command  The command to execute to recompile a file.
                 The command will receive the file contents from stdin and its stdout will get piped to the output file
                 Useful if you have a non-trivial build pipeline (e.g. 'lessc - | postcss') or if you need to provide options to LESS. If you need to provide the filename as an argument, the placeholder {path} will be replaced with that at runtime.
				         [default: "node_modules/.bin/lessc -"]
  -e, --entries  Entry files. Any of them will recompile if one of its direct or indirect dependencies gets updated
                 [array] [required]
  -d, --dest     Destination folder. Compiled files are put here
                 [required]
  -p, --polling  If set to 0, disable polling. Otherwise, watch with polling using the interval provided (in milliseconds)
                 [default: 0]

Examples:
  lesser-watch -c 'lessc --source-map-map-inline -x' -e main.less -d static

  Watch main.less dependencies and recompile with flags --source-map-map-inline and -x


  lesser-watch -c 'lessc --source-map-map-inline | postcss --map | exorcist {path}.map' -e main.less critical.less -d static

	Watch main.less and critical.less. Recompile creating sourcemaps and then save them as main.less.map and critical.less.map

```
The underlying watching is done by the awesome [`chokidar`](https://npmjs.com/package/chokidar). The CLI logic is handled by the even more awesome [`yargs`](https://npmjs.com/package/yargs).

## License
MIT
