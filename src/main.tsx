import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { mountCustomCursor } from "./lib/cursor";

mountCustomCursor();

createRoot(document.getElementById("root")!).render(<App />);
