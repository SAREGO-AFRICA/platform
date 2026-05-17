import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import './styles/global.css';
import './i18n';
import './i18n';
import LandingPage from './pages/LandingPage.jsx';
import InvestorDashboard from './pages/InvestorDashboard.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import ProjectFormPage from './pages/ProjectFormPage.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import KycPage from './pages/KycPage.jsx';
import DealRoomsListPage from './pages/DealRoomsListPage.jsx';
import DealRoomPage from './pages/DealRoomPage.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<InvestorDashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/kyc" element={<KycPage />} />
<Route path="/deal-rooms" element={<DealRoomsListPage />} />
<Route path="/deal-rooms/:id" element={<DealRoomPage />} />
        {/* Project form routes — defined BEFORE /:slug so they take priority */}
        <Route path="/projects/new" element={<ProjectFormPage />} />
        <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
        <Route path="/projects/:slug" element={<ProjectDetailPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
