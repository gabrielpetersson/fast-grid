import ReactDOM from "react-dom/client";
import "./index.css";
import { FastGrid } from "./App.tsx";
import { ReactNode } from "react";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  (<FastGrid />) as unknown as ReactNode

  // <StrictMode>
  // <FastGrid />
  // </StrictMode>
);
