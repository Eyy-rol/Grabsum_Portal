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

import TeacherLayout from "./layout/TeacherLayout";
import TeacherDashboard from "./Teacher/TeacherDashboard";
import TeacherLessons from "./Teacher/TeacherLessons";
import TeacherClasses from "./Teacher/TeacherClasses";
import TeacherSchedules from "./Teacher/TeacherSchedule";
import TeacherAnnouncements from "./Teacher/TeacherAnnouncements";
import TeacherStudents from "./Teacher/TeacherStudents";
import TeacherSettings from "./Teacher/TeacherSettings";

import StudentLayout from "./layout/StudentLayout";

import StudentDashboard from "./student/StudentDashboard";
import StudentCourses from "./student/StudentCourses";
import StudentSchedule from "./student/StudentSchedule";
import StudentAnnouncements from "./student/StudentAnnouncements";
import StudentProfile from "./student/StudentProfile";
import StudentSettings from "./student/StudentSettings";


import DevLayout from "./layout/DevLayout.js";
import DevDashboard from "./dev/pages/Dashboard.jsx";
import AdminManagement from "./dev/pages/AdminManagement.jsx";
import RoleManagement from "./dev/pages/RoleManagement.jsx";
import ActivityLogs from "./dev/pages/ActivityLogs.jsx";
import SecuritySettings from "./dev/pages/SecuritySettings.jsx";
import SystemConfiguration from "./dev/pages/SystemConfiguration.jsx";
import DatabaseManagement from "./dev/pages/DatabaseManagement.jsx";
import AuditReports from "./dev/pages/AuditReports.jsx";

import PreEnrollment from "./Auth/PreEnroll.jsx";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/pre-enroll" element={<PreEnrollment />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />

          <Route path="students/enrollment" element={<Enrollment />} />
          <Route path="students/classes" element={<Classes />} />

          <Route path="teacher/manage" element={<TeacherManage />} />
          <Route path="teacher/schedule" element={<TeacherSchedule />} />

          <Route path="calendar" element={<CalendarView />} />
          <Route path="announcement" element={<AnnouncementList />} />
        </Route>

        <Route path="/teacher" element={<TeacherLayout />}>
  <Route path="dashboard" element={<TeacherDashboard />} />
  <Route path="lessons" element={<TeacherLessons />} />
  <Route path="classes" element={<TeacherClasses />} />
  <Route path="schedule" element={<TeacherSchedules />} />
  <Route path="announcements" element={<TeacherAnnouncements />} />
  <Route path="students" element={<TeacherStudents />} />
  <Route path="settings" element={<TeacherSettings />} />
</Route>


  <Route path="/student" element={<StudentLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="courses" element={<StudentCourses />} />
        <Route path="schedule" element={<StudentSchedule />} />
        <Route path="announcements" element={<StudentAnnouncements />} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="settings" element={<StudentSettings />} />
      </Route>

  

            {/* Developer Area */}
        <Route path="/dev" element={<DevLayout />}>
          <Route index element={<DevDashboard />} />
          <Route path="admins" element={<AdminManagement />} />
          <Route path="roles" element={<RoleManagement />} />
          <Route path="activity" element={<ActivityLogs />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="config" element={<SystemConfiguration />} />
          <Route path="database" element={<DatabaseManagement />} />
          <Route path="audit" element={<AuditReports />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
