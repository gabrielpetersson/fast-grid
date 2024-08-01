import {
  useState,
  useRef,
  useEffect,
  FC,
  SetStateAction,
  Dispatch,
  ReactNode,
} from "react";
import { Cell, Grid, Row } from "grid";
import Stats from "stats.js";
import clsx from "clsx";
import { isTimeToYield, yieldControl } from "main-thread-scheduling";
import { Rows } from "../../src/row-manager/row-manager";

const N_COLS = 15;

export const FastGrid = () => {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [autoScroller, setAutoScroller] = useState<AutoScroller | null>(null);
  const [sortToggle, setSortToggle] = useState<
    "ascending" | "descending" | null
  >(null);
  const [isAutoScroll, setIsAutoScroll] = useState<boolean>(false);
  const [loadingRows, setLoadingRows] = useState<boolean>(false);
  const [isAutoFilter, setIsAutoFilter] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>("");
  const [rowCount, setRowCount] = useState<number>(40);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) {
      return;
    }

    // init grid
    const t0 = performance.now();
    const grid = new Grid(container, []);
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
    if (grid == null) return;
    grid.rowManager.multithreadFilterBy(filterQuery);
  }, [filterQuery, grid]);

  useEffect(() => {
    if (grid == null || !isAutoFilter) return;
    const id = setInterval(() => {
      setFilterQuery((p) => {
        if (p.length >= 6) {
          return "";
        }
        return p + Math.floor(Math.random() * 10);
      });
    }, 333);
    return () => clearInterval(id);
  }, [isAutoFilter, grid, filterQuery]);

  useEffect(() => {
    if (grid == null) return;
    setLoadingRows(true);
    setFilterQuery("");
    generateRows(rowCount, grid, () => setLoadingRows(false));
  }, [rowCount, grid]);

  useEffect(() => {
    if (autoScroller == null) return;
    isAutoScroll ? autoScroller.start() : autoScroller.stop();
  }, [autoScroller, isAutoScroll]);

  const addRow = () => {
    if (grid == null) return;
    // const row = generateRow(Object.values(grid.rowManager.rows).length);
    // grid.rowManager.rows[row.key] = row;
    // const state = grid.getState();
    // grid.scrollbar.setScrollOffset({ y: state.scrollableHeight });
    // grid.renderViewportRows();
  };

  const reverseRows = () => {
    window.alert("removed due to refactor, implementing soon");
    if (grid == null) return;
    // grid.rowManager.reverse();
    grid.renderViewportRows();
  };

  const sortSecondColumn = () => {
    if (grid == null) return;
    const dir = (() => {
      if (sortToggle == null) {
        return "descending";
      }
      if (sortToggle === "descending") {
        return "ascending";
      }
      return null;
    })();
    grid.rowManager.multithreadSortBy(dir);
    setSortToggle(dir);
  };

  const reset = () => {
    if (grid == null) return;
    setFilterQuery("");
    setLoadingRows(true);
    setIsAutoFilter(false);
    setIsAutoScroll(false);
    generateRows(rowCount, grid, () => setLoadingRows(false));
  };

  return (
    <>
      <h1 className="self-start text-xl font-bold lg:self-center lg:text-3xl">
        {"World's most performant DOM-based table"}
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
          "flex w-full select-none flex-wrap justify-between gap-2 py-2 text-[11px] text-white lg:[&>*:not(.gutter)]:flex-none [&>*]:h-[25px] [&>*]:min-w-[120px] [&>*]:flex-1 lg:[&>*]:h-[30px] lg:[&>*]:min-w-0",
          loadingRows && "pointer-events-none select-none opacity-60"
        )}
      >
        <PrimaryButtons
          filterQuery={filterQuery}
          sortToggle={sortToggle}
          isAutoFilter={isAutoFilter}
          isAutoScroll={isAutoScroll}
          addRow={addRow}
          reverseRows={reverseRows}
          setFilterQuery={setFilterQuery}
          setIsAutoScroll={setIsAutoScroll}
          setIsAutoFilter={setIsAutoFilter}
          sortSecondColumn={sortSecondColumn}
        />
        <div className="gutter hidden flex-1 lg:block" />
        <SecondaryButtons
          rowCount={rowCount}
          reset={reset}
          setRowCount={setRowCount}
        />
      </div>
      <div
        ref={containerRef} // attaching grid here
        style={{
          contain: "strict",
        }}
        className="relative box-border w-full flex-1 overflow-clip border border-gray-700 bg-white"
      ></div>
    </>
  );
};

const box = "shadow-[rgba(0,_0,_0,_0.1)_0px_0px_2px_1px]";

interface ButtonProps {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}
const Button: FC<ButtonProps> = ({ disabled, children, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "flex h-full w-[150px] cursor-pointer select-none items-center justify-center rounded border border-gray-600 bg-blue-500 hover:opacity-95 active:opacity-90",
        box,
        disabled && "pointer-events-none opacity-70"
      )}
    >
      {children}
    </div>
  );
};

interface PrimaryButtonsProps {
  filterQuery: string;
  sortToggle: "ascending" | "descending" | null;
  isAutoFilter: boolean;
  isAutoScroll: boolean;
  addRow: () => void;
  reverseRows: () => void;
  setFilterQuery: (s: string) => void;
  setIsAutoScroll: Dispatch<SetStateAction<boolean>>;
  setIsAutoFilter: Dispatch<SetStateAction<boolean>>;
  sortSecondColumn: () => void;
}
const PrimaryButtons: FC<PrimaryButtonsProps> = ({
  filterQuery,
  sortToggle,
  isAutoFilter,
  isAutoScroll,
  addRow,
  reverseRows,
  setFilterQuery,
  setIsAutoScroll,
  setIsAutoFilter,
  sortSecondColumn,
}) => {
  console.log(sortToggle);
  return (
    <>
      <Button
        // disabled={filterQuery !== "" || isAutoFilter}
        onClick={addRow}
      >
        Add row
      </Button>
      <Button
        // disabled={filterQuery !== "" || isAutoFilter}
        onClick={reverseRows}
      >
        Reverse rows
      </Button>
      <Button
        // disabled={filterQuery !== "" || isAutoFilter}
        onClick={sortSecondColumn}
      >
        Sort second column
        {sortToggle != null && (
          <span className="material-symbols-outlined text-[13px]">
            {sortToggle === "ascending" ? "arrow_upward" : "arrow_downward"}
          </span>
        )}
      </Button>
      <div
        className={clsx(
          "flex h-full w-[150px] overflow-hidden rounded border border-gray-800 bg-white text-[11px] text-gray-800 lg:text-[13px]",
          box
        )}
      >
        <input
          value={filterQuery}
          placeholder="Filter second column..."
          onChange={(e) => setFilterQuery(e.target.value)}
          className={"flex-1 pl-2 outline-none"}
        />
      </div>
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
          "hidden cursor-pointer items-center text-gray-800 hover:opacity-70 lg:flex lg:w-auto"
        }
      >
        {"← Turn on both!"}
      </div>
    </>
  );
};

interface SecondaryButtonsProps {
  rowCount: number;
  reset: () => void;
  setRowCount: (n: number) => void;
}
const SecondaryButtons: FC<SecondaryButtonsProps> = ({
  rowCount,
  reset,
  setRowCount,
}) => {
  return (
    <>
      <select
        value={rowCount}
        onChange={(e) => setRowCount(Number(e.target.value))}
        className={clsx(
          "flex h-full w-[150px] items-center justify-center rounded border border-gray-800 bg-white text-gray-700",
          box
        )}
      >
        <option value={10}>10 rows</option>
        <option value={10_000}>10 000 rows</option>
        <option value={100_000}>100 000 rows</option>
        <option value={500_000}>500 000 rows</option>
        <option value={1_000_000}>1 000 000 rows (might run out of ram)</option>
        <option value={2_000_000}>2 000 000 rows (might run out of ram)</option>
        <option value={5_000_000}>5 000 000 rows (might run out of ram)</option>
        <option value={10_000_000}>
          10 000 000 rows (might run out of ram)
        </option>
      </select>
      <Button onClick={reset}>Reset</Button>
    </>
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
        "flex h-full w-[150px] cursor-pointer rounded border border-gray-800 lg:w-[70px]",
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

function skewedRandom() {
  const a = Math.pow(Math.random(), 2);
  if (Math.random() < 0.5) {
    return a;
  }
  return 1 - a;
}

const generateRows = async (rowCount: number, grid: Grid, cb: () => void) => {
  const rows: Rows = {};
  let cellIndex = 0;
  for (let i = 0; i < rowCount; i++) {
    if (i % 10000 === 0 && isTimeToYield("background")) {
      // grid.rowManager.setRows(rows);
      await yieldControl("background");
    }
    const cells: Cell[] = [{ id: -i - 1, text: String(i + 1), val: i }];
    for (let j = 0; j < N_COLS; j++) {
      const v = Math.round(skewedRandom() * 100000000);
      cells.push({
        id: cellIndex,
        text: String(v),
        val: v, // TODO(gab): rm field, sorting on this for efficiency. will fix with separate number/string cells
      });
      cellIndex += 1;
    }
    const row = { id: i, cells } satisfies Row;
    rows[row.id] = row;
  }
  grid.rowManager.setRows(rows);
  cb();
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

      const delta = this.toBottom
        ? this.grid.viewportHeight
        : -this.grid.viewportHeight;

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
