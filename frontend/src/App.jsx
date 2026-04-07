import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import CreatePage from './pages/CreatePage';
import LoginPage from './pages/LoginPage';
import UpdatePage from './pages/UpdatePage';

export default function App() {
  return (
    <main className="app-container">
      <header className="app-header">
        <h1>👤 Profile Manager</h1>
        <p className="subtitle">Create new profiles or update existing ones with camera capture and file upload</p>

        <nav className="app-nav" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Create
          </NavLink>
          <NavLink to="/login" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Login
          </NavLink>
          <NavLink to="/update" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Update
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<CreatePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/update" element={<UpdatePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
