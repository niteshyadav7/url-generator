import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layout & Pages
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Links from './pages/Links';
import Upload from './pages/Upload';
import Keywords from './pages/Keywords';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes redirect straight to dashboard */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />

        {/* All dashboard routes — no auth gating */}
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/links" element={<Layout><Links /></Layout>} />
        <Route path="/upload" element={<Layout><Upload /></Layout>} />
        <Route path="/keywords" element={<Layout><Keywords /></Layout>} />
        <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
