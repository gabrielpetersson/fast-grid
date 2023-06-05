# fast-grid - [Try it!](https://fast-grid.vercel.app)

An experiment (and soon NPM package) for how performant a web-table can possibly be

### Capabilites
- Display unlimited rows at O(1), you are only limited by RAM  
- Instant results on filtering millions of rows
- 60 fps while cruising the scrollbar
- TODO: publish npm package

### Technical details
The most performant DOM-based grid. 
- Resuses parts of DOM-tree to reduce expensive DOM mutations
- Own event loop to prioritize tasks. Never drops a frame, even when filtering millions of rows
- Non-passive scrolling. Rows will never be seen rows loading into the UI while scrolling
- Custom virtualization and scrolling. Not limited by browsers 15 million pixel div height limit 
- Custom built scrolling for phones, and runs at 60fps even on older phones

### One million rows benchmark (Air M2) 
| Benchmark | Score |
| --- | --- |
| Scroll 40 rows every frame | 60fps |
| Filtering | 110ms |
| Time to initialize grid and show rows | 1.5ms |
| Scroll 40 rows every frame + filter same time every 300ms | 45fps |

### Need an even more performant table?
This is the most performant _DOM-based_ table. The fastest table ever built (by far), directly using the GPU and streaming rows efficiently from a custom DB, is [dataland.io](https://dataland.io/). It can render billions of rows at ~5x FPS versus a DOM-based table. 

### Disclaimers
In the example web-app, sorting is still blocking main thread, meaning it drops frames. Adding to the custom event loop soon.
Also you cannot sort and filter at the same time, a TODO but figuring out how I can do this off-thread and potentially in wasm with a zero copy datatype

### TODO before npm launch
- break out filtering into its own package
- config for sort/filter for all columns
- detach scrollbar from logic, & isolate logic in general
- modify cells
- resize columns
- custom cells
- make sure rows are ordered correctly for text selection
- publish npm package

### TODO features/performance
- expand synthetic event-loop to include scrolling & rendering cell contents
- make scrolling one viewport every frame while filtering a million rows at the same time run 40fps (macbook air)
- support filter + sort at same time
- chunk up sorting so it's not blocking main thread


