import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Session from "./pages/Session";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/practice/:modeId" element={<Session />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
