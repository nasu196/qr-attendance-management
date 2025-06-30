import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ClerkProvider } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import { QRAttendanceStandalone } from "./QRAttendanceStandalone";
import { AuthProvider } from "./components/AuthProvider";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Clerk publishable key (optional - handled by AuthProvider)
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    {clerkPubKey ? (
      <ClerkProvider publishableKey={clerkPubKey}>
        <ConvexAuthProvider client={convex}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/qr/:urlId" element={<QRAttendanceStandalone />} />
            </Routes>
          </BrowserRouter>
        </ConvexAuthProvider>
      </ClerkProvider>
    ) : (
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/qr/:urlId" element={<QRAttendanceStandalone />} />
          </Routes>
        </BrowserRouter>
      </ConvexAuthProvider>
    )}
  </AuthProvider>,
);
