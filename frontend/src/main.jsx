import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/global.css';
import './i18n';
import LandingPage from './pages/LandingPage.jsx';
import InvestorDashboard from './pages/InvestorDashboard.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import ProjectFormPage from './pages/ProjectFormPage.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import InvestorsPage from './pages/InvestorsPage.jsx';
import GovernmentsPage from './pages/GovernmentsPage.jsx';
import TradeHubPage from './pages/TradeHubPage.jsx';
import OpportunityDetailPage from './pages/OpportunityDetailPage.jsx';
import OpportunitiesPage from './pages/OpportunitiesPage.jsx'; // SAREGO-OPP-PAGE-ROUTE
import CommodityRequestFormPage from './pages/CommodityRequestFormPage.jsx';
import AgriOfftakeFormPage from './pages/AgriOfftakeFormPage.jsx';
import TenderFormPage from './pages/TenderFormPage.jsx';
import LogisticsLoadFormPage from './pages/LogisticsLoadFormPage.jsx';
import TradeFinanceFormPage from './pages/TradeFinanceFormPage.jsx';
import CapitalProviderProfilePage from './pages/CapitalProviderProfilePage.jsx';
   import ProviderBrowsePage from './pages/ProviderBrowsePage.jsx';
import MyListingsPage from './pages/MyListingsPage.jsx';
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
        <Route path="/investors" element={<InvestorsPage />} />
        <Route path="/governments" element={<GovernmentsPage />} />
        <Route path="/trade-hub" element={<TradeHubPage />} />
        <Route path="/my-listings" element={<MyListingsPage />} />

        {/* Opportunity form routes — static paths declared BEFORE dynamic :type/:id */}
        <Route path="/opportunities/commodity_request/new" element={<CommodityRequestFormPage />} />
        <Route path="/opportunities/commodity_request/:id/edit" element={<CommodityRequestFormPage />} />
        <Route path="/opportunities/agri_offtake/new" element={<AgriOfftakeFormPage />} />
        <Route path="/opportunities/agri_offtake/:id/edit" element={<AgriOfftakeFormPage />} />
        <Route path="/opportunities/tender/new" element={<TenderFormPage />} />
        <Route path="/opportunities/tender/:id/edit" element={<TenderFormPage />} />
        <Route path="/opportunities/logistics_load/new" element={<LogisticsLoadFormPage />} />
        <Route path="/opportunities/logistics_load/:id/edit" element={<LogisticsLoadFormPage />} />
        <Route path="/opportunities/trade_finance/new" element={<TradeFinanceFormPage />} />
        <Route path="/opportunities/trade_finance/:id/edit" element={<TradeFinanceFormPage />} />
        <Route path="/my-provider-profile" element={<CapitalProviderProfilePage />} />
           <Route path="/provider/browse" element={<ProviderBrowsePage />} />
           <Route path="/opportunities" element={<OpportunitiesPage />} />
        <Route path="/opportunities/:type/:id" element={<OpportunityDetailPage />} />

        {/* Project routes — defined BEFORE /:slug so they take priority */}
        <Route path="/projects/new" element={<ProjectFormPage />} />
        <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
        <Route path="/projects/:slug" element={<ProjectDetailPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
