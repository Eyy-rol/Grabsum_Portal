import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "./layout/adminLayout";

import AdminHome from "./Admin/Admins/AdminHome.jsx";
import Enrollment from "./Admin/AdminStudents/Enrollment.jsx";
import Classes from "./Admin/AdminStudents/Classes.jsx";
import TeacherManage from "./Admin/AdminTeacher/Management.jsx";
import TeacherSchedule from "./Admin/AdminTeacher/Schedule.jsx";
import CalendarView from "./Admin/Calendar/CalendarView.jsx";
import AnnouncementList from "./Admin/Announcements/AnnouncementList.jsx";
import Login from "./Auth/Login.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />

          <Route path="students/enrollment" element={<Enrollment />} />
          <Route path="students/classes" element={<Classes />} />

          <Route path="teacher/manage" element={<TeacherManage />} />
          <Route path="teacher/schedule" element={<TeacherSchedule />} />

          <Route path="calendar" element={<CalendarView />} />
          <Route path="announcement" element={<AnnouncementList />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
