import { Navigate, Route, Routes } from "react-router-dom";
import Exam from "./pages/Exam";
import Landing from "./pages/Landing";
import Session from "./pages/Session";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {/* The timed exam has its own page; every other mode is a conversation. */}
      <Route path="/practice/timed-exam" element={<Exam />} />
      <Route path="/practice/:modeId" element={<Session />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
