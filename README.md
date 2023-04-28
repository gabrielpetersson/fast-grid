# fast-grid

Pushing the limits of how fast a web-table can render and filter rows.

## Todo
- make into npm package
- scrolling one viewport every frame while filtering a million rows runs at 40fps (macbook air), figure out why
- support filter + sort at same time
- text selection - make sure ordering of rows is correct
- make a synthetic event-loop for prioritizing filter vs row rendering vs scrolling
