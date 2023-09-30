import { RowData, Rows, ViewConfig } from "./row-manager";
import { Row } from "../row";
import { sort as timSort } from "./timsort";
import { Result } from "../utils/result";
import { wait } from "../utils/wait";
console.log("Worker initialized");

export const letOtherEventsThrough = () => wait(0);

let rowData: RowData = {
  obj: {},
  arr: [],
  version: Date.now(),
};

let currentFilterId: [number] = [0];

interface FilterRows {
  rowsArr: Row[];
  buffer: Int32Array;
  query: string;
  rowsPerViewport: number;
  onEarlyResults: (rows: Row[]) => void;
  shouldCancel: () => boolean;
}
export const filterRows = async ({
  rowsArr,
  buffer,
  query,
  //   rowsPerViewport,
  //   onEarlyResults,
  shouldCancel,
}: FilterRows): Promise<Result<{ numRows: number }>> => {
  const ROW_CHUNK_SIZE = 30000;
  // const filteredRows: Row[] = [];
  const numChunks = Math.ceil(rowsArr.length / ROW_CHUNK_SIZE);
  let offset = 0;
  // let hasShownFirstResult = false;
  for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
    const startIndex = chunkIndex * ROW_CHUNK_SIZE;
    const endIndex = Math.min(startIndex + ROW_CHUNK_SIZE, rowsArr.length);

    await letOtherEventsThrough();
    if (shouldCancel()) {
      return { ok: false, error: "filter-cancelled" };
    }

    for (let i = startIndex; i < endIndex; i++) {
      const row = rowData.arr[i]!;
      // NOTE(gab): indexOf is faster than includes
      if (row.cells[1]!.value.indexOf(query) > -1) {
        // buffer[offset] = row.key;
        Atomics.store(buffer, i, row.key);
        offset += 1;
      }
    }

    // NOTE(gab): shows first results asap, but make sure they fill the viewport so rows are
    // not loading in in batches
    // const fillsViewport = filteredRows.length > rowsPerViewport;
    // const showEarlyResults = chunkIndex % 100 === 0 || !hasShownFirstResult;
    // if (showEarlyResults && fillsViewport) {
    //   hasShownFirstResult = true;
    //   onEarlyResults(filteredRows);
    // }
  }
  return { ok: true, value: { numRows: offset } };
};

let sortCache: Row[] | null = null;

interface ComputeViewParams {
  rowData: RowData;
  buffer: Int32Array;
  viewConfig: ViewConfig;
  recompute: { sort: boolean; filter: boolean };
  rowsPerViewport: number;
  onEarlyResults: (rows: Row[]) => void;
  shouldCancel: () => boolean;
}
export const computeView = async ({
  rowData,
  buffer,
  viewConfig,
  recompute,
  //   rowsPerViewport,
  //   onEarlyResults,
  shouldCancel,
}: ComputeViewParams): Promise<number | "cancelled"> => {
  const t2 = performance.now();
  let rowsArr = rowData.arr;
  if (recompute.sort && viewConfig.sort != null) {
    rowsArr = [...rowData.arr];
    const direction = viewConfig.sort.direction;
    const col = viewConfig.sort.column;
    const comp = (() => {
      if (direction === "ascending") {
        return (a: Row, b: Row) => (a.cells[col].s > b.cells[col].s ? 1 : -1);
      }
      return (a: Row, b: Row) => (a.cells[col].s < b.cells[col].s ? 1 : -1);
    })();
    const res = await timSort(rowsArr, comp, shouldCancel);
    sortCache = rowsArr;
    console.log("sorting ms", performance.now() - t2);
    if (!res.ok) {
      return "cancelled";
    }
  } else if (viewConfig.sort != null && sortCache != null) {
    rowsArr = sortCache;
  }

  await letOtherEventsThrough();
  if (shouldCancel()) {
    return "cancelled";
  }

  // TODO(gab): remove hardcode for column 2
  const filterQuery = viewConfig.filter.find((f) => f.column === 2)?.query;
  if (!recompute.filter || filterQuery == null) {
    for (let i = 0; i < rowsArr.length; i++) {
      // buffer[i] = rowsArr[i]!.key;
      Atomics.store(buffer, i, rowsArr[i]!.key);
    }
    return rowsArr.length;
  }

  const result = await filterRows({
    query: filterQuery,
    buffer,
    rowsArr,
    rowsPerViewport: 32,
    shouldCancel,
    onEarlyResults: () => {
      return false;
    },
  });

  await letOtherEventsThrough();
  if (shouldCancel() || !result.ok) {
    return "cancelled";
  }
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
        recompute: message.recompute,
        buffer: message.viewBuffer,
        rowData,
        rowsPerViewport: 32,
        shouldCancel,
        onEarlyResults: () => {
          return false;
        },
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
      return;
    }
  }
};

interface FilterEvent {
  type: "compute-view";
  viewBuffer: Int32Array;
  viewConfig: ViewConfig;
  recompute: {
    filter: boolean;
    sort: boolean;
  };
}
interface SetRowsEvent {
  type: "set-rows";
  rows: Rows;
}
type Message = MessageEvent<FilterEvent | SetRowsEvent>;
self.addEventListener("message", (event: Message) => {
  console.log("got new event", event.data.type);
  // NOTE(gab): messsages are handled sync & is blocking, so need to exit the event loop asap
  handleEvent(event);
});
