# lesser-watch
### watch LESS files and intelligently recompiles following the dependency graph

## Installation
```
$ npm install lesser-watch --save
```
This is a CLI tool, so you might want it installed globally.

## Usage
Get usage information by running `lesser-watch --help`:
```
lesser-watch <command> [options]

Commands:
  lesser-watch  watch LESS files and selectively recompile when imported files change

Options:
  --version      Show version number  [boolean]
  -h, --help     Show help  [boolean]
  -c, --command  The command to execute to recompile a file.
                 The command will receive the file contents from stdin and its stdout will get piped to the output file
                 Useful if you have a non-trivial build pipeline (e.g. 'lessc - | postcss') or if you need to provide options to LESS
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

```

## License
MIT
