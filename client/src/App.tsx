import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { CasesPage } from './pages/Cases';
import { CaseDetailPage } from './pages/CaseDetail';
import { AnalyticsPage } from './pages/Analytics';
import { DemoPage } from './pages/Demo';
import { SettingsPage } from './pages/Settings';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/cases/:id" element={<CaseDetailPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;