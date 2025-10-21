# **App Name**: HostelHQ

## Core Features:

- Hostel Browsing and Search: Allow students to browse hostels based on location, price, and amenities. Implement search functionality for quick filtering. Incorporate a Mapbox clustered map to display hostels geographically.
- Visit Booking: Enable students to book hostel visits by paying a GH₵10 visit fee through Paystack test checkout. Trigger a Frog.wigal SMS alert to the agent upon successful booking that someone has booked for a visit to........
- Agent Upload: Provide agents with an upload wizard to submit hostel details, including 5 photos and GPS location. Pending approval by admin.
- Admin Approval: The application must implement an admin dashboard allowing admins to approve or reject newly uploaded rooms and hostels.
- Room Description Enrichment: Leverage AI to enhance the description of the hostel rooms. Use the uploaded photos, the specified GPS location, nearby landmarks, amenities, and room features (e.g. number of beds, bathroom details), to rewrite a compelling description that the agent will be able to accept, reject, or manually edit.
- Admin Dashboard: The admin interface shows a dashboard displaying revenue, occupancy rates, and top-performing agents. Implement one-click approval/rejection of rooms. Refund option of Paystack test payments.
- PDF Receipt Generation: Automatically generate a PDF receipt after a successful visit payment, providing a download URL to the student. Uses jsPDF tool in a Firebase Function

## Style Guidelines:

- Primary color: Deep Teal (#008080). It is a calming, sophisticated color reminiscent of travel and stability, and offers a fresh take that avoids the overused blues often associated with marketplace apps.
- Background color: Light Gray (#F0F8FF). A near-white provides a neutral backdrop that keeps the focus on the hostel listings and does not detract from the visual impact of the deep teal.
- Accent color: Coral (#FF7F50). It offers a vibrant contrast to the deep teal, drawing attention to key interactive elements like booking buttons and call-to-actions, suggesting warmth and value.
- Font: 'PT Sans', a humanist sans-serif font that looks modern but with warmth and personality. This choice fits well in an educational or community context.
- Use clean and modern line icons to represent amenities and features, ensuring they are easily recognizable and intuitive. Icons should complement the overall minimalist design and add a touch of sophistication.
- Implement a grid-based layout for hostel listings to maintain a clean and organized presentation. Prioritize clear visual hierarchy and ensure easy navigation, focusing on usability for a young student audience.
- Incorporate subtle animations and transitions to enhance the user experience. For example, use smooth scrolling effects and gentle fades when loading new content. The intention is to make the app feel more dynamic and engaging, without distracting users from the core functionality.