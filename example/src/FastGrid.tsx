import { useState, useRef, useEffect, FC } from "react";
import { Cell, Grid, Row } from "grid";
import Stats from "stats.js";
import clsx from "clsx";
import { isTimeToYield, yieldControl } from "main-thread-scheduling";

const N_COLS = 15;

export const FastGrid = () => {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [autoScroller, setAutoScroller] = useState<AutoScroller | null>(null);
  const [sortToggle, setSortToggle] = useState<boolean>(true);
  const [isAutoScroll, setIsAutoScroll] = useState<boolean>(false);
  const [loadingRows, setLoadingRows] = useState<boolean>(false);
  const [isAutoFilter, setIsAutoFilter] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>("");
  const [rowCount, setRowCount] = useState<number>(100_000);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) {
      return;
    }
    setupFPS();
    const t0 = performance.now();
    const grid = new Grid(container, []);
    console.info("Ms to intitialize grid:", performance.now() - t0);
    setGrid(grid);
    setAutoScroller(new AutoScroller(grid));
  }, []);

  useEffect(() => {
    if (grid == null) return;
    grid.filterBy(filterQuery);
  }, [filterQuery, grid]);

  useEffect(() => {
    if (grid == null || !isAutoFilter) return;
    const id = setInterval(() => {
      setFilterQuery((p) => {
        if (p.length >= 4) {
          return "";
        }
        return p + Math.floor(Math.random() * 10);
      });
    }, 300);
    return () => clearInterval(id);
  }, [isAutoFilter, grid, filterQuery]);

  useEffect(() => {
    if (grid == null) return;
    setLoadingRows(true);
    generateRows(rowCount, grid, () => setLoadingRows(false));
  }, [rowCount, grid]);

  const addRow = () => {
    if (grid == null) return;
    const row = generateRow(grid.rows.length);
    grid.rows.push(row);
    grid.renderViewportRows();
    grid.scrollToBottom();
  };

  const reverseRows = () => {
    if (grid == null) return;
    grid.rows.reverse();
    grid.renderViewportRows();
  };

  const sortSecondColumn = () => {
    if (grid == null) return;
    grid.rows = grid.rows.sort((a, b) => {
      const aVal = Number(a.cells[1]!.s);
      const bVal = Number(b.cells[1]!.s);
      return sortToggle ? aVal - bVal : bVal - aVal;
    });
    grid.renderViewportRows();
    setSortToggle((p) => !p);
  };

  useEffect(() => {
    if (autoScroller == null) return;
    isAutoScroll ? autoScroller.start() : autoScroller.stop();
  }, [autoScroller, isAutoScroll]);

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
      <h1 className="font-bold text-3xl self-center">
        {"World's most performant DOM-based table"}
      </h1>
      <a
        className="self-center underline text-blue-600 hover:text-blue-800 mt-2"
        href="https://github.com/gabrielpetersson/fast-grid/"
      >
        {"https://github.com/gabrielpetersson/fast-grid/"}
      </a>
      <div className="flex justify-center items-center h-8">
        {loadingRows ? (
          <p className="self-center">{"Generating rows..."}</p>
        ) : null}
      </div>
      <div
        className={clsx(
          "text-white text-sm flex justify-between h-[50px] py-2 w-full",
          loadingRows && "opacity-60 select-none pointer-events-none"
        )}
      >
        <div className={"flex [&>*+*]:ml-3"}>
          <Button
            disabled={filterQuery !== "" || isAutoFilter}
            onClick={addRow}
          >
            Add row
          </Button>
          <Button
            disabled={filterQuery !== "" || isAutoFilter}
            onClick={reverseRows}
          >
            Reverse rows
          </Button>
          <Button
            disabled={filterQuery !== "" || isAutoFilter}
            onClick={sortSecondColumn}
          >
            Sort second column
          </Button>
          <input
            value={filterQuery}
            placeholder="Filter second column..."
            onChange={(e) => setFilterQuery(e.target.value)}
            className={clsx(
              "pl-1 flex h-full w-[180px] items-center justify-center rounded bg-white text-gray-800 border-gray-800 border",
              box
            )}
          />
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
          <p
            onClick={() => {
              setIsAutoFilter(!(isAutoFilter && isAutoScroll));
              setIsAutoScroll(!(isAutoFilter && isAutoScroll));
            }}
            className={
              "text-gray-800 self-center cursor-pointer select-none hover:opacity-70"
            }
          >
            {"← Turn on both!"}
          </p>
        </div>
        <div className={"flex [&>*+*]:ml-3 ml-10"}>
          <select
            name="exampleDropdown"
            value={rowCount}
            onChange={(e) => setRowCount(Number(e.target.value))}
            className={clsx(
              "pl-1 flex h-full w-[150px] items-center justify-center rounded bg-white text-gray-700 border-gray-800 border",
              box
            )}
          >
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
          <Button onClick={reset}>Reset</Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative box-border border border-gray-700 overflow-clip bg-white w-full h-full"
      ></div>
    </>
  );
};

const box = "shadow-[rgba(0,_0,_0,_0.1)_0px_0px_2px_1px]";

interface ButtonProps {
  children: string;
  disabled?: boolean;
  onClick: () => void;
}
const Button: FC<ButtonProps> = ({ disabled, children, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "flex h-full w-[180px] cursor-pointer border border-gray-600 select-none items-center justify-center rounded bg-blue-500 hover:opacity-95 active:opacity-90",
        box,
        disabled && "opacity-70 pointer-events-none"
      )}
    >
      {children}
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
        "flex h-[30px] w-[100px] border border-gray-800 rounded cursor-pointer",
        box
      )}
    >
      <div
        className={clsx(
          "flex-1 flex justify-center items-center",
          active && "bg-blue-500",
          !active && "text-gray-700"
        )}
      >
        {children}
      </div>
    </div>
  );
};

const generateRow = (i: number): Row => {
  const cells: Cell[] = [
    { type: "string", value: String(i), key: `${i}-index`, s: i },
  ];
  for (let j = 0; j < N_COLS; j++) {
    const v = Math.round(Math.random() * 100000000);
    cells[j + 1]! = {
      type: "string",
      value: String(v),
      key: `${i}-${j}`,
      s: v, // just a hack for now
    };
  }
  return { key: String(i), cells };
};

const generateRows = async (rowCount: number, grid: Grid, cb: () => void) => {
  const rowData: Row[] = [];
  // pre-allocation :D
  rowData.length = rowCount;
  for (let i = 0; i < rowCount; i++) {
    if (i % 10000 === 0 && isTimeToYield("user-visible")) {
      grid.setRows(rowData);
      await yieldControl("user-visible");
    }
    const row = generateRow(i);
    rowData[i] = row;
  }
  grid.setRows(rowData);
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
      const metrics = this.grid.getMetrics();
      if (!this.running) {
        return;
      }

      if (
        this.grid.scrollOffsetY >
        metrics.requiredHeight - metrics.viewportHeight - 100
      ) {
        this.toBottom = false;
      } else if (this.grid.scrollOffsetY < 100) {
        this.toBottom = true;
      }

      const delta = this.toBottom
        ? metrics.viewportHeight
        : -metrics.viewportHeight;

      this.grid.container.dispatchEvent(
        new CustomEvent("wheel", { detail: { deltaY: delta } })
      );
      window.requestAnimationFrame(cb);
    };
    window.requestAnimationFrame(cb);
  }
  stop() {
    this.running = false;
  }
}
