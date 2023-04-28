# fast-grid

The most performant DOM-based grid. Has the least DOM mutations possible by reusing parts of DOM-tree, and has it's own event loop to prioritize tasks, in order to never drop a frame.

### One million rows benchmark (Air M2) 
| Benchmark | Score |
| --- | --- |
| Scroll full viewport every frame | 60fps |
| Filtering | 110ms |
| Grid initialization and render: | 1.5ms |
| Scroll + filter same time every 300ms: | 45fps |

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
