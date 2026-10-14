# Remaining Tasks

## 1. Admin Dashboard
- **Visitor Analytics (Dashboard Page):** Integrate Google Analytics 4 (GA4) Data API to fetch real Visitor Analytics (unique visitors and returning sessions) for the visitor statistics chart.

## 2. User Profile & Artwork
- **Artwork Appreciation:**
  - Implement artwork appreciation features.
  - Update the Gold appreciation artwork badge to a more vibrant gold/yellow looking award design.
- **User Slideshow:**
  - Implement user slideshow functionality.
- **Standalone 1-Minute Video Comment:**
  - Add an option in the user panel to upload a separate 1-minute video comment without adding photos.
  - Display under the user's "My Artwork" section alongside photos and albums, sorted chronologically by upload date and time.
  - Keep separate from competitions (only 1, 6, and 12-photo albums participate in competitions).
- **AI Declaration & Badge for Videos:**
  - Add a confirmation tick-box during video upload asking users to declare: *"Was that video made by AI?"*
  - Applies to:
    - Personal profile video
    - Photo video comment
    - Standalone 1-minute video comment
  - Display the "AI Badge" on the video when marked as AI-generated.

## 3. Safety & Content Moderation (New Scope)
- **Automated NSFW & Explicit Content Moderation:**
  - Integrate an automated AI moderation service (Sightengine API) to scan uploaded photos in real-time.
  - Automatically detect and block explicit adult content, pornography, and child abuse material before photos are saved or published.

## 4. Server & Infrastructure Deployment (Pending Client Credentials)
- **Backend & Database Hosting:** Configure Node.js backend and PostgreSQL database on the production server (VPS / Cloud).
- **Domain & DNS:** Connect live domain and configure Cloudflare DNS / SSL.
- **Cloudflare R2 Storage:** Configure Cloudflare R2 bucket and credentials for storing uploaded photos and videos.
- **Mailgun Email / SMTP:** Setup Mailgun API / SMTP with verified sending domain for system transactional emails (auth, notifications).
