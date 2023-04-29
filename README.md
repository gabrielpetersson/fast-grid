# fast-grid - [Try it!](https://fast-grid.vercel.app)

### Capabilites
- Render _any_ number of rows, you are only limited by RAM. 
- Instant results on filtering millions of rows
- 60 fps while cruising the scrollbar

### Technical details
The most performant DOM-based grid.
- Resuses parts of DOM-tree to reduce expensive DOM mutations.  
- Own event loop to prioritize tasks. Never drops a frame
- Non-passive scrolling. Rows will never be seen rows loading into the UI while scrolling
- Custom virtualization and scrolling. Not limited by browsers 15 million pixel div height limit

### One million rows benchmark (Air M2) 
| Benchmark | Score |
| --- | --- |
| Scroll 40 rows every frame | 60fps |
| Filtering | 110ms |
| Time to initialize and show rows | 1.5ms |
| Scroll 40 rows every frame + filter same time every 300ms | 45fps |

### Disclaimers
In the example, sorting is still blocking main thread, meaning it drops frames. Adding to the custom event loop soon

### TODO features/performance
- expand synthetic event-loop to include scrolling & rendering cell contents
- scrolling one viewport every frame while filtering a million rows runs at 40fps (macbook air m2), figure out why
- support filter + sort at same time
- text selection - make sure ordering of rows in the DOM is correct
- chunk up sorting so it's not blocking main thread

### TODO npm packaging
- break out filtering into own package
- detach scrollbar from logic
- clean up code/rename
- publish npm package
