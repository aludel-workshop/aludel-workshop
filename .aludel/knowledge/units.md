# Code units

A unit is a top-level function, class (an Angular component is marked), constant, route entry, HTTP handler, SQL table or test in one file. Units never span files.

Aludel reads units at a commit with the TypeScript parser, from `src/`, `server/` and `tests/`. Each has a stable key, `path#symbol`, with a number when a file declares the same symbol twice. A unit is **used** when something starting from the entry files or a test calls it, and **unused** when nothing does.
