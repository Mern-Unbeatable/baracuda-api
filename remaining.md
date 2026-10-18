# Remaining Tasks

## 1. Admin Dashboard
- **Visitor Analytics (Dashboard Page):** Integrate Google Analytics 4 (GA4) Data API to fetch real Visitor Analytics (unique visitors and returning sessions) for the visitor statistics chart.

## 2. User Profile & Artwork
- [x] ~~**Artwork Appreciation:**~~ ✅ *(Completed — Module, Sunday weekly reset, profile & artwork API integration, Postman endpoints)*
- [x] ~~**User Slideshow:**~~ ✅ *(Completed — SlideshowModule, unified query across Competitions, Gallery/Profile & Marketplace Sell Images, pagination with limit 15, load more support, user & source filtering, Postman collection updated)*
- [x] ~~**Standalone 1-Minute Video Comment:**~~ ✅ *(Completed — Upload separate 1-minute video comment without photos, strict <=60s duration validation, auto thumbnail generation, merged into "My Artwork" and profile chronologically, excluded from competitions)*
- [x] ~~**AI Declaration & Badge for Videos:**~~ ✅ *(Completed — `isAiGenerated` tickbox & `aiBadge: true/false` indicator on video player & cards across profile & standalone video comments)*

## 3. Safety & Content Moderation (New Scope)
- [x] ~~**Automated NSFW & Explicit Content Moderation:**~~ ✅ *(Completed — Integrated Sightengine API with real-time inspection for all 14 image/video upload endpoints across 12 modules. Built `ModerationService` and `moderateUploadedContent` middleware. Automatically blocks and deletes explicit adult nudity, pornography, sexual acts, CSAM, and extreme violence/gore before files are stored or published; provides immediate 400 Bad Request response with violation reason and instant disk cleanup).*

## 4. Server & Infrastructure Deployment (Pending Client Credentials)
- **Backend & Database Hosting:** Configure Node.js backend and PostgreSQL database on the production server (VPS / Cloud).
- **Domain & DNS:** Connect live domain and configure Cloudflare DNS / SSL.
- **Cloudflare R2 Storage:** Configure Cloudflare R2 bucket and credentials for storing uploaded photos and videos.
- **Mailgun Email / SMTP:** Setup Mailgun API / SMTP with verified sending domain for system transactional emails (auth, notifications).
