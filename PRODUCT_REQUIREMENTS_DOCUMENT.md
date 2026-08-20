
# HostelHQ - Product Requirements Document (PRD)

**Version:** 1.0
**Date:** July 30, 2024
**Status:** Live

---

## 1. Introduction

### 1.1. Vision & Purpose
This document outlines the product requirements for HostelHQ, a comprehensive web platform designed to streamline the process of finding, booking, and managing student hostel accommodations in Ghana, with an initial focus on students from AAMUSTED University.

The purpose of HostelHQ is to bridge the gap between students seeking reliable accommodation and property managers/agents looking to fill their vacancies. It aims to replace the traditional, inefficient methods of hostel hunting with a centralized, secure, and user-friendly online experience.

### 1.2. Scope
This PRD covers the features and functionality of the initial version of the HostelHQ platform, encompassing the core user flows for four primary user roles: Students, Agents, Hostel Managers, and Administrators. The scope includes property listing, search and discovery, guided and self-guided visit booking, secure room payments, automated tenancy agreement generation, and dashboards for management and administration.

---

## 2. User Roles & Personas

### 2.1. Student
- **Goal:** To find and secure a safe, affordable, and convenient hostel room near campus with minimal hassle.
- **Key Actions:**
    - Search and filter for hostels.
    - View detailed hostel information, including photos, amenities, room types, and reviews.
    - Book a hostel visit, either guided by an agent or self-guided.
    - Track the status of their visit requests.
    - Secure a room by providing personal details and making an online payment.
    - Receive and download a legally binding tenancy agreement.
    - Leave reviews for hostels after a visit.

### 2.2. Agent
- **Goal:** To list and manage multiple hostel properties, facilitate student visits, and earn commissions.
- **Key Actions:**
    - Register for an agent account (which requires admin approval).
    - Upload new hostel listings through a multi-step form.
    - Leverage AI to enhance hostel descriptions.
    - View and edit their existing listings.
    - Receive and manage visit requests from students through a dedicated dashboard.
    - Accept or decline visit requests.
    - Mark visits as complete.

### 2.3. Hostel Manager
- **Goal:** To oversee the performance of their hostel properties, track revenue, and ensure high occupancy rates.
- **Key Actions:**
    - Register for a manager account.
    - View a dashboard summarizing key performance indicators (KPIs) for their managed properties.
    - Track total bookings and total revenue.
    - Analyze monthly booking trends through a data visualization chart.
    - View a list of all hostels under their management.

### 2.4. Administrator (Admin)
- **Goal:** To maintain the health, integrity, and quality of the platform.
- **Key Actions:**
    - Access a comprehensive admin dashboard.
    - Review and approve/reject new hostel listings submitted by agents.
    - Review and approve/reject new agent account applications.
    - Moderate and approve/reject student-submitted reviews.
    - Manage all users, including the ability to change roles.
    - Manage live hostel listings, including setting featured status and availability.
    - Monitor real-time agent online status.

---

## 3. Core Features & Functionality

### 3.1. Authentication & User Management
- **User Roles:** The system supports four distinct roles: `student`, `agent`, `hostel_manager`, and `admin`. A `pending_agent` role is used for agents awaiting approval.
- **Email-Based Roles:** User roles are determined by the email address format used during signup (e.g., `...@student.hostelhq.com`, `...@agent.hostelhq.com`).
- **Signup Flow:**
    - A single signup page handles registration for all roles.
    - Agents who sign up are placed in a `pendingUsers` collection and must be approved by an Admin.
    - Managers must accept a standard tenancy agreement during signup.
- **Login Flow:** Users log in with email and password. Pending agents are prevented from logging in and shown an "approval pending" message.
- **Firebase Auth:** User authentication is managed by Firebase Authentication. User profile data, including roles, is stored in a `users` collection in Firestore.

### 3.2. Hostel Discovery & Details
- **Homepage:**
    - Features a prominent search bar for hostel name and location.
    - Displays a "Featured Hostels" section.
    - Lists all other available hostels.
- **Search Functionality:**
    - The search form updates the URL with search parameters, triggering a server-side search.
    - The `getHostels` function queries Firestore based on `name` and `location` search terms.
- **Hostel Details Page (`/hostels/[id]`):**
    - Displays comprehensive information about a single hostel.
    - **For Logged-Out Users:** Shows limited information (first few images, basic amenities, price range) to encourage signup.
    - **For Logged-In Students:** Unlocks full details, including all images, room types with pricing, all amenities, full description, and student reviews.
    - **Smart "Book/Secure" Button:** The primary call-to-action button intelligently changes based on the student's history with that hostel (e.g., "Book a Visit", "Track Visit", "Secure Room").

### 3.3. Hostel Listing & Management (Agent & Admin)
- **Agent Upload Form (`/agent/upload`):**
    - A multi-step form guides agents through listing a new hostel.
    - **Steps:** Basic Info -> Room Types & Pricing -> Facilities & Location -> Description & Photos -> Final Submission.
    - Agents can add multiple room types with individual pricing and availability.
    - Agents can upload up to 5 photos, which are processed and hosted via Cloudinary.
    - **AI Enhancement:** The initial description is automatically enhanced by a Genkit AI flow (`enhanceHostelDescription`) to create more compelling copy.
- **Agent Listings Page (`/agent/listings`):**
    - Agents can view a table of all their submitted hostels.
    - Displays the approval status (`pending` or `approved`) and availability of each listing.
- **Edit Listing Page (`/agent/listings/edit/[id]`):**
    - Agents can edit all details of their listings.
    - The form is pre-populated with existing data.
    - Changes to approved listings are live immediately; changes to pending listings are saved for review.
- **Admin Approval (Admin Dashboard):**
    - Admins review pending hostels in a dedicated dialog.
    - The dialog shows all details, including images, room types, and amenities.
    - Admins can "Approve" (moves the document from `pendingHostels` to `hostels` collection) or "Reject" (deletes the document).

### 3.4. Booking & Payment Flow
- **Visit Booking (`/hostels/[id]/book`):**
    - Students choose between a "Visit with an Agent" or a "Visit by Yourself".
    - Each option has a distinct fee (e.g., GH₵12 vs. GH₵15).
    - Payment is handled via Paystack Mobile Money.
- **Payment Initialization (`/app/actions/paystack.ts`):**
    - A server action `initializeMomoPayment` communicates with the Paystack API.
    - It constructs a `callback_url` with necessary parameters (`hostelId`, `visitType`, etc.) to handle post-payment logic.
- **Visit Scheduling (`/hostels/book/schedule`):**
    - After paying for an agent-guided visit, students are directed here.
    - The page displays a list of currently online agents (using Ably for real-time presence).
    - The student selects an agent, date, and time to finalize their visit request.
- **Room Securing (`/hostels/[id]/secure`):**
    - After a successful visit, students can secure a room.
    - They fill out a form with personal details required for the tenancy agreement (Full Name, Index Number, Ghana Card, etc.).
    - Payment for the full year's rent is initiated via `initializeHostelPayment`.
- **Booking Confirmation (`/hostels/book/confirmation`):**
    - This is the callback URL from Paystack.
    - It verifies the payment reference and creates a document in either the `visits` or `bookings` Firestore collection.
    - For room security payments, it creates a `bookings` record and redirects to the tenancy agreement page.
    - For visit payments, it creates a `visits` record and redirects to either the tracking or scheduling page.

### 3.5. Tenancy Agreement Generation
- **Standardized Template (`/lib/legal.ts`):**
    - The system uses a single, standardized tenancy agreement template for all hostels to ensure consistency and simplicity.
- **Agreement Page (`/agreement/[bookingId]`):**
    - A dynamic page that generates the agreement based on a `bookingId`.
    - It fetches data from the `bookings`, `users`, and `hostels` collections.
    - It dynamically replaces placeholders in the template (e.g., `{{studentName}}`, `{{hostelName}}`).
- **PDF Generation & Download:**
    - The page uses `html2canvas` to capture the rendered agreement as an image.
    - It then uses `jspdf` to convert this image into a multi-page A4 PDF.
    - A "Download PDF" button allows the student to save the agreement.

### 3.6. Dashboards
- **Admin Dashboard (`/admin/dashboard`):**
    - **KPI Cards:** Total Students, Total Agents, Online Agents, Approved Listings, Pending Approvals.
    - **Approval Queues:** Tables for pending hostels, pending agents, and pending reviews.
    - **Management Tables:** Live hostel management (toggle featured/availability), user role management.
    - **Real-Time Agent Monitoring:** A table shows which agents are currently online, powered by Ably presence.
- **Agent Dashboard (`/agent/dashboard`):**
    - Focused on managing visit requests.
    - Displays a table of incoming requests with student and hostel details.
    - Provides actions to "Accept", "Decline", or "Mark as Complete".
- **Manager Dashboard (`/manager/dashboard`):**
    - **KPI Cards:** "Total Revenue" and "Total Bookings" for the manager's properties.
    - **My Hostels:** A table listing all hostels managed by the user.
    - **Bookings Chart:** A real-time bar chart showing monthly booking trends for the current year.
- **Student "My Bookings & Visits" Page (`/my-visits`):**
    - A tabbed interface to separate confirmed room bookings from visit requests.
    - **Bookings Tab:** Lists secured rooms and provides a link to view the tenancy agreement.
    - **Visits Tab:** Lists all past and present visit requests, showing status and providing a link to track the visit.

### 3.7. Real-Time & Location Features
- **Ably Integration:**
    - **Agent Presence:** The `agents:live` channel tracks which agents are online. This is used on the Admin dashboard and the student's scheduling page.
    - **Agent GPS Tracking:** Each agent publishes their GPS coordinates to a unique channel (`agent:[agentId]:gps`).
- **Mapbox Integration (`/components/map.tsx`):**
    - The visit tracking page (`/hostels/[id]/book/tracking`) displays a Mapbox map.
    - It subscribes to the agent's GPS channel on Ably to show the agent's location moving in real-time.
    - It also displays a static marker for the hostel's location.

---

## 4. Technical Stack & Architecture

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript
- **UI:** ShadCN UI components, Tailwind CSS
- **Database:** Firebase Firestore (for all application data)
- **Authentication:** Firebase Authentication
- **Real-Time:** Ably (for agent presence and live location tracking)
- **Payments:** Paystack API
- **Image Management:** Cloudinary API (for image upload, optimization, and hosting)
- **Generative AI:** Google Genkit (`@genkit-ai/googleai`) for AI-powered description enhancement.
- **Mapping:** Mapbox GL JS
- **PDF Generation:** jspdf, html2canvas

### 4.1. Firestore Data Model
- `users/{userId}`: Stores user profile data (name, email, role).
- `pendingUsers/{userId}`: Stores agent applications awaiting admin approval.
- `hostels/{hostelId}`: Stores approved hostel listings.
    - `.../roomTypes/{roomTypeId}`: Subcollection for different rooms in a hostel.
- `pendingHostels/{hostelId}`: Stores agent-submitted hostels awaiting admin approval.
    - `.../roomTypes/{roomTypeId}`: Subcollection for room types.
- `reviews/{reviewId}`: Stores student reviews. A `status` field (`pending`/`approved`) is used for moderation.
- `visits/{visitId}`: Stores records of all visit requests, linking student, agent, and hostel.
- `bookings/{bookingId}`: Stores records of successful room security payments, linking a student to a hostel.

---

## 5. Non-Functional Requirements

- **Performance:** The app uses Next.js server components by default to minimize client-side JavaScript. Images are optimized via Cloudinary and `next/image`.
- **Scalability:** The serverless nature of Firebase and Vercel hosting allows the application to scale automatically with traffic.
- **Usability:** The interface is designed to be intuitive and responsive, providing a seamless experience on both desktop and mobile devices.
- **Security:**
    - Authentication is handled by the robust Firebase Auth service.
    - Firestore Security Rules are intended to be configured to restrict data access based on user roles and ownership.
    - Environment variables are used for all sensitive API keys.
- **Reliability:** Real-time features are powered by the highly reliable Ably network. Offline data access is enabled via Firestore's IndexedDB persistence, with graceful error handling for potential browser storage issues.
