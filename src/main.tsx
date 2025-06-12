import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import { QRAttendanceStandalone } from "./QRAttendanceStandalone";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/qr/:urlId" element={<QRAttendanceStandalone />} />
      </Routes>
    </BrowserRouter>
  </ConvexAuthProvider>,
);
