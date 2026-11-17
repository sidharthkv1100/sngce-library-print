# SNGCE Central Library Print Queue System

An automated document printing queue, payment verification, and order management platform built for **Sree Narayana Gurukulam College of Engineering (SNGCE) Central Library**, Kadayiruppu, Kolenchery.

Designed to streamline campus document printing, eliminate library counter congestion, and provide transparent status tracking for students and library staff.

---

## Key Features

### 1. Student Portal (`/`)
* **Google Authentication**: Seamless sign-in using Google accounts (college domain `@sngce.ac.in` and personal student accounts).
* **Instant PDF Page Counting**: Client-side parsing using PDF.js to extract exact page counts instantaneously before submission.
* **Flexible Layouts & Dynamic Fee Engine**:
  * **Black & White**: ₹2 per physical sheet. Supports Single-sided, Double-sided (back-to-back), and 4-in-1 layouts (`Math.ceil(totalPages / pagesPerSheet) * 2 * copies`).
  * **Colour**: Flat ₹10 per PDF page (`totalPages * 10 * copies`).
  * **Custom Copies**: Dropdown supports 1, 2, 3, 4, 5, 10 copies or a `Custom...` numerical input for any quantity.
* **Pickup Slot Scheduling**: Morning (8:30 AM – 9:30 AM), Noon (12:30 PM – 1:30 PM), or Evening (3:30 PM – 4:30 PM).
* **Integrated UPI Payment**: Dynamic QR code generation, 12-digit UTR transaction validation, and payment screenshot proof upload.
* **Private Live Order Tracker**: Real-time order progress (In Queue $\rightarrow$ Ready for Pickup $\rightarrow$ Collected) isolated strictly to the logged-in student's submissions.

### 2. Librarian Desk (`/admin`)
* **Strict Role-Based Security**: Accessible exclusively by designated library administration emails (`ADMIN_EMAILS`). Unauthorized students are automatically bounced back to `/`.
* **Live Queue Dashboard**: Real-time Supabase subscriptions displaying incoming jobs with quick stats (Total Jobs, Pending, Ready, Revenue).
* **One-Click Actions**: In-browser PDF document viewer, payment proof modal, token callouts, and instant status transitions.
* **Pickup Slot & Status Filtering**: Easily filter queues by Morning, Noon, or Evening slots and search by Student Name, Roll Number, or Token ID.
* **CSV Export**: Export queue logs for daily accounting and audit records.

### 3. Automated Storage & Record Maintenance (`vercel.json`)
* **24-Hour Cleanup Cron**: Daily scheduled maintenance job running at `0 0 * * *` (midnight UTC) via `/api/cron/cleanup`.
* Automatically purges printed document PDFs and payment receipts older than 24 hours from Supabase Storage and records, preventing storage quota exhaustion.

---

## Tech Stack

* **Framework**: Next.js 16 (App Router with Webpack)
* **Language**: TypeScript
* **Styling**: Tailwind CSS
* **Authentication**: NextAuth.js with Google OAuth Provider
* **Database & Storage**: Supabase (PostgreSQL & Storage Buckets)
* **Client-side PDF Analysis**: PDF.js (Mozilla)
* **Icons**: Lucide React
* **Deployment Target**: Vercel

---

## Required Environment Variables for Vercel

When deploying to Vercel, navigate to **Project Settings $\rightarrow$ Environment Variables** and configure the following:

| Variable Name | Required | Description | Example / Recommended Value |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Your Supabase project URL | `https://xyzcompany.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anonymous public API key | `eyJhbGciOi...` |
| `NEXTAUTH_URL` | **Yes** | Canonical URL of the deployed application | `https://your-project.vercel.app` (or custom domain) |
| `NEXTAUTH_SECRET` | **Yes** | Cryptographic secret for JWT encryption | Generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | **Yes** | OAuth 2.0 Client ID from Google Cloud Console | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | **Yes** | OAuth 2.0 Client Secret from Google Cloud Console | `GOCSPX-xxxx` |
| `ADMIN_EMAILS` | **Yes** | Comma-separated list of authorized Librarian emails | `sidharthkv1100@gmail.com,photocopysng@gmail.com` |
| `LIBRARIAN_EMAIL` | Optional | Primary librarian email (fallback) | `sidharthkv1100@gmail.com` |
| `CRON_SECRET` | **Yes** | Bearer secret for securing the 24-hr cleanup cron | Any strong random string |

> **Important (Google Cloud Console Configuration)**:
> In the [Google Cloud Console](https://console.cloud.google.com/) under **APIs & Services $\rightarrow$ Credentials $\rightarrow$ Authorized redirect URIs**, you must add:
> 1. `http://localhost:3000/api/auth/callback/google` (for local development)
> 2. `https://<your-vercel-domain>.vercel.app/api/auth/callback/google` (for production)
> 
> Also make sure authorized test user emails (e.g. `sidharthkv1100@gmail.com`) are added under **OAuth consent screen $\rightarrow$ Test users** if the app status is set to *Testing*.

---

## Database Setup (Supabase)

Before launching, run the SQL script located in [`supabase_setup.sql`](./supabase_setup.sql) inside your Supabase **SQL Editor**. This will:
1. Create the `print_orders` table with automated `token` identity generation starting at 101.
2. Create the `print_files` storage bucket and configure public access policies.
3. Configure Row-Level Security (RLS) policies for orders and uploads.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment variables
cp .env.example .env.local

# 3. Start local development server
npm run dev

# 4. Verify TypeScript and production build
npm run build
```

The application will be live at `http://localhost:3000`.

---

## License & Attribution

Designed and maintained for **Sree Narayana Gurukulam College of Engineering (SNGCE)** Central Library.
All rights reserved.
