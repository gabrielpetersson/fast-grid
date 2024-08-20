import {
  useState,
  useRef,
  useEffect,
  FC,
  SetStateAction,
  Dispatch,
  FC,
} from "react";
import { FilterCell, Grid } from "grid";
import Stats from "stats.js";
import clsx from "clsx";
import { Analytics } from "@vercel/analytics/react";
import { COLUMNS, generateRows } from "./generateRows";

export const FastGrid = () => {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [autoScroller, setAutoScroller] = useState<AutoScroller | null>(null);
  const [isAutoScroll, setIsAutoScroll] = useState<boolean>(
    window.innerWidth > 1000
  );
  const [loadingRows, setLoadingRows] = useState<boolean>(false);
  const [isAutoFilter, setIsAutoFilter] = useState<boolean>(false);
  const [rowCount, setRowCount] = useState<number>(100_000);
  const containerRef = useRef<HTMLDivElement>(null);

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

    // misc
    (window as any).__grid = grid;
    setupFPS();

    // setup autoscroller
    const autoScroller = new AutoScroller(grid);
    setAutoScroller(autoScroller);
    return () => {
      grid.destroy();
      autoScroller.stop();
    };
  }, []);

  useEffect(() => {
    if (grid == null || !isAutoFilter) return;
    const id = setInterval(() => {
      const filters = grid.rowManager.view.filter;

      const updateFilter = (filter: string) => {
        if (filter.length < 5) {
          return filter + Math.floor(Math.random() * 10).toString();
        } else {
          return "";
        }
      };

      filters[4] = updateFilter(filters[4] || "");

      // manually trigger refresh of filter cells.. make it part of updating the filter
      for (const header of grid.headerRows) {
        for (const cell of Object.values(header.cellComponentMap)) {
          if (cell instanceof FilterCell) {
            cell.syncToFilter();
          }
        }
      }

      grid.rowManager.runFilter();
    }, 333);
    return () => clearInterval(id);
  }, [grid, isAutoFilter]);

  useEffect(() => {
    if (grid == null) return;
    setLoadingRows(true);
    generateRows(rowCount, grid, () => setLoadingRows(false));
  }, [rowCount, grid]);

  useEffect(() => {
    if (autoScroller == null) return;
    isAutoScroll ? autoScroller.start() : autoScroller.stop();
  }, [autoScroller, isAutoScroll]);

  return (
    <>
      <Analytics />
      <h1 className="self-start text-xl font-bold lg:self-center lg:text-3xl">
        World's most performant DOM-based table
      </h1>
      <a
        className="self-start text-sm text-blue-600 underline hover:text-blue-800 lg:mt-2 lg:self-center"
        href="https://github.com/gabrielpetersson/fast-grid/"
      >
        {"https://github.com/gabrielpetersson/fast-grid/"}
      </a>
      <div className="flex h-6 items-center justify-center pt-1 text-[11px] leading-3 text-gray-800 lg:h-8 lg:pt-2">
        {isAutoFilter && isAutoScroll
          ? `The grid is now filtering ${rowCount
              .toLocaleString("en-US", {
                minimumFractionDigits: 0,
                useGrouping: true,
                currencyDisplay: "narrowSymbol",
                currency: "USD",
              })
              .replace(
                /,/g,
                " "
              )} rows every 300ms, while scrolling a full viewport every frame (16ms)`
          : null}
        {loadingRows ? "Generating rows..." : null}
      </div>
      <div
        className={clsx(
          box,
          "mt-2 flex h-[30px] w-full cursor-pointer select-none items-center justify-center rounded border border-gray-600 bg-blue-500 text-white hover:opacity-95 active:opacity-90 lg:hidden"
        )}
        onClick={() => {
          setIsAutoFilter(!(isAutoFilter && isAutoScroll));
          setIsAutoScroll(!(isAutoFilter && isAutoScroll));
        }}
      >
        Press here to max out the grid
      </div>
      <div
        className={clsx(
          "flex w-full select-none flex-wrap justify-between gap-2 py-2 text-[11px] text-white",
          loadingRows && "pointer-events-none select-none opacity-60"
        )}
      >
        <PrimaryButtons
          isAutoFilter={isAutoFilter}
          isAutoScroll={isAutoScroll}
          setIsAutoScroll={setIsAutoScroll}
          setIsAutoFilter={setIsAutoFilter}
        />
        <div className="flex h-[28px] flex-1 items-center justify-center text-[10px] text-black sm:text-xs md:text-[13px]">
          Challenge: make the fps counter in the bottom right corner drop by
          filtering / sorting / throttling cpu
        </div>
        <div className="flex w-[300px] justify-end">
          <select
            value={rowCount}
            onChange={(e) => setRowCount(Number(e.target.value))}
            className={clsx(
              "flex h-[28px] w-[150px] items-center justify-center rounded border border-gray-800 bg-white text-gray-700",
              box
            )}
          >
            <option value={10}>10 rows</option>
            <option value={10_000}>10 000 rows</option>
            <option value={100_000}>100 000 rows</option>
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
      </div>
      <div
        ref={containerRef} // attaching grid here
        style={{
          contain: "strict",
        }}
        className="relative box-border w-full flex-1 overflow-clip border border-gray-700 bg-white"
      />
    </>
  );
};

const box = "shadow-[rgba(0,_0,_0,_0.1)_0px_0px_2px_1px]";

interface PrimaryButtonsProps {
  isAutoFilter: boolean;
  isAutoScroll: boolean;
  setIsAutoScroll: Dispatch<SetStateAction<boolean>>;
  setIsAutoFilter: Dispatch<SetStateAction<boolean>>;
}
const PrimaryButtons: FC<PrimaryButtonsProps> = ({
  isAutoFilter,
  isAutoScroll,
  setIsAutoScroll,
  setIsAutoFilter,
}) => {
  return (
    <div className="flex w-[300px] gap-2">
      <Checkbox
        active={isAutoScroll}
        onClick={() => setIsAutoScroll((p) => !p)}
      >
        Auto scroll
      </Checkbox>
      <Checkbox
        active={isAutoFilter}
        onClick={() => setIsAutoFilter((p) => !p)}
      >
        Auto filter
      </Checkbox>
      <div
        onClick={() => {
          setIsAutoFilter(!(isAutoFilter && isAutoScroll));
          setIsAutoScroll(!(isAutoFilter && isAutoScroll));
        }}
        className={
          "hidden h-[28px] cursor-pointer items-center text-gray-800 hover:opacity-70 lg:flex lg:w-auto"
        }
      >
        {"← Turn on both!"}
      </div>
    </div>
  );
};

interface CheckboxProps {
  children: string;
  active: boolean;
  onClick: () => void;
}
const Checkbox: FC<CheckboxProps> = ({ children, active, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "flex h-[28px] w-[150px] cursor-pointer rounded border border-gray-800 lg:w-[70px]",
        box
      )}
    >
      <div
        className={clsx(
          "flex flex-1 items-center justify-center",
          active ? "bg-red-500" : "text-gray-700"
        )}
      >
        {children}
      </div>
    </div>
  );
};

const setupFPS = () => {
  const stats = new Stats();
  stats.showPanel(0);
  stats.dom.style.top = "unset";
  stats.dom.style.left = "unset";
  stats.dom.style.bottom = "0";
  stats.dom.style.right = "0";
  document.body.appendChild(stats.dom);
  const animate = () => {
    stats.update();
    window.requestAnimationFrame(animate);
  };
  window.requestAnimationFrame(animate);
};

class AutoScroller {
  grid: Grid;
  running: boolean;
  toBottom: boolean;
  constructor(grid: Grid) {
    this.grid = grid;
    this.running = true;
    this.toBottom = true;
  }
  start() {
    this.running = true;
    const cb = () => {
      const state = this.grid.getState();
      if (!this.running) {
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

      // const delta = this.toBottom
      //   ? this.grid.viewportHeight
      //   : -this.grid.viewportHeight;

      const delta = this.toBottom ? 2 : -2;

      const wheelEvent = new WheelEvent("wheel", {
        deltaY: delta,
        deltaMode: 0,
      });
      this.grid.container.dispatchEvent(wheelEvent);

      window.requestAnimationFrame(cb);
    };
    window.requestAnimationFrame(cb);
  }
  stop() {
    this.running = false;
  }
}
