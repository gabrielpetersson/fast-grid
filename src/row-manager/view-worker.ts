import { ComputeViewDoneEvent, RowData, Rows, View } from "./row-manager";
import { Row } from "../row";
import { sort as timSort } from "./timsort";
import { Result } from "../utils/result";
import { wait } from "../utils/wait";
console.log("Worker initialized");

const letOtherEventsThrough = () => wait(0);

const filterRows = async ({
  query,
  column,
  rowsArr,
  buffer,
  shouldCancel,
  onEarlyResults,
}: {
  query: string;
  column: number;
  rowsArr: Row[];
  buffer: Int32Array;
  shouldCancel: () => boolean;
  onEarlyResults: (numRows: number) => void;
}): Promise<Result<{ numRows: number }>> => {
  // minimum ms until we return early results. scrolling is clamped so if we return like only viewport we'd always
  // go back to the top again while filtering from the middle
  const MIN_MS_EARLY_RESULT = 30;
  const MIN_RESULTS_EARLY_RESULT = 32;
  const ROW_CHUNK_SIZE = 30000;

  const numChunks = Math.ceil(rowsArr.length / ROW_CHUNK_SIZE);
  const start = performance.now();
  let sentEarlyResults = false;
  let offset = 0;

  for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
    const startIndex = chunkIndex * ROW_CHUNK_SIZE;
    const endIndex = Math.min(startIndex + ROW_CHUNK_SIZE, rowsArr.length);

    const timeSinceStart = performance.now() - start;

    await letOtherEventsThrough();
    if (shouldCancel()) {
      return { ok: false, error: "filter-cancelled" };
    }

    if (
      !sentEarlyResults &&
      timeSinceStart > MIN_MS_EARLY_RESULT &&
      offset > MIN_RESULTS_EARLY_RESULT
    ) {
      // makes filtering look super fast
      onEarlyResults(offset);
      sentEarlyResults = true;
    }

    for (let i = startIndex; i < endIndex; i++) {
      const row = rowsArr[i]!;
      // NOTE(gab): indexOf is faster than includes
      if (row.cells[column]!.text.indexOf(query) > -1) {
        // buffer[offset] = row.id;
        Atomics.store(buffer, offset, row.id);
        offset += 1;
      }
    }
  }
  return { ok: true, value: { numRows: offset } };
};

const getSortComparisonFn = (
  direction: "ascending" | "descending",
  col: number
) => {
  if (direction === "ascending") {
    return (a: Row, b: Row) => (a.cells[col].val > b.cells[col].val ? 1 : -1);
  }
  return (a: Row, b: Row) => (a.cells[col].val < b.cells[col].val ? 1 : -1);
};

const computeView = async ({
  rowData,
  buffer,
  viewConfig,
  useSortCache,
  shouldCancel,
}: {
  rowData: RowData;
  buffer: Int32Array;
  viewConfig: View;
  useSortCache: boolean;
  shouldCancel: () => boolean;
}): Promise<number | "cancelled"> => {
  const sortConfig = viewConfig.sort;

  let rowsArr = rowData.arr;

  const shouldRecomputeSort = sortConfig != null && !useSortCache;
  if (shouldRecomputeSort) {
    const start = performance.now();
    rowsArr = [...rowData.arr]; // todo: can use a global array reference here and manually check if all references are the same still

    const fn = getSortComparisonFn(sortConfig.direction, sortConfig.column);
    const sortResult = await timSort(rowsArr, fn, shouldCancel);
    if (!sortResult.ok) {
      return "cancelled";
    }

    cache.sort = rowsArr;
    console.log("sorting happened, ms", performance.now() - start);
  } else if (useSortCache && cache.sort != null) {
    rowsArr = cache.sort;
  }

  await letOtherEventsThrough();
  if (shouldCancel()) {
    return "cancelled";
  }

  // TODO(gab): remove hardcode for column 2
  const filter = viewConfig.filter[0]; //.find((f) => f.column === 1);
  if (filter == null) {
    const start = performance.now();
    for (let i = 0; i < rowsArr.length; i++) {
      Atomics.store(buffer, i, rowsArr[i]!.id);
    }
    console.log(
      "returning early after sort, wrote buffer ms:",
      performance.now() - start
    );
    return rowsArr.length;
  }

  const start = performance.now();
  const result = await filterRows({
    query: filter.query,
    column: filter.column,
    buffer,
    rowsArr,
    onEarlyResults: (numRows: number) => {
      self.postMessage({
        type: "compute-view-done",
        numRows,
        skipRefreshThumb: true,
      } satisfies ComputeViewDoneEvent);
    },
    shouldCancel,
  });

  await letOtherEventsThrough();
  if (shouldCancel() || !result.ok) {
    return "cancelled";
  }

  console.log(
    "filtering happened, num rows:",
    result.value.numRows,
    "ms:",
    performance.now() - start
  );
  return result.value.numRows;

  // ### SORTING EXPERIMENTS ###
  //
  // standard sort
  // const t0 = performance.now();
  // [...rowData.arr].sort((a, b) => (a.cells[1]!.s > b.cells[1]!.s ? 1 : -1));
  // const t1 = performance.now();
  // testing fast-sort npm lib
  // fastSort([...rowData.arr]).desc((u) => u.cells[1]!.s);

  // console.log("sort", t1 - t0, t2 - t1, performance.now() - t2);

  // const SIZE = 1_000_000;
  // const regularArray = Array.from({ length: SIZE }, () =>
  //   Math.floor(Math.random() * 4294967296)
  // ); // Max value for Uint32
  // const toSort = regularArray.map((n) => ({ n: [n], s: n.toString() }));
  // const uint32Array = new Uint32Array(regularArray);

  // // Test sorting regular JS array
  // let start = performance.now();
  // toSort.sort((a, b) => a.n[0] - b.n[0]);
  // let end = performance.now();
  // console.log(`Regular array sort took ${end - start}ms`);

  // // Test sorting Uint32Array
  // start = performance.now();
  // uint32Array.sort((a, b) => a - b);
  // end = performance.now();
  // console.log(`Uint32Array sort took ${end - start}ms`);
};

let rowData: RowData = {
  obj: {},
  arr: [],
  version: Date.now(),
};

let currentFilterId: [number] = [0];

const cache = {
  sort: null as Row[] | null,
};

const handleEvent = async (event: Message) => {
  const message = event.data;
  switch (message.type) {
    case "compute-view": {
      currentFilterId[0] = message.viewConfig.version;
      const shouldCancel = () => {
        if (message.viewConfig.version !== currentFilterId[0]) {
          console.error(
            "cancelled",
            message.viewConfig.version,
            currentFilterId[0]
          );
        }
        return message.viewConfig.version !== currentFilterId[0];
      };
      const numRows = await computeView({
        viewConfig: message.viewConfig,
        useSortCache: message.useSortCache ?? false,
        buffer: message.viewBuffer,
        rowData,
        shouldCancel,
      });

      // NOTE(gab): let other events stream through & check if any of them invalidates this one
      await letOtherEventsThrough();
      if (shouldCancel() || numRows === "cancelled") {
        console.error("cancelled");
        self.postMessage({ type: "compute-view-cancelled" });
        return;
      }

      self.postMessage({ type: "compute-view-done", numRows });
      return;
    }
    case "set-rows": {
      rowData = {
        obj: message.rows,
        arr: Object.values(message.rows),
        version: Date.now(),
      };
      cache.sort = null;
      return;
    }
  }
};

export type ComputeViewEvent = {
  type: "compute-view";
  viewBuffer: Int32Array;
  viewConfig: View;
  useSortCache?: boolean;
};

export type SetRowsEvent = {
  type: "set-rows";
  rows: Rows;
};

export type Message = MessageEvent<ComputeViewEvent | SetRowsEvent>;

self.addEventListener("message", (event: Message) => {
  handleEvent(event);
});
