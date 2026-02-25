# GetFanSee - Complete UI Design Requirements

> A comprehensive design requirements document for UI designers. Both Mobile and Desktop versions are required for ALL pages.

**Pixel-Level Implementation Spec**: See [FIGMA_PIXEL_SPEC.md](../design/FIGMA_PIXEL_SPEC.md) for exact spacing, typography, and component dimensions. All implementations must follow that spec.

---

## Product Overview

**GetFanSee** is a creator economy platform where creators can publish paid content, and fans can subscribe or make one-time purchases to unlock content.

**Two User Roles**:

- **Fan**: Browse content, subscribe to creators, purchase paid content, interact (like, comment, share)
- **Creator**: Publish content, set pricing, view analytics, manage earnings

**Three Content Types**:

- **Free Content**: Visible to everyone
- **Subscriber-Only Content**: Only visible to subscribers (price = $0, requires subscription)
- **PPV (Pay Per View) Content**: Requires one-time purchase to unlock (price > $0)

---

## I. Authentication Module

### 1.1 Login Page

**Mobile + Desktop**

Required Elements:

- Product logo and name
- Email input field
- Password input field (with show/hide toggle)
- Login button
- "Forgot password" link
- Switch to registration link
- (Optional) Third-party login buttons (Google OAuth)
- Error message display area

States to Design:

- Default state
- Loading state (during authentication)
- Error state (invalid credentials)

### 1.2 Registration Page

**Mobile + Desktop**

Required Elements:

- Email input field
- Password input field (hint: minimum 8 characters)
- Confirm password input field
- Age verification checkbox (must be 18+, required)
- Terms of service agreement checkbox
- Register button
- Switch to login link
- Password strength indicator (optional)

States to Design:

- Default state
- Form validation errors
- Loading state
- Success (redirect to verification)

### 1.3 Email Verification Page

**Mobile + Desktop**

Required States:

- Verifying (loading animation)
- Verification successful (success message, auto-redirect countdown)
- Verification failed (error message + resend button)
- Link expired state

### 1.4 Resend Verification Email Page

**Mobile + Desktop**

Required Elements:

- Email input field
- Send button
- Success message
- Error message
- Rate limit warning (if applicable)

### 1.5 Forgot Password Page

**Mobile + Desktop**

Required Elements:

- Email input field
- Send reset link button
- Success message (check your email)
- Back to login link

### 1.6 Reset Password Page

**Mobile + Desktop**

Required Elements:

- New password input field
- Confirm new password input field
- Reset button
- Password requirements hint
- Success message
- Back to login link

### 1.7 Authentication Error Page

**Mobile + Desktop**

Required Elements:

- Error icon
- Error message (account suspended, invalid link, etc.)
- Suggested actions
- Back to login button
- Contact support link

---

## II. Content Browsing Module

### 2.1 Home Feed Page

**Mobile + Desktop**

Required Elements:

- Content card feed (list or grid layout)
- Pull-to-refresh (mobile)
- Infinite scroll / load more
- Filter/sort options (optional: latest, popular, following)

**Content Card Must Include**:

- Creator avatar
- Creator display name
- Creator username (@handle)
- Post timestamp (relative time: "2h ago", "3 days ago")
- Post text content (with "read more" for long text)
- Media content area (images/videos)
- Lock overlay (if paid content)
- Lock badge showing content type (Subscriber-only / PPV with price)
- Interaction bar: Like count, Comment count, Share button, Tip button (optional)

**Content Lock States**:

- Subscriber-only content: Blurred preview + "Subscribe to unlock" button
- PPV content: Blurred preview + Price display + "Unlock for $X" button
- Unlocked content: Full content visible

States to Design:

- Loading (skeleton screens)
- Empty state (no content, follow some creators)
- Error state (failed to load)
- Normal state with content

### 2.2 Post Detail Page

**Mobile + Desktop**

Required Elements:

- Back/close button
- Creator info section (avatar, name, follow/subscribe button)
- Full post content
- Media content (support image carousel, video player)
- Lock overlay (if not unlocked)
- Unlock/Subscribe CTA button (if locked)
- Like button with count
- Share button
- Report button (flag icon or menu item)
- Bookmark button (optional)

**Comments Section**:

- Comment count
- Comment input field (with character limit indicator)
- Submit comment button
- Comments list:
  - Commenter avatar
  - Commenter username
  - Comment content
  - Comment timestamp
  - Delete button (for own comments)
  - Like comment (optional)
- Load more comments button
- Empty comments state

States to Design:

- Content locked (subscriber-only)
- Content locked (PPV)
- Content unlocked
- Loading state
- Error state

### 2.3 Creator Profile Page

**Mobile + Desktop**

Required Elements:

- Cover/banner image area
- Creator avatar (larger size)
- Creator display name
- Creator username (@handle)
- Verified badge (if verified creator)
- Bio/description
- Statistics:
  - Total posts count
  - Subscribers count
  - Likes received (optional)
- Subscribe button with price (e.g., "Subscribe $9.99/month")
- Already subscribed state (show "Subscribed" badge, manage subscription link)
- Share profile button
- Report button

**Content Tabs**:

- All Posts
- Media (photos/videos only)
- Liked (optional)

**Content Grid/List**:

- Post thumbnails or cards
- Lock indicators on locked content
- Load more / infinite scroll

States to Design:

- Loading
- Creator not found (404)
- Own profile view (if viewing own creator page)
- Subscribed vs not subscribed

### 2.4 Search Page

**Mobile + Desktop**

Required Elements:

- Search input field (with clear button)
- Search type tabs/filters:
  - Creators
  - Posts
  - Tags/Hashtags
- Search results list
- Recent searches (optional)
- Trending/popular searches (optional)
- Search suggestions (autocomplete, optional)

**Search Results Display**:

- Creator results: Avatar, name, username, subscriber count, subscribe button
- Post results: Content preview card
- Tag results: Tag name, post count

States to Design:

- Initial state (before search)
- Searching (loading)
- Results found
- No results found
- Error state

### 2.5 Tag/Hashtag Page

**Mobile + Desktop**

Required Elements:

- Tag name (large display)
- Tag description (optional)
- Post count
- Posts list/grid with this tag
- Sort options (latest, popular)
- Load more / infinite scroll

States to Design:

- Loading
- Tag not found
- Empty (no posts with this tag)
- Normal with posts

### 2.6 Explore/Discover Page (Optional)

**Mobile + Desktop**

Required Elements:

- Featured creators section
- Trending posts section
- Popular tags section
- Categories (if applicable)
- Personalized recommendations

---

## III. User Center Module

### 3.1 Profile Settings Page

**Mobile + Desktop**

Required Elements:

- Avatar (editable, upload new)
- Display name (editable)
- Username (display only or editable)
- Email (display only)
- Bio/About me (editable)
- Role badge (Fan / Creator)
- Creator status badge (if creator: Pending / Approved / Rejected)

**Action Buttons/Links**:

- Save changes button
- Change password link/section
- "Become a Creator" button (only for Fan users)
- Notification settings link (optional)
- Privacy settings link (optional)
- Delete account link (optional)
- Sign out button

**Change Password Section**:

- Current password input
- New password input
- Confirm new password input
- Update password button

States to Design:

- View mode
- Edit mode
- Saving changes
- Save success
- Save error

### 3.2 Wallet Page

**Mobile + Desktop**

Required Elements:

- Current balance (prominent display)
- Add funds / Top up button
- Quick amount options (e.g., $10, $25, $50, $100, $200, $500)
- Custom amount input (optional)

**Transaction History**:

- Transaction list with:
  - Transaction type icon/label (Deposit, Subscription, PPV Purchase, Tip, etc.)
  - Amount (positive for deposits, negative for purchases - visually differentiated)
  - Timestamp
  - Description (e.g., "Subscribed to @creator", "Unlocked post by @creator")
  - Status (completed, pending, failed)
- Filter by type (optional)
- Date range filter (optional)
- Load more / pagination

States to Design:

- Loading
- Empty (no transactions)
- Normal with transactions
- Top-up in progress
- Top-up success
- Top-up failed

### 3.3 My Subscriptions Page

**Mobile + Desktop**

Required Elements:

- Active subscriptions count
- Total monthly spend (optional)

**Subscription List**:

- Creator avatar
- Creator display name
- Creator username
- Subscription price
- Subscription status (Active / Expired / Cancelled)
- Next billing date / Expiry date
- Cancel subscription button
- Renew button (if expired)
- View creator profile link

**Tabs/Filters**:

- Active subscriptions
- Expired subscriptions
- All

States to Design:

- Loading
- Empty (no subscriptions - with CTA to discover creators)
- Normal with subscriptions
- Cancel confirmation dialog

### 3.4 Purchase History Page

**Mobile + Desktop**

Required Elements:

- Total spent on PPV (optional summary)
- Purchase count

**Purchase List**:

- Content thumbnail (blurred if no longer accessible?)
- Creator name
- Purchase price
- Purchase date/time
- Link to view content
- Content type indicator

States to Design:

- Loading
- Empty (no purchases)
- Normal with purchases

### 3.5 Notifications Page

**Mobile + Desktop**

Required Elements:

- Notification list
- Mark all as read button
- Filter tabs (All / Unread)

**Notification Types to Design**:

- New post from subscribed creator
- Someone liked your post (for creators)
- Someone commented on your post (for creators)
- New subscriber (for creators)
- Someone purchased your content (for creators)
- Subscription expiring soon
- Payment successful
- Payment failed
- Creator you follow posted
- System announcements

**Each Notification Shows**:

- Icon or avatar
- Notification message
- Timestamp
- Read/unread indicator
- Tap to navigate to relevant content

States to Design:

- Loading
- Empty (no notifications)
- Normal with notifications
- All read state

### 3.6 Bookmarks/Saved Page (Optional)

**Mobile + Desktop**

Required Elements:

- Saved posts list
- Remove from saved button
- Empty state

---

## IV. Creator Tools Module

### 4.1 Creator Upgrade/Onboarding Flow

**Mobile + Desktop**

**Landing Page (Why Become a Creator)**:

- Benefits list
- Earnings potential
- How it works
- Start application button

**Step 1: Profile Setup**

- Display name input
- Avatar upload
- Cover image upload (optional)
- Bio/description input
- Social links (optional)
- Subscription price setting
- Next step button
- Progress indicator

**Step 2: Identity Verification (KYC)**

- Legal/real name input
- Date of birth picker
- Country/region selector
- Government ID upload (front)
- Government ID upload (back, if required)
- Selfie upload (optional)
- Terms acceptance checkbox
- Submit for review button
- Progress indicator

**Verification Status Page**:

- Pending review state (with estimated time)
- Approved state (congratulations, go to studio)
- Rejected state (reason displayed, resubmit option)

### 4.2 Creator Studio Dashboard

**Mobile + Desktop**

Required Elements:

- Welcome message with creator name
- Quick stats cards:
  - Total earnings (all time or period)
  - Current subscribers count
  - PPV sales count
  - Total views/impressions
- Change indicators (% change vs previous period, up/down arrows)
- Time range selector (7 days / 30 days / 90 days / All time)
- Earnings trend chart (line or bar chart)
- Subscribers trend chart
- Recent posts list (last 5-10 posts with basic stats)

**Quick Action Buttons**:

- Create new post
- View all posts
- View analytics
- View earnings
- View subscribers

States to Design:

- Loading
- New creator (no data yet)
- Normal with data

### 4.3 Create New Post Page

**Mobile + Desktop**

Required Elements:

- Back/cancel button
- Page title ("Create Post" or "New Post")

**Post Content**:

- Title input (optional)
- Content/body textarea (with character count if limited)
- Rich text formatting (optional: bold, italic, links)

**Media Upload**:

- Upload area (drag & drop on desktop, tap to select on mobile)
- Support multiple files
- Supported formats hint (images: jpg, png, gif; videos: mp4, etc.)
- File size limit hint
- Upload progress indicator (per file)
- Uploaded files preview grid
- Remove uploaded file button
- Reorder files (drag to reorder, optional)

**Visibility Settings**:

- Radio buttons or segmented control:
  - Free (Everyone can see)
  - Subscribers Only
  - Pay Per View (PPV)
- Price input field (appears when PPV selected)
- Price suggestions (optional)

**Tags/Categories**:

- Tag input or tag selector
- Suggested tags
- Maximum tags limit indicator

**Schedule Post (Optional)**:

- Schedule toggle
- Date/time picker

**Action Buttons**:

- Save as draft button
- Preview button (optional)
- Publish button

States to Design:

- Empty form
- Form with content
- Uploading media
- Upload complete
- Form validation errors
- Publishing
- Publish success

### 4.4 Edit Post Page

**Mobile + Desktop**

Same as Create Post, but:

- Pre-filled with existing content
- "Update" button instead of "Publish"
- Delete post option
- Warning about editing published content (optional)

### 4.5 Post Management Page (My Posts)

**Mobile + Desktop**

Required Elements:

- Posts list or grid
- Total posts count
- Filter options:
  - All posts
  - Free posts
  - Subscriber-only posts
  - PPV posts
  - Drafts (if applicable)
- Sort options (newest, oldest, most popular, highest earning)
- Search posts (optional)

**Each Post Item Shows**:

- Thumbnail (first media or placeholder)
- Title or content preview
- Post date
- Visibility type badge (Free / Subscribers / PPV $X)
- Stats: Views, Likes, Comments
- Earnings (for paid content)
- Status (Published / Draft / Scheduled)

**Actions per Post**:

- Edit button
- Delete button
- View post link
- Duplicate (optional)

States to Design:

- Loading
- Empty (no posts yet - with CTA to create first post)
- Normal with posts
- Delete confirmation dialog

### 4.6 Analytics Page

**Mobile + Desktop**

Required Elements:

- Time range selector
- Key metrics cards:
  - Total views
  - Unique viewers
  - Engagement rate
  - New subscribers (period)
  - Subscriber churn (period)
  - Total earnings (period)

**Charts/Graphs**:

- Views over time
- Earnings over time
- Subscribers growth
- Engagement breakdown (likes, comments, shares)
- Revenue breakdown (subscriptions vs PPV)

**Top Performing Content**:

- Top posts by views
- Top posts by earnings
- Top posts by engagement

**Audience Insights (Optional)**:

- Geographic distribution
- Device breakdown
- Peak activity times

States to Design:

- Loading
- No data yet
- Normal with data

### 4.7 Earnings Page

**Mobile + Desktop**

Required Elements:

- Earnings summary:
  - Total earnings (all time)
  - Available balance (can withdraw)
  - Pending balance (processing)
  - Platform fee explanation (e.g., "20% platform fee")

**Earnings Breakdown**:

- Subscription revenue
- PPV revenue
- Tips revenue (if applicable)
- Pie chart or bar chart visualization

**Payout/Withdrawal Section**:

- Withdraw button
- Minimum withdrawal amount
- Payout method settings link
- Payout history

**Transaction History**:

- Earnings list:
  - Type (Subscription / PPV / Tip)
  - From user (avatar, username)
  - Amount (gross)
  - Platform fee
  - Net amount
  - Date/time
  - Status (Completed / Pending / Processing)
- Filter by type
- Date range filter
- Export option (optional)

States to Design:

- Loading
- No earnings yet
- Normal with earnings
- Withdrawal in progress
- Withdrawal success

### 4.8 Subscribers Management Page

**Mobile + Desktop**

Required Elements:

- Total subscribers count
- New subscribers (this period)
- Churned subscribers (this period)
- Search subscribers

**Subscribers List**:

- Subscriber avatar
- Subscriber username
- Subscription date
- Subscription status (Active / Expired)
- Total spent (optional)
- Actions: View profile, Block (optional)

**Filters**:

- Active subscribers
- Expired subscribers
- All

States to Design:

- Loading
- No subscribers yet
- Normal with subscribers

### 4.9 Post Published Success Page

**Mobile + Desktop**

Required Elements:

- Success icon/animation
- Success message ("Your post is now live!")
- Post preview or link
- Share post buttons (copy link, social share)
- Action buttons:
  - View post
  - Create another post
  - Back to studio/dashboard

---

## V. Payment Modals/Dialogs

### 5.1 Subscribe Modal

**Mobile + Desktop**

Required Elements:

- Close button (X)
- Creator avatar
- Creator display name
- Subscription price (e.g., "$9.99/month")
- Subscription benefits list:
  - Access to all subscriber content
  - Direct messaging (if applicable)
  - Early access to new posts
  - Exclusive content
  - Cancel anytime
- Current wallet balance display
- Subscribe button
- If balance insufficient:
  - Warning message
  - Add funds button
- Terms reminder (small text)

States to Design:

- Default (sufficient balance)
- Insufficient balance
- Processing subscription
- Success
- Error

### 5.2 PPV Unlock Modal

**Mobile + Desktop**

Required Elements:

- Close button (X)
- Content preview (blurred thumbnail)
- Content description (optional)
- Creator name
- Price display (e.g., "$4.99")
- "One-time purchase" clarification
- Current wallet balance display
- Unlock button
- If balance insufficient:
  - Warning message
  - Add funds button

States to Design:

- Default (sufficient balance)
- Insufficient balance
- Processing purchase
- Success (content unlocked)
- Error

### 5.3 Add Funds / Top Up Modal

**Mobile + Desktop**

Required Elements:

- Close button (X)
- Current balance display
- Quick amount buttons ($10, $25, $50, $100, $200, $500)
- Custom amount input field
- Selected amount display
- Payment method selector (if multiple methods)
- Add funds / Confirm button
- Secure payment badge/text

States to Design:

- Default
- Amount selected
- Processing payment
- Success
- Error

### 5.4 Cancel Subscription Confirmation Modal

**Mobile + Desktop**

Required Elements:

- Warning icon
- Title ("Cancel Subscription?")
- Explanation (what they'll lose access to)
- When access ends
- Keep subscription button (primary)
- Confirm cancel button (secondary/destructive)

### 5.5 Confirm Purchase Modal (Generic)

**Mobile + Desktop**

Required Elements:

- Title
- Description of what's being purchased
- Price
- Confirm button
- Cancel button

---

## VI. Admin Module

### 6.1 Content Review Page

**Desktop Primary (Mobile Optional)**

Required Elements:

- Pending review queue count
- Content list/table:
  - Content thumbnail
  - Content preview/excerpt
  - Creator info
  - Submission date
  - Content type
  - Report count (if reported)
- Content detail view:
  - Full content display
  - All media
  - Creator profile link
- Action buttons:
  - Approve
  - Reject (with reason input)
  - Request changes
- Rejection reason templates (optional)
- Bulk actions (optional)

Filters:

- All pending
- Reported content
- By content type
- By date

### 6.2 Creator Verification Review Page

**Desktop Primary (Mobile Optional)**

Required Elements:

- Pending applications count
- Applications list:
  - Applicant avatar
  - Applicant name
  - Application date
  - Status
- Application detail view:
  - Profile information submitted
  - KYC documents (ID images)
  - Selfie (if required)
  - Document verification status
- Action buttons:
  - Approve
  - Reject (with reason)
  - Request additional documents
- Rejection reasons dropdown/templates

### 6.3 Reports Management Page

**Desktop Primary (Mobile Optional)**

Required Elements:

- Open reports count
- Reports list:
  - Report ID
  - Report type (content/user/comment)
  - Reported item preview
  - Reporter info
  - Report reason
  - Report date
  - Status (Open / In Review / Resolved)

**Report Detail View**:

- Full reported content
- Reporter's description
- Reported user's history (previous violations)
- Similar reports (if any)

**Actions**:

- Remove content
- Warn user
- Suspend user
- Ban user
- Dismiss report
- Add notes

### 6.4 User Management Page (Optional)

**Desktop Primary**

Required Elements:

- User search
- User list with filters
- User detail view:
  - Profile info
  - Account status
  - Activity history
  - Violations history
- Actions: Warn, Suspend, Ban, Unban

### 6.5 Admin Dashboard (Optional)

**Desktop Primary**

Required Elements:

- Platform statistics
- Active users
- New registrations
- Revenue metrics
- Pending tasks (reviews, reports)

---

## VII. Common Components

### 7.1 Navigation Components

**Top Navigation Bar (Desktop + Mobile)**

- Logo (clickable, returns to home)
- Search input or search icon
- Notification bell icon with unread count badge
- User avatar (clickable, opens menu)
- "Become a Creator" button (only for Fan users, prominent CTA)

**Bottom Navigation Bar (Mobile Only)**

- Home icon + label
- Search icon + label
- Create/Plus icon + label (Creator only)
- Notifications icon + label (with badge)
- Profile icon + label
- Active state indicator

**Side Menu / Drawer (Mobile) or Dropdown Menu (Desktop)**

- User info section:
  - Avatar
  - Display name
  - Username
  - Role badge
- Wallet balance preview with "Add Funds" link
- Navigation links:
  - Home/Feed
  - My Subscriptions
  - My Purchases
  - Wallet
  - Settings/Profile
- Creator section (Creator only):
  - Creator Studio
  - My Posts
  - Analytics
  - Earnings
- "Become a Creator" link (Fan only)
- Sign out button
- App version (optional)
- Legal links (Privacy, Terms)

### 7.2 Content Components

**Content Card**

- Creator header (avatar, name, time)
- Text content
- Media area
- Lock overlay (when applicable)
- Interaction bar

**Creator Card (for lists/search)**

- Avatar
- Display name
- Username
- Subscriber count
- Subscribe button / Subscribed badge

**Comment Component**

- Avatar
- Username
- Comment text
- Timestamp
- Actions (delete, like)

**Media Viewer**

- Image carousel with indicators
- Video player with controls
- Fullscreen option
- Close button

### 7.3 State Components

**Loading States**

- Full page loading (spinner or skeleton)
- Skeleton screens for content
- Button loading state (spinner inside button)
- Inline loading indicator

**Empty States**

- Icon or illustration
- Title text
- Description text
- Action button (optional)

Examples needed:

- No posts in feed
- No search results
- No subscriptions
- No purchases
- No notifications
- No earnings
- No subscribers

**Error States**

- Error icon
- Error title
- Error description
- Retry button
- Go back / Go home button

Examples needed:

- Network error
- Server error
- Not found (404)
- Access denied (403)
- Session expired

**Success States**

- Success icon (checkmark)
- Success message
- Next action button(s)

### 7.4 Modal/Dialog Components

**Confirmation Dialog**

- Title
- Description/message
- Cancel button
- Confirm button (can be destructive style)

**Bottom Sheet (Mobile)**

- Drag handle
- Title
- Content area
- Action buttons
- Swipe to dismiss

**Alert/Toast Notifications**

- Success toast (green)
- Error toast (red)
- Warning toast (yellow/orange)
- Info toast (blue)
- With or without action button
- Auto-dismiss timer

### 7.5 Form Components

**Input Fields**

- Text input
- Email input
- Password input (with show/hide toggle)
- Textarea (multiline)
- Number input
- Search input (with clear button)

**Input States**

- Default
- Focused
- Filled
- Error (with error message)
- Disabled
- Read-only

**Selection Components**

- Dropdown/Select
- Radio buttons
- Checkboxes
- Toggle/Switch
- Segmented control
- Tag selector / Multi-select

**Date/Time Components**

- Date picker
- Time picker
- Date range picker

**File Upload**

- Upload area (drag & drop)
- File preview
- Upload progress
- Remove file button

**Buttons**

- Primary button
- Secondary button
- Outline button
- Ghost button
- Destructive button
- Icon button
- Button with icon
- Button group

**Button States**

- Default
- Hover
- Pressed/Active
- Disabled
- Loading

### 7.6 Data Display Components

**Stats Card**

- Icon (optional)
- Label
- Value (large)
- Change indicator (up/down arrow, percentage)
- Trend color (green for up, red for down)

**Table (Desktop)**

- Header row
- Data rows
- Sortable columns
- Pagination
- Row actions

**List Item**

- Avatar/icon
- Primary text
- Secondary text
- Trailing element (badge, button, arrow)
- Swipe actions (mobile)

**Badge/Tag**

- Text label
- Color variants (default, success, warning, error, info)

**Progress Indicators**

- Progress bar
- Circular progress
- Step indicator

**Charts (for analytics)**

- Line chart
- Bar chart
- Pie/Donut chart
- Area chart

---

## VIII. Special Pages

### 8.1 Report Content/User Page

**Mobile + Desktop**

Required Elements:

- What are you reporting (auto-filled or selectable)
- Report type selection:
  - Inappropriate content
  - Harassment or bullying
  - Spam
  - Copyright violation
  - Underage content
  - Violence
  - Other
- Additional details textarea
- Submit report button
- Cancel button

States:

- Form
- Submitting
- Success (thank you message)
- Error

### 8.2 Legal Pages

**Mobile + Desktop**

**Privacy Policy Page**

- Page title
- Last updated date
- Policy content (formatted text)
- Table of contents (optional)

**Terms of Service Page**

- Page title
- Last updated date
- Terms content
- Table of contents (optional)

**DMCA / Copyright Page**

- DMCA notice information
- How to file a claim
- Contact information

### 8.3 Help / Support Page

**Mobile + Desktop**

Required Elements:

- Search help articles
- FAQ sections (collapsible)
- Contact support button/form
- Email support
- Response time expectation

### 8.4 Age Verification Gate

**Mobile + Desktop**

Required Elements:

- Warning icon or illustration
- Age restriction message (18+ content)
- "I am 18 or older" button
- "Exit" or "Leave" button
- Remember choice option (optional)

### 8.5 Account Suspended/Banned Page

**Mobile + Desktop**

Required Elements:

- Warning icon
- Suspension message
- Reason (if provided)
- Duration (if temporary)
- Appeal option (if applicable)
- Contact support link
- Sign out button

### 8.6 Maintenance Page

**Mobile + Desktop**

Required Elements:

- Maintenance icon/illustration
- Message ("We'll be back soon")
- Estimated return time (if known)
- Status page link (optional)

### 8.7 404 Not Found Page

**Mobile + Desktop**

Required Elements:

- 404 illustration or icon
- "Page not found" message
- Go to home button
- Search (optional)

---

## IX. Key User Flows

Please ensure these complete flows are designed with smooth transitions:

### Flow 1: New User Registration to Browsing

```
Landing/Home → Click Sign Up → Registration Form → Submit →
Email Verification Sent → Check Email → Click Verification Link →
Verification Success → Redirect to Home Feed → Browse Content
```

### Flow 2: Fan Subscribes to Creator

```
Browse Feed → See Locked Content → Click on Post →
Post Detail (Locked) → Click "Subscribe" → Subscribe Modal →
[If Balance OK] Confirm → Processing → Success → Content Unlocked
[If Balance Low] → Click "Add Funds" → Top Up Modal → Add Funds →
Return to Subscribe → Confirm → Success → Content Unlocked
```

### Flow 3: Fan Purchases PPV Content

```
Browse Feed → See PPV Content → Click "Unlock for $X" →
Unlock Modal → [If Balance OK] Confirm → Processing →
Success → Content Unlocked → View Content
```

### Flow 4: Fan Upgrades to Creator

```
Profile Page → Click "Become a Creator" → Info Page →
Start Application → Step 1: Profile Setup → Next →
Step 2: KYC Verification → Submit → Pending Review Page →
[Wait for approval] → Approved → Welcome to Creator Studio
```

### Flow 5: Creator Publishes Content

```
Creator Studio → Click "New Post" → Create Post Page →
Enter Content → Upload Media → Set Visibility (Free/Sub/PPV) →
[If PPV] Set Price → Add Tags → Click Publish →
Publishing... → Success Page → View Post or Create Another
```

### Flow 6: Creator Views and Withdraws Earnings

```
Creator Studio → Click Earnings → Earnings Page →
View Summary → View Transaction History →
Click Withdraw → Enter Amount → Confirm →
Processing → Withdrawal Success
```

### Flow 7: User Reports Content

```
View Post → Click More/Menu → Click "Report" →
Report Page → Select Reason → Add Details → Submit →
Thank You Message → Return to Feed
```

### Flow 8: User Manages Subscriptions

```
Profile Menu → My Subscriptions → Subscriptions List →
Click on Subscription → View Details →
Click "Cancel" → Confirmation Modal → Confirm Cancel →
Subscription Cancelled (access until period end)
```

---

## X. Design Deliverables

### Required Deliverables

1. **Mobile Designs** (375px or 390px width base)
   - All pages listed above
   - Bottom navigation bar
   - Drawer/slide-out menu
   - Touch-friendly interactions
   - Safe area considerations (notch, home indicator)

2. **Desktop Designs** (1440px or 1920px width base)
   - All pages listed above
   - Top navigation bar
   - Appropriate multi-column layouts where suitable
   - Hover states for interactive elements

3. **Component Library**
   - All buttons (variants and states)
   - All input fields (variants and states)
   - Cards (content card, creator card, stat card)
   - Modals and dialogs
   - Navigation components
   - State components (loading, empty, error, success)
   - Badges and tags
   - Media components

4. **Interaction Specifications**
   - Key animations and transitions
   - Micro-interactions
   - Page transition patterns
   - Loading patterns

### Design Considerations

- **Light and Dark Mode**: Both themes required
- **Touch Targets**: Ensure adequate size for mobile (minimum 44x44pt recommended)
- **State Coverage**: Design all states (loading, empty, error, success, disabled)
- **Accessibility**: Consider color contrast, text readability
- **Lock States**: Make paid content lock states clear but not intrusive
- **Responsive Behavior**: How layouts adapt between breakpoints

---

## XI. Content Examples for Mockups

### Sample Creator Profiles

- Creator 1: Photographer, 1.2K subscribers, $9.99/month
- Creator 2: Fitness coach, 5.6K subscribers, $14.99/month
- Creator 3: Artist, 800 subscribers, $4.99/month

### Sample Posts

- Free post with text and images
- Subscriber-only post (locked state)
- PPV post at $2.99 (locked state)
- Post with video content
- Post with multiple images (carousel)

### Sample Notifications

- "Sarah posted new content"
- "John liked your post"
- "You have a new subscriber!"
- "Your subscription to @creator expires in 3 days"

### Sample Transactions

- Deposit: +$50.00
- Subscription: -$9.99 to @photographer
- PPV Unlock: -$4.99 for post by @artist
- Earnings: +$7.99 from @fan (subscription)

---

_Document Version: 1.0_
_Last Updated: February 6, 2026_
_Platform: GetFanSee v1.x_
