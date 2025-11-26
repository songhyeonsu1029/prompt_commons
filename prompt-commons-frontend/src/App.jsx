import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import ExperimentsPage from './pages/ExperimentsPage';
import ExperimentDetailPage from './pages/ExperimentDetailPage';
import NewExperimentPage from './pages/NewExperimentPage';
import ReproductionWorkbenchPage from './pages/ReproductionWorkbenchPage';
import SearchPage from './pages/SearchPage';
import WeeklyTopPage from './pages/WeeklyTopPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyPage from './pages/MyPage';
import UserProfilePage from './pages/UserProfilePage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/experiments" element={<ExperimentsPage />} />
        <Route path="/experiments/new" element={<NewExperimentPage />} />
        <Route path="/experiments/:id" element={<ExperimentDetailPage />} />
        <Route path="/experiments/:id/reproduce" element={<ReproductionWorkbenchPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/weekly-top" element={<WeeklyTopPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/my-page" element={<MyPage />} />
        <Route path="/users/:username" element={<UserProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
