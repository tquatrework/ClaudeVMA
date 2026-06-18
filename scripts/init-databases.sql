-- Init script: create one database per service
-- Runs automatically on first postgres container start

-- Phase 1
CREATE DATABASE visiomath_calendar;
CREATE DATABASE visiomath_communication;
CREATE DATABASE visiomath_dashboard_notification;
CREATE DATABASE visiomath_identity_access;
CREATE DATABASE visiomath_orchestration;
CREATE DATABASE visiomath_pedagogical_log;
CREATE DATABASE visiomath_profile;
CREATE DATABASE visiomath_teacher_request;
CREATE DATABASE visiomath_video_session;

-- Phase 2
CREATE DATABASE visiomath_admin_observability;
CREATE DATABASE visiomath_archive_document;
CREATE DATABASE visiomath_finance_credit;
CREATE DATABASE visiomath_legal_document;

-- Phase 3
CREATE DATABASE visiomath_content_catalog;
CREATE DATABASE visiomath_learning_activity;
CREATE DATABASE visiomath_community_path;

