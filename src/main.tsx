import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import { QRAttendanceStandalone } from "./QRAttendanceStandalone";
import { AuthProvider } from "./components/AuthProvider";

// Clerk publishable key (optional - handled by AuthProvider)
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    {clerkPubKey ? (
      <ClerkProvider publishableKey={clerkPubKey}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/qr/:urlId" element={<QRAttendanceStandalone />} />
          </Routes>
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/qr/:urlId" element={<QRAttendanceStandalone />} />
        </Routes>
      </BrowserRouter>
    )}
  </AuthProvider>,
);
