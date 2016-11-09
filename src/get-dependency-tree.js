import fs from 'fs';
import path from 'path';

import R from 'ramda';

import { error } from './loggers';

/* find any statement like "@import (<modifier>) '<path>';" */
const importsRegex = /@import\s(\(\w+\)\s)?'([\.\/a-z_\-]+)';/;

/* resolve an import path wrt the file it was imported from */
const getPath = (file) =>
	path.resolve(
		path.dirname(file.parent),
		file.file
	);

const getFileImportedPaths = (file) => {
	const resolvedPath = getPath(file);
	try {
		const source = fs.readFileSync(resolvedPath, 'utf8');
		return source.split("\n")
			/* fast filter to optimize for large files */
			.filter(line => line.startsWith('@'))
			/* get matches */
			.map(line => importsRegex.exec(line))
			.filter(matches => !!matches)
			/* return a deps object */
			.map(([ _, __, path ]) =>
				({
					file: path,
					parent: resolvedPath
				})
			);
	} catch(error) {
		/* resolution failed, probably not a file (i.e. URL) */
		error(`Can't open '${getPath(file)}', skipping... (error: '${error.message}')`);
		return [];
	}
};

/* union + quotient by relationship 'has the same path of' */
const uniteByPath = R.unionWith((a, b) => getPath(a) === getPath(b));

/* DFS for file deps */
export default function getFlattenedDependencyTree(file) {
	let deps = [];
	let queue = [{
		parent: file,
		file: path.basename(file)
	}];

	const rootPath = getPath(queue[0]);

	let current;
	let currentPath;

	do {
		current = queue.pop();
		currentPath = getPath(current);

		/* skip if we visited this already */
		if (!~deps.indexOf(currentPath)) {
			/* really new dep */
			deps.push(currentPath);
			/* add new deps to queue, without files already in queue */
			queue = uniteByPath(
				queue,
				getFileImportedPaths(current)
			);
		}
	} while(queue.length);

	return deps.filter(x => x !== rootPath);
}
