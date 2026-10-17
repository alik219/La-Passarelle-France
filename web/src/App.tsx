import { Navigate, Route, Routes } from "react-router-dom";
import Drill from "./pages/Drill";
import Exam from "./pages/Exam";
import Landing from "./pages/Landing";
import Report from "./pages/Report";
import Session from "./pages/Session";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {/* The exam, the report and the drill have their own pages; every other mode is a conversation. */}
      <Route path="/practice/timed-exam" element={<Exam />} />
      <Route path="/practice/feedback-report" element={<Report />} />
      <Route path="/practice/vocabulary-drill" element={<Drill />} />
      <Route path="/practice/:modeId" element={<Session />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
