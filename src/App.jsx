
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import AttendanceHistory from './pages/AttendanceHistory';
import PrivateRoute from './components/PrivateRoute'; // Add import
import Subjects from './pages/Subjects';
import Timetable from './pages/Timetable'; // Add import

import AdminResponses from './pages/AdminResponses';
import AdminRoute from './components/AdminRoute';

import { ThemeProvider } from './contexts/ThemeContext'; // Add Import

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} /> {/* Added Signup route */}

            <Route path="/admin/responses" element={
              <AdminRoute>
                <AdminResponses />
              </AdminRoute>
            } />

            <Route path="/" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />

            <Route path="/subjects" element={
              <PrivateRoute>
                <Subjects />
              </PrivateRoute>
            } />

            <Route path="/timetable" element={
              <PrivateRoute>
                <Timetable />
              </PrivateRoute>
            } />

            <Route path="/history" element={
              <PrivateRoute>
                <AttendanceHistory />
              </PrivateRoute>
            } />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
