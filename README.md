# fast-grid

Try to make the FPS drop in the bottom right. If that is too hard, try x6 cpu slowdown in devtools. To see how smooth it is - filter while on auto scroll, which scrolls a full viewport every frame

Disclaimers:
1) Number of rows is limited by memory only. See how many you can generate! (might make page crash)
2) Can't filter/sort at the same time yet
3) Sorting/reversing is blocking main thread atm

## TODO features/performance
- make a synthetic event-loop for prioritizing filter vs row rendering vs scrolling
- scrolling one viewport every frame while filtering a million rows runs at 40fps (macbook air m2), figure out why
- support filter + sort at same time
- text selection - make sure ordering of rows is correct

## TODO npm packaging
- break out filtering into own package
- detach scrollbar from logic
- clean up code/rename
- make npm package
