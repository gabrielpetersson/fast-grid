import clsx from "clsx";
import Stats from "stats.js";
import { Analytics } from "@vercel/analytics/react";
import { FilterCell, Grid } from "@repo/fast-grid";
import "@repo/fast-grid/style.css";
import { COLUMNS, generateRows } from "./generateRows";
import { useState, useRef, useEffect } from "react";

export const FastGrid = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [grid, setGrid] = useState<Grid | null>(null);
  const [speed, setSpeed] = useState(0);
  const [rowCount, setRowCount] = useState(100_000);
  const [stressTest, setStressTest] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [autoScroller, setAutoScroller] = useState<AutoScroller | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) {
      return;
    }

    // init grid
    const t0 = performance.now();
    const grid = new Grid(container, [], COLUMNS);
    setGrid(grid);
    console.info("Ms to intitialize grid:", performance.now() - t0);

    setLoadingRows(true);
    generateRows(rowCount, grid, () => setLoadingRows(false));

    // setup autoscroller
    const autoScroller = new AutoScroller(grid);
    setAutoScroller(autoScroller);
    (window as any).__grid = grid;
    return () => {
      grid.destroy();
    };
  }, [rowCount]);

  useEffect(() => {
    if (grid == null || !stressTest) return;
    const id = setInterval(() => {
      const filters = grid.rowManager.view.filter;

      if (filters[4] == null || filters[4].length < 5) {
        filters[4] =
          (filters[4] ?? "") + Math.floor(Math.random() * 10).toString();
      } else {
        delete filters[4];
      }

      // manually trigger refresh of filter cells.. make it part of updating the filter
      for (const header of grid.headerRows) {
        for (const cell of Object.values(header.cellComponentMap)) {
          if (cell instanceof FilterCell) {
            if (cell.index === 4) {
              cell.el.style.backgroundColor = "rgb(239, 68, 68)";
              cell.input.style.backgroundColor = "rgb(239, 68, 68)";
              cell.input.style.color = "white";
              cell.input.placeholder = "";
              cell.arrow.style.fill = "white";
              cell.syncToFilter();
            }
          }
        }
      }

      grid.rowManager.runFilter();
    }, 333);
    return () => {
      // manually trigger refresh of filter cells.. make it part of updating the filter
      for (const header of grid.headerRows) {
        for (const cell of Object.values(header.cellComponentMap)) {
          if (cell instanceof FilterCell) {
            if (cell.index === 4) {
              delete grid.rowManager.view.filter[4];
              cell.el.style.backgroundColor = "white";
              cell.input.style.backgroundColor = "white";
              cell.input.style.color = "black";
              cell.input.placeholder = "filter...";
              cell.arrow.style.fill = "black";
              cell.syncToFilter();
            }
          }
        }
      }
      grid.rowManager.runFilter();
      clearInterval(id);
    };
  }, [grid, stressTest]);

  useEffect(() => {
    if (autoScroller == null) return;
    autoScroller.start(speed === 0 ? 0 : Math.exp(speed / 15));
  }, [autoScroller, speed]);

  return (
    <>
      <Analytics />
      <h1 className="self-start text-lg font-bold sm:self-center md:text-3xl">
        World's most performant DOM-based table
      </h1>
      <div className="mt-1 self-start max-md:mt-2 sm:self-center">
        Try make the fps counter drop by filtering, sorting, and scrolling
        simultaneously
      </div>
      <div className="mb-4 mt-1 self-start text-sm max-md:mt-2 sm:self-center sm:text-[13px]">
        See code:
        <a
          className="ml-1 text-blue-600 underline hover:text-blue-800"
          href="https://github.com/gabrielpetersson/fast-grid/"
        >
          https://github.com/gabrielpetersson/fast-grid/
        </a>
      </div>

      <div
        className={clsx(
          "flex w-full select-none flex-wrap justify-between gap-2 py-2",
          loadingRows && "pointer-events-none select-none opacity-60"
        )}
      >
        <div className="hidden w-[150px] md:block" />

        <div className="flex gap-2 text-[11px] md:gap-8 md:text-[13px]">
          <div className="flex items-center">
            <span className="mr-2 whitespace-nowrap">Scroll speed:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className={clsx(
                "h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-300",
                speed === 100 &&
                  "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-red-500 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500"
              )}
            />
          </div>

          <button
            className={clsx(
              "flex h-[28px] w-[200px] items-center justify-center gap-0.5 rounded bg-blue-500 text-white hover:opacity-95 active:opacity-90",
              stressTest && "bg-red-500"
            )}
            onClick={() => {
              if (stressTest) {
                setStressTest(false);
                setSpeed(0);
              } else {
                setStressTest(true);
                setSpeed(100);
              }
            }}
          >
            {stressTest && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-[14px] w-[14px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            {stressTest ? "Filtering 3 times per second" : "Stress test"}
          </button>
        </div>

        <select
          value={rowCount}
          onChange={(e) => {
            if (grid == null) return;
            setRowCount(Number(e.target.value));
          }}
          className="hidden h-[28px] w-[150px] items-center justify-center rounded border border-gray-800 bg-white text-[12px] text-gray-700 shadow-[rgba(0,_0,_0,_0.1)_0px_0px_2px_1px] md:flex"
        >
          <option value={10}>10 rows</option>
          <option value={10_000}>10 000 rows</option>
          <option value={100_000}>100 000 rows</option>
          <option value={200_000}>200 000 rows</option>
          <option value={500_000}>500 000 rows</option>
          <option value={1_000_000}>
            1 000 000 rows (might run out of ram)
          </option>
          <option value={2_000_000}>
            2 000 000 rows (might run out of ram)
          </option>
          <option value={5_000_000}>
            5 000 000 rows (might run out of ram)
          </option>
          <option value={10_000_000}>
            10 000 000 rows (might run out of ram)
          </option>
        </select>
      </div>
      <div
        ref={containerRef} // attaching grid here
        style={{
          contain: "strict",
        }}
        className={clsx(
          "relative box-border w-full flex-1 overflow-clip border border-gray-700 bg-white",
          loadingRows && "pointer-events-none opacity-70"
        )}
      />
    </>
  );
};

const setupFPS = () => {
  const stats = new Stats();
  stats.showPanel(0);
  stats.dom.style.top = "unset";
  stats.dom.style.left = "unset";
  stats.dom.style.bottom = "0";
  stats.dom.style.right = "0";

  for (const child of stats.dom.children) {
    // @ts-expect-error ddd
    child.style.width = "160px";
    // @ts-expect-error ddd
    child.style.height = "96px";
  }

  document.body.appendChild(stats.dom);
  const animate = () => {
    stats.update();
    window.requestAnimationFrame(animate);
  };
  window.requestAnimationFrame(animate);
};
setupFPS();

class AutoScroller {
  grid: Grid;
  running: boolean;
  toBottom: boolean;
  version: number;
  constructor(grid: Grid) {
    this.grid = grid;
    this.running = true;
    this.toBottom = true;
    this.version = 0;
  }
  start(speed: number) {
    this.version++;

    const currentVersion = this.version;

    const cb = () => {
      const state = this.grid.getState();
      if (this.version !== currentVersion) {
        return;
      }

      if (
        this.grid.offsetY >
        state.tableHeight - this.grid.viewportHeight - 1
      ) {
        this.toBottom = false;
      } else if (this.grid.offsetY <= 0) {
        this.toBottom = true;
      }
      const delta = this.toBottom ? speed : -speed;

      const wheelEvent = new WheelEvent("wheel", {
        deltaY: delta,
        deltaMode: 0,
      });
      this.grid.container.dispatchEvent(wheelEvent);

      window.requestAnimationFrame(cb);
    };
    window.requestAnimationFrame(cb);
  }
}
