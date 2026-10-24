import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getUser } from './api';
import { TabBar } from './components';
import Home from './pages/Home';
import Team from './pages/Team';
import Report from './pages/Report';
import { Join, Login, Me } from './pages/Misc';

function Shell() {
  const [, tick] = useState(0);
  const refresh = () => tick((n) => n + 1);
  const loc = useLocation();
  const user = getUser();

  if (!user) {
    // 로그인 후 초대 링크로 돌아가도록 현재 경로 유지
    return <Login onLogin={refresh} />;
  }
  const hideTab = loc.pathname.startsWith('/join');
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/team/:id" element={<Team />} />
        <Route path="/report" element={<Report />} />
        <Route path="/me" element={<Me onLogout={refresh} />} />
        <Route path="/join/:code" element={<Join onDone={refresh} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideTab && <TabBar />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app"><Shell /></div>
    </BrowserRouter>
  );
}
