import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Auth from "../pages/Auth";
import Dashboard from "../pages/Dashboard";

const PickupRoutes = () => {
  return (
    <Routes>
      <Route path="auth" element={<Auth />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="/" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
};

export default PickupRoutes;

