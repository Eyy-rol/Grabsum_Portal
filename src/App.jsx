import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import RequireRole from "./components/RequireRole.jsx"; // ✅ add this
import RequirePasswordChange from "./Auth/RequirePasswordChange.jsx";

import AdminLayout from "./layout/adminLayout";
import AdminHome from "./Admin/Admins/AdminHome.jsx";
import Enrollment from "./Admin/AdminStudents/Enrollment.jsx";
import Classes from "./Admin/AdminStudents/Classes.jsx";
import Schedule from "./Admin/AdminStudents/Schedule.jsx";
import Section from "./Admin/AdminStudents/Section.jsx";
import Subject from "./Admin/AdminStudents/Subject.jsx";
import SchoolYear from "./Admin/AdminStudents/School_Year.jsx";
import TeacherManage from "./Admin/AdminTeacher/Management.jsx";
import TeacherSchedule from "./Admin/AdminTeacher/Schedule.jsx";
import CalendarView from "./Admin/Calendar/CalendarView.jsx";
import AnnouncementList from "./Admin/Announcements/AnnouncementList.jsx";

import Login from "./Auth/Login.jsx";
import PreEnrollment from "./Auth/PreEnroll.jsx";
import ChangePassword from "./Auth/ChangePassword.jsx";

import TeacherLayout from "./layout/TeacherLayout.jsx";
import TeacherDashboard from "./Teacher/TeacherDashboard";
import TeacherLessons from "./Teacher/TeacherLessons";
import TeacherClasses from "./Teacher/TeacherClasses";
import TeacherSchedules from "./Teacher/TeacherSchedule";
import TeacherAnnouncements from "./Teacher/TeacherAnnouncements";
import TeacherStudents from "./Teacher/TeacherStudents";
import TeacherSettings from "./Teacher/TeacherSettings";


import StudentLayout from "./layout/StudentLayout";
import StudentDashboard from "./Student/StudentDashboard";
import StudentCourses from "./Student/StudentCourses";
import StudentSchedule from "./Student/StudentSchedule";
import StudentAnnouncements from "./Student/StudentAnnouncements";
import StudentProfile from "./Student/StudentProfile";


import DevLayout from "./layout/DevLayout";
import DevDashboard from "./dev/pages/Dashboard.jsx";
import AdminManagement from "./dev/pages/AdminManagement.jsx";
import ActivityLogs from "./dev/pages/ActivityLogs.jsx";
import AuditReports from "./dev/pages/AuditReports.jsx";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/pre-enroll" element={<PreEnrollment />} />


        {/* ===========================
            ADMIN (protected)
           =========================== */}
        <Route element={<RequireRole allow={["admin", "super_admin"]} />}>
        
          <Route path="/admin" element={<AdminLayout />}>
          
            <Route index element={<AdminHome />} />
            <Route path="students/enrollment" element={<Enrollment />} />
            <Route path="students/classes" element={<Classes />} />
            <Route path="teacher/manage" element={<TeacherManage />} />
            <Route path="teacher/schedule" element={<TeacherSchedule />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="announcement" element={<AnnouncementList />} />
                   <Route path="students/enrollment" element={<Enrollment />} />
          <Route path="students/classes" element={<Classes />} />
          <Route path="students/schedule" element={<Schedule />} />
          <Route path="students/section" element={<Section />} />
          <Route path="students/subject" element={<Subject />} />
          <Route path="students/school-year" element={<SchoolYear />} />
          <Route path="teacher/manage" element={<TeacherManage />} />
          <Route path="teacher/schedule" element={<TeacherSchedule />} />

            {/* ✅ admin change password route */}
            <Route path="change-password" element={<ChangePassword />} />
          </Route>
        </Route>

        {/* ===========================
            TEACHER (protected)
           =========================== */}
        <Route element={<RequireRole allow={["teacher"]} />}>
          <Route path="/teacher" element={<TeacherLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="lessons" element={<TeacherLessons />} />
            <Route path="classes" element={<TeacherClasses />} />
            <Route path="schedule" element={<TeacherSchedules />} />
            <Route path="announcements" element={<TeacherAnnouncements />} />
            <Route path="students" element={<TeacherStudents />} />
            <Route path="settings" element={<TeacherSettings />} />

            {/* ✅ teacher change password route */}
            <Route path="change-password" element={<ChangePassword />} />
          </Route>
        </Route>

        {/* ===========================
            STUDENT (protected)
           =========================== */}
        <Route element={<RequireRole allow={["student"]} />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="courses" element={<StudentCourses />} />
            <Route path="schedule" element={<StudentSchedule />} />
            <Route path="announcements" element={<StudentAnnouncements />} />
            <Route path="profile" element={<StudentProfile />} />
           

            {/* ✅ student change password route */}
            <Route path="change-password" element={<ChangePassword />} />
          </Route>
        </Route>


 


        {/* ===========================
            DEV (protected if needed)
           =========================== */}
        <Route element={<RequireRole allow={["dev"]} />}>
          <Route path="/dev" element={<DevLayout />}>
            <Route index element={<DevDashboard />} />
            <Route path="admins" element={<AdminManagement />} />

            <Route path="activity" element={<ActivityLogs />} />
           
            <Route path="audit" element={<AuditReports />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
