/**
 * USTED Executive Briefing Report Template
 * Renders the official executive briefing HTML document with USTED letterhead
 * and live portfolio/compliance metrics.
 */

export function buildExecutiveReportHTML(metrics: any, complianceList: any[]) {
  const normMetrics = {
    totalHostels: metrics?.totalHostels ?? 0,
    accredited: metrics?.accreditedCount ?? metrics?.accredited ?? metrics?.accreditedHostels ?? 0,
    pending: metrics?.pendingCount ?? metrics?.pending ?? metrics?.pendingAudits ?? 0,
    occupiedBeds: metrics?.activeOccupiedBeds ?? metrics?.occupiedBeds ?? 0,
    totalBeds: metrics?.totalVerifiedBeds ?? metrics?.totalBeds ?? 0,
    complianceRate: metrics?.complianceRate ?? 0,
    sanctioned: metrics?.sanctionedPropertiesCount ?? metrics?.sanctioned ?? metrics?.activeSanctions ?? 0,
  };

  const normList = Array.isArray(complianceList) ? complianceList : [];

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 20px; font-size: 11pt; line-height: 1.4; }
      .container { max-width: 800px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 30px; background: #ffffff; }
      
      /* Official Letterhead */
      .letterhead { display: flex; align-items: center; border-bottom: 3px solid #6B1D2F; padding-bottom: 15px; margin-bottom: 20px; }
      .letterhead-text h2 { margin: 0; font-size: 15px; color: #111827; text-transform: uppercase; font-weight: 700; }
      .letterhead-text p { margin: 3px 0 0; font-size: 11px; color: #4b5563; font-weight: 600; }

      /* Title Banner */
      .title-banner { background: #fdf8f6; border: 1px solid #f3d6dc; padding: 12px; text-align: center; border-radius: 4px; margin-bottom: 20px; }
      .title-banner h1 { margin: 0; color: #6B1D2F; font-size: 16px; text-transform: uppercase; }
      .title-banner p { margin: 3px 0 0; font-size: 10px; color: #6b7280; }

      /* Sections & Tables */
      h3 { font-size: 13px; color: #6B1D2F; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-top: 20px; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10pt; }
      th, td { border: 1px solid #d1d5db; padding: 7px 10px; text-align: left; }
      th { background-color: #f3f4f6; color: #374151; font-weight: 600; }
      
      .badge-good { color: #047857; font-weight: bold; }
      .badge-sanction { color: #b91c1c; font-weight: bold; }

      /* Sign-off */
      .sign-grid { display: table; width: 100%; margin-top: 30px; text-align: center; font-size: 10px; }
      .sign-box { display: table-cell; width: 33.33%; border-top: 1px solid #9ca3af; padding-top: 8px; margin: 0 10px; }
      .footer { margin-top: 25px; text-align: center; font-size: 9px; color: #6b7280; border-top: 1px dashed #e5e7eb; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Letterhead -->
      <div class="letterhead">
        <div class="letterhead-text">
          <h2>University of Skills Training and Entrepreneurial Development (USTED)</h2>
          <p>Directorate of Student Welfare & Private Accommodation Governance — Kumasi</p>
        </div>
      </div>

      <!-- Title -->
      <div class="title-banner">
        <h1>Executive Council Briefing Report</h1>
        <p>Statutory Governance Document • Ref: VC-BRIEF-2026-HQ • Generated Live</p>
      </div>

      <!-- Section 1 -->
      <h3>1. Private Student Housing Portfolio Assessment</h3>
      <table>
        <tr><th>Portfolio Metric</th><th>Live Database Value</th></tr>
        <tr><td>Total Registered Hostels</td><td>${normMetrics.totalHostels} Properties (${normMetrics.accredited} Accredited, ${normMetrics.pending} Pending)</td></tr>
        <tr><td>Active Student Bed Occupancy</td><td>${normMetrics.occupiedBeds} / ${normMetrics.totalBeds} Active Student Beds Occupied</td></tr>
        <tr><td>Overall Portfolio Compliance</td><td><strong>${normMetrics.complianceRate}% Active Standing</strong></td></tr>
        <tr><td>Active Statutory Sanctions</td><td>${normMetrics.sanctioned} Properties under corrective review</td></tr>
      </table>

      <!-- Section 2 -->
      <h3>2. Key Portfolio Compliance Matrix</h3>
      <table>
        <tr><th>Hostel Name</th><th>Location</th><th>Status</th><th>Beds</th></tr>
        ${normList.map((h: any) => `
          <tr>
            <td>${h.name}</td>
            <td>${h.location}</td>
            <td><span class="${(h.status || '').toLowerCase().includes('sanction') || (h.status || '').toLowerCase().includes('suspend') || (h.status || '').toLowerCase().includes('revok') ? 'badge-sanction' : 'badge-good'}">${h.status || 'Good Standing'}</span></td>
            <td>${h.totalBeds ?? h.beds ?? 0}</td>
          </tr>
        `).join('')}
      </table>

      <!-- Sign-off -->
      <div class="sign-grid">
        <div class="sign-box"><strong>Executive Director</strong><br>Student Housing Directorate</div>
        <div class="sign-box"><strong>Pro-Vice-Chancellor</strong><br>Academic & Student Affairs</div>
        <div class="sign-box"><strong>Vice-Chancellor / Rector</strong><br>Office of the VC</div>
      </div>

      <div class="footer">
        CLASSIFICATION: OFFICIAL EXECUTIVE DOCUMENT (CONFIDENTIAL) • Registered under Act 389
      </div>
    </div>
  </body>
  </html>`;
}

export function generateExecutiveReportHTML(
  metrics: {
    totalHostels: number;
    accreditedCount: number;
    pendingCount: number;
    totalVerifiedBeds: number;
    activeOccupiedBeds: number;
    complianceRate: number;
    sanctionedPropertiesCount: number;
  },
  complianceList: Array<{
    name: string;
    location: string;
    status: string;
    totalBeds: number;
    activeStudentsHoused?: number;
    occupancyRate?: number;
  }>
): string {
  return buildExecutiveReportHTML(metrics, complianceList);
}
