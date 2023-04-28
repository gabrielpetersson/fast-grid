import { useState, useRef, useEffect, FC } from "react";
import { Cell, Grid, Row } from "grid";
import Stats from "stats.js";
import clsx from "clsx";

const N_COLS = 14;

export const FastGrid = () => {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [autoScroller, setAutoScroller] = useState<AutoScroller | null>(null);
  const [sortToggle, setSortToggle] = useState<boolean>(true);
  const [isAutoScroll, setIsAutoScroll] = useState<boolean>(false);
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
    if (grid == null) return;
    const rows = generateRows(rowCount);
    grid.setRows(rows);
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
    grid.setRows(generateRows(rowCount));
  };
  return (
    <>
      <h1 className="font-bold text-lg self-center">
        {"The most performant DOM-based table"}
      </h1>
      <p>
        {
          "Try to make the FPS drop in the bottom right. If that is too hard, try x6 cpu slowdown in devtools."
        }
      </p>
      <p>
        {
          "To see how smooth it is - filter while on auto scroll, which scrolls a full viewport every frame"
        }
      </p>
      <p className={"text-red-500"}>
        {
          "1) Number of rows is limited by memory only. See how many you can generate!"
        }
      </p>

      <p className={"text-red-500"}>
        {"2) Can't filter/sort at the same time yet"}
      </p>
      <p className={"text-red-500"}>
        {"3) Sorting/reversing is blocking main thread atm"}
      </p>
      <div className="text-white text-md flex h-[50px] py-2 w-full [&>*+*]:ml-3">
        <Button onClick={addRow}>Add row</Button>
        <Button onClick={reverseRows}>Reverse rows</Button>
        <Button onClick={sortSecondColumn}>Sort second column</Button>
        <input
          value={filterQuery}
          placeholder="Filter second column"
          onChange={(e) => setFilterQuery(e.target.value)}
          className="pl-1 flex h-full w-[150px] items-center justify-center rounded bg-white text-[14px] text-black border-black border"
        />
        <Button onClick={reset}>Reset</Button>
        <select
          name="exampleDropdown"
          value={rowCount}
          onChange={(e) => setRowCount(Number(e.target.value))}
          className="pl-1 flex h-full w-[150px] items-center justify-center rounded bg-white text-[14px] text-black border-black border"
        >
          <option value={10_000}>10 000 Rows</option>
          <option value={100_000}>100 000 Rows</option>
          <option value={1_000_000}>1 000 000 Rows</option>
          <option value={2_000_000}>2 000 000 Rows</option>
          <option value={5_000_000}>5 000 000 Rows</option>
          <option value={10_000_000}>10 000 000 Rows</option>
        </select>
        <Checkbox
          active={isAutoScroll}
          onClick={() => setIsAutoScroll((p) => !p)}
        />
      </div>
      <div
        ref={containerRef}
        className="relative box-border border border-black overflow-clip bg-white w-full h-full"
      ></div>
    </>
  );
};

interface ButtonProps {
  children: string;
  onClick: () => void;
}
const Button: FC<ButtonProps> = ({ children, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="flex h-full w-[180px] cursor-pointer select-none items-center justify-center rounded bg-blue-500 hover:opacity-95 active:opacity-90"
    >
      {children}
    </div>
  );
};

interface CheckboxProps {
  active: boolean;
  onClick: () => void;
}
const Checkbox: FC<CheckboxProps> = ({ active, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="flex h-[30px] w-[100px] border border-black rounded cursor-pointer"
    >
      <div
        className={clsx(
          "flex-1 flex justify-center items-center",
          active && "bg-blue-500",
          !active && "text-black"
        )}
      >
        Auto scroll
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

const generateRows = (rowCount: number) => {
  const rowData: Row[] = [];
  // pre-allocation :D
  rowData.length = rowCount;
  for (let i = 0; i < rowCount; i++) {
    const row = generateRow(i);
    rowData[i] = row;
  }
  return rowData;
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
