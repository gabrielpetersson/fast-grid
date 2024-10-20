# World's most performant web table - [Try it!](https://fast-grid.vercel.app)

A multithreaded web table, capable of running 120fps while sorting/filtering/scrolling simultaneously

### Capabilites

- Multithread sorting/filtering using a shared array buffer
- Display millions rows at O(1), you are only limited by browser RAM
- 120 fps while cruising the scrollbar
- Never drop a frame while filtering or sorting

### Technical details

The most performant DOM-based grid.

- Uses a shared array buffer to store order/filtering of rows, computed in a web worker off-thread
- Resuses all part of DOM-tree
- Own event loop to prioritize tasks. Never drops a frame, even when filtering millions of rows
- Non-passive scrolling. Rows will never be seen rows loading into the UI while scrolling
- Custom virtualization and scrolling. Not limited by browsers 15 million pixel div height limit
- Custom built scrolling for phones, and runs at 60fps even on older phones

### One million rows benchmark (M2 Max Pro)

| Benchmark                              | Score  |
| -------------------------------------- | ------ |
| Scroll 40 rows every frame             | 120fps |
| Filtering                              | 200ms  |
| Time to initialize grid and show rows  | 1.5ms  |
| Filter&sort simultaneously every 300ms | 120fps |

zero copy datatype

### TODO
- iphone safari has a very low memory limit - disable multithreading there
- expand synthetic event-loop to include scrolling & rendering cell contents
- can maybe make GC be a bit less expensive by reusing cell classes more..
- if user zoomed in/out scrollbar will navigate to fast/slow, needs to be relative to the scroll track
- sort/filter all columns, not just second lol
- resize columns
- custom cells (you can kinda already do this though, just add a new cell class)
- make sure rows are ordered correctly for text selection
