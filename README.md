# fast-grid - [Try it!](fast-grid.vercel.app)

The most performant DOM-based grid. Resuses parts of DOM-tree to reduce expensive DOM mutations, and has it's own event loop to prioritize tasks to never drop a frame. <br>
It has a non-passive scroller, so rows will never be seen rows loading into the UI. <br>
The virtualization and scrolling is custom built to get past browsers 15 million pixel div height limit.

### One million rows benchmark (Air M2) 
| Benchmark | Score |
| --- | --- |
| Scroll 40 rows every frame | 60fps |
| Filtering | 110ms |
| Time to initialize and show rows | 1.5ms |
| Scroll 40 rows every frame + filter same time every 300ms | 45fps |

### Disclaimers
1) Number of rows is limited by memory only. See how many you can generate! (might make page crash)
2) Can't filter/sort at the same time yet
3) Sorting/reversing is blocking main thread atm

### TODO features/performance
- make a synthetic event-loop for prioritizing filter vs row rendering vs scrolling
- scrolling one viewport every frame while filtering a million rows runs at 40fps (macbook air m2), figure out why
- support filter + sort at same time
- text selection - make sure ordering of rows is correct
- chunk up sorting so it's not blocking main thread

### TODO npm packaging
- break out filtering into own package
- detach scrollbar from logic
- clean up code/rename
- publish npm package
