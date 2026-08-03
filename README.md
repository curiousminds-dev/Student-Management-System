# School Admin Hub

Production-ready school administration UI

Build a production-ready administrative web application for a Ugandan secondary-school platform called:

Student Attendance, Progress and Welfare Management System

Use the attached image as the primary visual reference for the interface style.

The reference image should guide:

 Sidebar appearance

 Page proportions

 Table styling

 Typography

 Active navigation treatment

 Profile side panel

 White workspace

 Navy and cyan colour palette

 Clean, spacious layout

 Minimal borders and soft shadows

Do not copy the branding, logo, names or exact content from the reference image.

Do not reproduce the tilted presentation angle or blue promotional background. The actual application must be a normal, flat, responsive web interface.

Product purpose

The system helps Ugandan secondary schools manage:

 Learners

 QR identity cards

 Attendance

 Attendance occasions

 Authorized absences

 Welfare observations

 Conduct cases

 Interventions

 Staff permissions

 Registered devices

 Reports

 Parent communication

 Audit activity

 School configuration

This build is for the administrative and staff-facing side only.

Do not build:

 A student mobile application

 A parent mobile application

 A marketing website

 Fees management

 Payroll

 Accounting

 Continuous GPS tracking

 Facial recognition

 Automated punishment

 Medical diagnosis

Students may eventually access an optional browser-based module through school computer laboratories, but that is not part of this build.

Technology

Use:

 React

 TypeScript

 Vite

 Tailwind CSS

 shadcn/ui

 Lucide icons

 React Router

 TanStack Query

 React Hook Form

 Zod

 Recharts

Create a modular frontend that can connect to a REST API later.

Use:

VITE_API_BASE_URL=
VITE_USE_MOCK_DATA=true

Keep API requests in a dedicated service layer.

Do not hardcode application data directly inside page components.

Visual design system

The interface must closely follow the attached reference image.

Overall look

Create a premium, modern school-administration interface with:

 A deep navy sidebar

 A bright cyan or sky-blue active state

 A mostly white workspace

 Very light blue-grey page backgrounds

 Clean tables

 Rounded cards

 Subtle shadows

 Thin dividers

 Compact typography

 Generous whitespace

 Small professional icons

 Minimal decorative elements

The system should feel:

 Serious

 Trustworthy

 Modern

 Calm

 Efficient

 Easy to learn

 Suitable for school administrators

 Suitable for government or investor demonstrations

Avoid:

 Heavy gradients

 Excessive glassmorphism

 Oversized headings

 Cartoon illustrations

 Bright multicolour dashboards

 Very large cards

 Excessively rounded components

 Excessive animation

 Generic AI-style purple gradients

Colour palette

Use a palette inspired by the reference:

Primary navy:       #132465
Sidebar dark:       #0F1E56
Active cyan:        #43BDEB
Active cyan light:  #E8F8FE
Page background:    #F4F8FC
Card background:    #FFFFFF
Primary text:       #1A2440
Secondary text:     #667085
Border:             #E6ECF2
Success:            #22A06B
Warning:            #E9A23B
Danger:             #D64545
Information:        #2F80ED

The active sidebar item should use a cyan-filled rectangular highlight similar to the reference image.

Do not use red unless the information requires urgent attention.

Typography

Use a clean modern font such as:

 Inter

 Manrope

 DM Sans

Typography should be compact and professional.

Recommended scale:

Page title:       24–28px, semibold
Section title:    17–20px, semibold
Card title:       14–16px, semibold
Body:             13–14px
Table text:       12–13px
Labels:           11–12px

Avoid oversized dashboard typography.

Application shell

Create a responsive application shell inspired by the reference image.

Left sidebar

The sidebar should be:

 Fixed on desktop

 Collapsible

 Deep navy

 Approximately 230–250px wide

 Icon-and-label based

 Compact

 Professionally spaced

 Scrollable when necessary

At the top show:

 School logo

 School name

 Small campus or institution label

Use fictional branding:

Nile Crest Secondary School
Kampala Campus

Use a simple placeholder logo that can be replaced later.

Navigation:

 Dashboard

 Learners

 Attendance

 Occasions

 Observations

 Cases

 Welfare

 Academics

 Reports

 Communication

 Staff and Roles

 Devices

 Audit Logs

 School Settings

Group navigation into sections where appropriate.

Example:

OVERVIEW
Dashboard

LEARNER MANAGEMENT
Learners
Attendance
Occasions

LEARNER SUPPORT
Observations
Cases
Welfare
Academics

ADMINISTRATION
Reports
Communication
Staff and Roles
Devices
Audit Logs
School Settings

The active menu item should have:

 Cyan background

 White text

 White or navy icon depending on contrast

 Slightly rounded corners

 No glowing effect

Support collapsed icon-only mode.

Top bar

Create a slim white top bar.

Include:

 Breadcrumbs

 Page title

 Current term selector

 Campus selector

 Search

 Synchronization status

 Notifications

 User avatar

 User name

 Role

 Profile menu

Example term selector:

Term 2 · 2026

The user menu should support:

 My profile

 Change password

 Help

 Log out

Main content layout

Use a white or light-grey working area.

The reference image contains:

 A main table area

 A right-side profile details panel

Use this structure where appropriate.

For learner and staff pages:

Main data table: 70–75%
Details panel:   25–30%

When a row is selected:

 Highlight the selected row in cyan

 Open a right-side details panel

 Show photograph, name and key information

 Keep the table visible

 Allow the details panel to collapse

On smaller screens, the details panel should open as a drawer.

Dashboard

Create a compact but informative dashboard.

Header

Show:

Good morning, Administrator
Here is today’s school attendance and learner-support overview.

Include the current date and term.

Summary cards

Use six compact cards:

 Active learners

 Present today

 Late today

 Unexplained absences

 Open welfare concerns

 Devices awaiting synchronization

Cards should have:

 Small icon

 Label

 Main number

 Small change indicator

 Minimal background decoration

Do not use large colourful blocks.

Dashboard charts

Include:

 Seven-day attendance trend

 Attendance status distribution

 Attendance by class

 Cases and interventions status

Charts must use the navy, cyan, green and amber palette.

Operational sections

Include:

 Today’s occasions

 Recent unexplained absences

 Serious cases requiring review

 Devices with sync problems

 Recent staff actions

 Quick actions

Quick actions:

 Add learner

 Import learners

 Create occasion

 Start scanning

 Record observation

 Authorize absence

 Generate report

 Add staff member

Learners page

This page should visually resemble the attached reference most closely.

Page header

Include:

 Learners title

 Learner count

 Add learner button

 Import CSV button

 Export CSV button

Toolbar

Include:

 Search by name, admission number or LIN

 Class filter

 Stream filter

 Day/boarding filter

 Gender filter

 Status filter

 QR-card status filter

 Reset filters

Table

Columns:

 Student

 Admission number

 LIN

 Class

 Stream

 Gender

 Day/boarding

 Today’s status

 Attendance percentage

 QR status

 Guardian contact

 Actions

The Student column should include:

 Small circular photograph

 Full name

 Admission number beneath the name

The selected row should use the same cyan treatment as the reference image.

Use:

 Sticky table header

 Pagination

 Sortable columns

 Column visibility controls

 Density selector

 Loading skeleton

 Empty state

 Error state

Learner details side panel

When a learner is selected, show:

 Large circular photograph

 Full name

 Admission number

 Class and stream

 Attendance status today

 QR-card status

 Guardian contact

 Day or boarding status

 Age

 House

 Dormitory

 Attendance percentage

 Recent observations

 Active intervention

 Emergency contact

Quick actions:

 Open full profile

 View QR card

 Record attendance

 Record observation

 Authorize absence

 Contact guardian

The right panel should resemble the selected-profile panel in the reference image.

Learner registration

Create a professional multi-step registration form.

Steps:

 Personal details

 Enrolment

 Guardian details

 Boarding and transport

 Emergency contact

 Consent and privacy

 QR credential

Fields should use:

 Clear labels

 Inline validation

 Helper text

 Required-field indicators

 Save draft

 Previous and next navigation

 Final confirmation screen

Learner profile

Create a full learner profile with a compact header and tabs.

Tabs:

 Overview

 Attendance

 Academics

 Conduct

 Welfare

 Health encounters

 Participation

 Interventions

 Documents

 Timeline

Header information:

 Photograph

 Full name

 Admission number

 LIN

 Class and stream

 Boarding status

 QR-card status

 Current attendance status

Actions:

 Edit profile

 Replace QR card

 Record observation

 Authorize absence

 Print summary

 More actions

Restricted tabs must display permission indicators.

QR-card management

Create QR-card controls inside the learner profile.

Support:

 Generate QR credential

 Preview QR code

 Print card

 Download card

 View issue date

 Revoke credential

 Replace lost card

 View previous credentials

Revocation or replacement must require:

 Reason

 Confirmation

 Responsible staff member

 Date and time

Do not encode readable personal information inside the QR code.

Attendance page

Create a modern attendance workspace.

Include:

 Attendance overview

 Today’s attendance

 Recent scans

 Unreconciled absences

 Active occasions

 Closed occasions

 Device synchronization

Summary indicators:

 Expected

 Present

 Late

 Excused

 Unexplained

 Pending reconciliation

Attendance table

Columns:

 Learner

 Admission number

 Class

 Occasion

 Status

 Scan time

 Device

 Recorded by

 Reconciliation status

 Actions

Use compact coloured status badges.

Support:

 Date selection

 Class filtering

 Occasion filtering

 Status filtering

 Search

 Export

 Print

 Bulk reconciliation

Attendance occasions

Create occasion pages for:

 Gate entry

 Gate exit

 Morning assembly

 Evening assembly

 Class lesson

 Examination

 Morning prep

 Evening prep

 Dormitory roll call

 Dining

 Sick bay

 Transport

 Sports

 Clubs

 Trips

 Official duty

Each occasion card or row should show:

 Name

 Category

 Date

 Start and end time

 Expected learners

 Scanned learners

 Completion percentage

 Responsible staff

 Location

 Status

Actions:

 Start

 Pause

 Close

 Reopen with permission

 Reconcile

 Export register

 View details

Scanning interface

Create a separate full-screen scanning mode.

It should be suitable for:

 Android phones

 Tablets

 Laptop webcams

 USB QR scanners

Include:

 Current occasion

 Checkpoint

 Staff member

 Device name

 Online/offline status

 Pending sync count

 Large scanner area

 Manual credential entry

 Recent scans

 Sound toggle

 Flash toggle

 Camera switch

 Close occasion

Successful scan

Show:

 Large learner photograph

 Learner name

 Admission number

 Class and stream

 Attendance status

 Scan time

 Occasion

 Green confirmation

Warning states

Support:

 Duplicate scan

 Late arrival

 Wrong class

 Wrong group

 Wrong bus

 Revoked card

 Unknown QR

 Learner not expected

 Disabled device

 Offline scan queued

Use large, immediate and clearly differentiated feedback.

Offline synchronization centre

Create a device synchronization page.

Show:

 Device

 Assigned location

 Last sync

 Pending records

 Failed records

 Conflicts

 Connection status

 Progress

 Software version

Statuses:

 Synced

 Pending

 Syncing

 Failed

 Conflict

 Disabled

Actions:

 Synchronize now

 Retry failed

 View conflicts

 Resolve conflict

 Disable device

 View history

Observations

Create an observation list and creation workflow.

Categories:

 Positive conduct

 Academic observation

 Minor concern

 Welfare concern

 General observation

 Serious alleged incident

Capture:

 Learner

 Category

 Severity

 Date and time

 Location

 Related occasion

 Factual description

 Immediate action

 Recommended follow-up

 Witnesses

 Attachments

 Parent-contact recommendation

Do not permanently label learners.

Do not use phrases such as “bad student.”

Cases and interventions

Create a fair case-review interface.

Stages:

 Submitted

 Assigned

 Learner response

 Evidence review

 Finding

 Intervention

 Review

 Closure

Possible findings:

 Confirmed

 Unconfirmed

 Dismissed

 Referred

Create:

 Case list

 Case details

 Assigned reviewer

 Learner response

 Evidence

 Parent-contact history

 Actions

 Review date

 Timeline

 Closure status

 Audit history

Sensitive case descriptions must not appear on general dashboards.

Welfare workspace

Create a restricted welfare module.

Include:

 Authorized absences

 Sick-bay activity

 Welfare concerns

 Counselling referrals

 Safeguarding follow-up

 Support plans

 Assigned interventions

Use:

 Restricted-access labels

 Privacy warnings

 Confidential-data icons

 Permission-denied states

Ordinary teachers, security staff and transport officers must not see confidential counselling or health notes.

Academics module

Create an API-ready academic area.

Include:

 Subjects

 Assessments

 Marks entry

 Competency tracking

 Grade boundaries

 Subject analysis

 Class analysis

 Learner progress

 Missing work

 Teacher completion

 Report cards

Use Ugandan terminology:

 Senior One to Senior Six

 O-Level

 A-Level

 Term One, Two and Three

 Classes

 Streams

 UNEB number

 Learner Identification Number

 Lower-secondary competency assessment

Ranking must be optional.

Staff and roles

Create a staff page visually similar to the learners page.

Table columns:

 Staff member

 Staff number

 Department

 Role

 Assigned classes

 Assigned device

 Account status

 Last login

 Actions

Selecting a staff row should open a right-side profile panel.

Support:

 Add staff member

 Invite account

 Reset password

 Suspend account

 Change role

 View permissions

 View activity

 Assign device

Create a permissions matrix.

Devices

Create a device management table.

Example devices:

 Main Gate Tablet 01

 Assembly Scanner 02

 Boys’ Dormitory Phone

 Girls’ Dormitory Phone

 School Bus 03 Tablet

Columns:

 Device

 Type

 Assigned user

 Location

 Status

 Last synchronization

 Pending records

 Version

 Last activity

 Actions

Reports

Create a report centre using neat cards and tables.

Categories:

Attendance

 Daily register

 Weekly summary

 Term report

 Late-coming report

 Unexplained absence

 Authorized absence

 Attendance by class

 Attendance by learner

Welfare and conduct

 Positive conduct

 Open concerns

 Case status

 Intervention follow-up

 Sick-bay summary

Administration

 Device synchronization

 Audit report

 Staff activity

 QR replacements

 Data quality

Support:

 Date range

 Class

 Stream

 Occasion

 PDF

 CSV

 Print preview

 Restricted-report warnings

Communication

Create a communication centre for:

 SMS templates

 Absence alerts

 Arrival notifications

 Reporting dates

 Parent meetings

 Intervention follow-ups

 Delivery history

 Failed messages

Do not place detailed medical, counselling or disciplinary information inside ordinary SMS messages.

Use safe wording such as:

Please contact the school regarding an important learner-support matter.

Audit logs

Create a read-only audit interface.

Columns:

 Date and time

 User

 Role

 Action

 Module

 Record

 Device

 IP address

 Reason

 Result

Allow authorized administrators to inspect previous and new values in a side drawer.

School settings

Create settings for:

 School profile

 Branding

 Campuses

 Academic years

 Terms

 Classes

 Streams

 Houses

 Dormitories

 Subjects

 Attendance rules

 Late thresholds

 Observation categories

 Notifications

 Grading

 Retention

 Backups

 Privacy notices

 Consent

 Languages

English should be active first.

Prepare the architecture for future Luganda and Kiswahili localization.

Role-based interface

Support demonstration accounts for:

 School administrator

 Headteacher

 Director of Studies

 Teacher

 Security officer

 Nurse

 Warden

 Transport officer

After login:

 Change navigation based on role

 Change dashboard content based on role

 Hide inaccessible pages

 Block direct URL access

 Show a proper permission-denied page

 Do not rely only on hidden menu items

Examples:

Security officer

Can see:

 Gate scanning

 Basic learner identity

 Permitted exits

 Assigned device

 Sync status

Cannot see:

 Marks

 Conduct details

 Welfare details

 Medical information

 Staff administration

Nurse

Can see:

 Sick-bay attendance

 Health encounters

 Approved learner identity

 Return-to-class status

Cannot see:

 Full conduct case details

 Staff administration

 Academic rankings unless specifically permitted

Production requirements

Every page must include:

 Loading state

 Skeleton state

 Empty state

 Error state

 Success feedback

 Form validation

 Confirmation dialogs

 Permission-denied state

 Responsive layout

 Keyboard navigation

 Accessible labels

 Visible focus states

 Strong contrast

 Tooltips

 Pagination

 Filtering

 Sorting

 Search

 Realistic mock data

Use fictional Ugandan names and data.

Do not use Lorem Ipsum.

Use examples such as:

 Amina Nansubuga

 Daniel Okello

 Sarah Namusoke

 Joshua Kato

 Faith Atim

 Brian Ssemanda

 Lydia Nabirye

 Moses Ochieng

Use telephone formats such as:

+256 7XX XXX XXX

Responsive behaviour

Desktop

 Full sidebar

 Data table

 Right profile panel

 Multi-column dashboard

Tablet

 Collapsible sidebar

 Main table

 Details drawer

 Two-column dashboard

Mobile

 Navigation drawer

 Card-based data presentation where tables do not fit

 Bottom sheet for filters

 Full-screen profile details

 Large scanning controls

The design should remain professional and usable at every screen size.

Reusable components

Create reusable components for:

 Application shell

 Sidebar

 Top bar

 Page header

 Search field

 Filter bar

 Data table

 Status badge

 Profile summary panel

 Metric card

 Chart card

 Empty state

 Error state

 Permission warning

 Sensitive-data notice

 Confirmation dialog

 QR preview

 Sync status

 Activity timeline

 Audit drawer

 Form field

 File upload

 Pagination

Data interfaces

Create TypeScript interfaces for:

 School

 Campus

 AcademicYear

 Term

 Staff

 User

 Role

 Permission

 Learner

 Guardian

 Enrollment

 QRCredential

 AttendanceOccasion

 ScanEvent

 AttendanceRecord

 AuthorizedAbsence

 Observation

 Case

 Intervention

 Device

 SyncRecord

 Notification

 AuditEvent

API preparation

Prepare services for:

/auth/login
/auth/me
/dashboard
/learners
/learners/:id
/learners/:id/qr-credentials
/attendance
/attendance/occasions
/attendance/scans
/attendance/sync
/observations
/cases
/interventions
/welfare
/academics
/staff
/roles
/devices
/reports
/notifications
/audit-logs
/settings

Use mock responses while VITE_USE_MOCK_DATA=true.

Implementation order

Build in this order:

 Design system

 Authentication

 Application shell

 Dashboard

 Learners table

 Learner profile panel

 Full learner profile

 Attendance dashboard

 Attendance occasions

 Scanning interface

 Synchronization centre

 Observations

 Cases

 Welfare

 Staff and roles

 Devices

 Reports

 Audit logs

 School settings

Final quality instruction

The final interface must feel like the attached reference image evolved into a real production SaaS application.

Maintain:

 Deep navy sidebar

 Cyan selection highlights

 White data workspace

 Compact tables

 Right-side profile details

 Clean typography

 Professional spacing

 Minimal visual noise

Do not produce a generic dashboard template.

Do not leave buttons without functionality.

Do not create blank routes.

Do not use fake controls that do nothing.

Create realistic navigation, populated screens and reusable production-quality components.

The result should be polished enough to demonstrate to:

 A Ugandan school owner

 A headteacher

 A school administrator

 A government education stakeholder

 A pilot-school committee

 An investor

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/00de97b3-ca44-4cbd-bfe3-374f0646f608).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
