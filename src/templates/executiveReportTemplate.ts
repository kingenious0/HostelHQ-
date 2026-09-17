/**
 * USTED Executive Briefing Report Template
 * Renders the official executive briefing HTML document with USTED letterhead
 * and live portfolio/compliance metrics.
 */

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
  const currentDateStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VC Executive Council Briefing Report - HostelHQ</title>
  <style>
    :root {
      --usted-maroon: #6B1D2F;
      --dark-neutral: #1f2937;
      --light-bg: #f9fafb;
      --border-color: #e5e7eb;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: var(--dark-neutral);
      padding: 30px;
      margin: 0;
      background-color: #f3f4f6;
    }
    .document-container {
      max-width: 900px;
      margin: 0 auto;
      border: 1px solid var(--border-color);
      padding: 40px;
      background: #ffffff;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .letterhead {
      display: flex;
      align-items: center;
      border-bottom: 3px solid var(--usted-maroon);
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .letterhead h2 {
      margin: 0;
      font-size: 16px;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .letterhead p {
      margin: 3px 0 0;
      font-size: 11px;
      color: #4b5563;
      font-weight: 600;
    }
    .title-block {
      text-align: center;
      background: #fdf8f6;
      border: 1px solid #f3d6dc;
      padding: 14px;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    .title-block h1 {
      margin: 0;
      color: var(--usted-maroon);
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .title-block p {
      margin: 4px 0 0;
      font-size: 11px;
      color: #6b7280;
    }
    h3 {
      font-size: 13px;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 24px;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid var(--border-color);
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      color: #374151;
      font-weight: 700;
    }
    .badge-good {
      color: #047857;
      font-weight: 700;
      background-color: #ecfdf5;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      display: inline-block;
    }
    .badge-sanction {
      color: #b91c1c;
      font-weight: 700;
      background-color: #fef2f2;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      display: inline-block;
    }
    .sign-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 40px;
      text-align: center;
      font-size: 11px;
    }
    .sign-box {
      border-top: 1px solid #9ca3af;
      padding-top: 8px;
      color: #374151;
    }
    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .document-container {
        border: none;
        box-shadow: none;
        padding: 20px;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="document-container">
    <div class="letterhead">
      <div class="letterhead-text">
        <h2>University of Skills Training and Entrepreneurial Development (USTED)</h2>
        <p>Directorate of Student Welfare & Private Accommodation Governance — Kumasi</p>
      </div>
    </div>

    <div class="title-block">
      <h1>Executive Council Briefing Report</h1>
      <p>Statutory Governance Document • Generated Live: ${currentDateStr}</p>
    </div>

    <h3>1. Private Student Housing Portfolio Assessment (Live Database)</h3>
    <table>
      <tr><th>Portfolio Metric</th><th>Live Database Value</th></tr>
      <tr><td>Total Registered Hostels</td><td>${metrics.totalHostels} Properties (${metrics.accreditedCount} Accredited, ${metrics.pendingCount} Pending)</td></tr>
      <tr><td>Live Student Bed Occupancy</td><td>${metrics.activeOccupiedBeds} / ${metrics.totalVerifiedBeds} Active Student Beds Occupied</td></tr>
      <tr><td>Overall Portfolio Compliance</td><td><strong>${metrics.complianceRate}% Active Standing</strong></td></tr>
      <tr><td>Active Statutory Sanctions</td><td>${metrics.sanctionedPropertiesCount} Properties under corrective review</td></tr>
    </table>

    <h3>2. Live Compliance Matrix</h3>
    <table>
      <tr><th>Hostel Name</th><th>Location</th><th>Status</th><th>Total Beds</th></tr>
      ${complianceList.map(h => `
        <tr>
          <td><strong>${h.name}</strong></td>
          <td>${h.location}</td>
          <td><span class="${(h.status || '').toLowerCase().includes('sanction') || (h.status || '').toLowerCase().includes('suspend') || (h.status || '').toLowerCase().includes('revok') ? 'badge-sanction' : 'badge-good'}">${h.status}</span></td>
          <td>${h.totalBeds}</td>
        </tr>
      `).join('')}
    </table>

    <div class="sign-grid">
      <div class="sign-box"><strong>Executive Director</strong><br>Student Housing Directorate</div>
      <div class="sign-box"><strong>Pro-Vice-Chancellor</strong><br>Academic & Student Affairs</div>
      <div class="sign-box"><strong>Vice-Chancellor / Rector</strong><br>Office of the VC</div>
    </div>
  </div>
</body>
</html>`;
}
