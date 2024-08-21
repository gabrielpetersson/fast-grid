import { isTimeToYield, yieldControl } from "main-thread-scheduling";
import { Row } from "../row";

interface FilterRows {
  rows: Row[];
  query: string;
  rowsPerViewport: number;
  onEarlyResults: (rows: Row[]) => void;
  shouldCancel: () => boolean;
}
export const filterRows = async ({
  rows,
  query,
  rowsPerViewport,
  onEarlyResults,
  shouldCancel,
}: FilterRows): Promise<Row[] | "canceled"> => {
  const ROW_CHUNK_SIZE = 500;
  const filteredRows: Row[] = [];
  const numChunks = Math.ceil(rows.length / ROW_CHUNK_SIZE);

  let hasShownFirstResult = false;
  for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
    const startIndex = chunkIndex * ROW_CHUNK_SIZE;
    const endIndex = Math.min(startIndex + ROW_CHUNK_SIZE, rows.length);

    if (shouldCancel()) {
      return "canceled";
    }
    // NOTE(gab): this is the magic - run work sync is possible, awaits if main thread busy
    if (isTimeToYield("user-visible")) {
      await yieldControl("user-visible");
      if (shouldCancel()) {
        return "canceled";
      }
    }

    for (let i = startIndex; i < endIndex; i++) {
      const row = rows[i]!;
      // NOTE(gab): indexOf is faster than includes
      if (String(row.cells[1]!.v).indexOf(query) > -1) {
        filteredRows.push(row);
      }
    }

    // NOTE(gab): shows first results asap, but make sure they fill the viewport so rows are
    // not loading in in batches
    const fillsViewport = filteredRows.length > rowsPerViewport;
    const showEarlyResults = chunkIndex % 100 === 0 || !hasShownFirstResult;
    if (showEarlyResults && fillsViewport) {
      hasShownFirstResult = true;
      onEarlyResults(filteredRows);
    }
  }
  return filteredRows;
};
