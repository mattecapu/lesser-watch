import createLogFunction from 'loggety-mclogface';

const TAG_OPTIONS = { tag: 'lesser-watch', uppercase: false };

export const info =
	createLogFunction({ type: 'info', color: 'yellow', ...TAG_OPTIONS});

export const error =
	createLogFunction({ type: 'error', color: 'red', ...TAG_OPTIONS});
