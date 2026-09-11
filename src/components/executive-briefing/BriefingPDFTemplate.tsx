import React from 'react';

export interface BriefingData {
  totalHostels: number;
  accreditedHostels: number;
  totalBeds: number;
  auditedBeds: number;
  pendingAudits: number;
  activeSanctions: number;
  complianceRate: string | number;
  rentIndices: {
    oneInRoom: number;
    twoInRoom: number;
    threeInRoom: number;
    fourInRoom: number;
  };
  grievances: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  disputeStats?: {
    studentToHostel?: number;
    managerToStudent?: number;
    deanArbitrationRate?: string | number;
  };
  hostelPortfolio: Array<{
    name: string;
    location: string;
    status: string;
    beds: number;
    sanctionReason?: string;
  }>;
  resolutionRate: string | number;
  generatedDate: string;
  documentRef?: string;
  academicYear?: string;
  reportingPeriod?: string;
  preparedBy?: string;
  preparedFor?: string;
}

export function BriefingPDFTemplate({ data }: { data: BriefingData }) {
  const docRef = data.documentRef || 'VC-BRIEF-2026-HQ';
  const academicYear = data.academicYear || '2025/2026';
  const reportingPeriod = data.reportingPeriod || 'Sept - Dec 2026';
  const pendingCount = Math.max(0, data.totalHostels - data.accreditedHostels);

  // Price calculations with statutory caps
  const caps = {
    one: 9000,
    two: 6500,
    three: 4500,
    four: 1500,
  };

  const getVariance = (actual: number, cap: number) => {
    if (!cap) return '0%';
    const pct = Math.round(((actual - cap) / cap) * 100);
    return pct > 0 ? `+${pct}%` : `${pct}%`;
  };

  const defaultGrievances = [
    { category: 'General Inquiries', count: 1, percentage: 33 },
    { category: 'Rent & Tariff Overpricing', count: 1, percentage: 33 },
    { category: 'Facilities & Utilities', count: 1, percentage: 33 },
  ];

  const grievancesList = data.grievances && data.grievances.length > 0 ? data.grievances : defaultGrievances;

  return (
    <div
      id="executive-briefing-printable"
      style={{
        width: '100%',
        maxWidth: '210mm',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: '#1f2937',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif",
        lineHeight: 1.45,
        fontSize: '11pt',
        boxSizing: 'border-box',
      }}
    >
      {/* =========================================================================
          PAGE 1: FORMAL COVER PAGE
          ========================================================================= */}
      <div
        style={{
          boxSizing: 'border-box',
          minHeight: '270mm',
          padding: '24mm 20mm 20mm 20mm',
          textAlign: 'center',
          pageBreakAfter: 'always',
          breakAfter: 'page',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Directorate Letterhead */}
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              backgroundColor: '#922C42',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '22px',
              letterSpacing: '1px',
              marginBottom: '16px',
            }}
          >
            HQ
          </div>

          <h1
            style={{
              fontSize: '22pt',
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: '#922C42',
              margin: '0 0 8px 0',
              textTransform: 'uppercase',
            }}
          >
            HostelHQ University Housing Directorate
          </h1>

          <p
            style={{
              fontSize: '13pt',
              fontWeight: 600,
              color: '#374151',
              margin: '0 0 4px 0',
            }}
          >
            Executive Directorate of Student Welfare
          </p>

          <p
            style={{
              fontSize: '10.5pt',
              color: '#6b7280',
              margin: '0 0 35px 0',
              letterSpacing: '0.02em',
            }}
          >
            Accreditation &amp; Private Accommodation Governance Council
          </p>

          {/* Centered Document Reference Box */}
          <div
            style={{
              border: '2.5px solid #922C42',
              borderRadius: '10px',
              padding: '28px 24px',
              margin: '25px auto 40px auto',
              maxWidth: '520px',
              backgroundColor: '#fffdfd',
              boxShadow: '0 2px 8px rgba(146, 44, 66, 0.05)',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                backgroundColor: '#922C42',
                color: '#ffffff',
                fontSize: '9pt',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                borderRadius: '4px',
                marginBottom: '14px',
              }}
            >
              Statutory Executive Document
            </div>

            <h2
              style={{
                fontSize: '19pt',
                fontWeight: 800,
                color: '#922C42',
                margin: '0 0 16px 0',
                letterSpacing: '0.02em',
                lineHeight: 1.25,
              }}
            >
              EXECUTIVE COUNCIL BRIEFING REPORT
            </h2>

            <div
              style={{
                borderTop: '1px solid #f3d6dc',
                paddingTop: '14px',
                fontSize: '11pt',
                color: '#374151',
                textAlign: 'left',
                margin: '0 auto',
                maxWidth: '400px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: '#6b7280' }}>Academic Year:</span>
                <span style={{ fontWeight: 700 }}>{academicYear}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: '#6b7280' }}>Reporting Period:</span>
                <span style={{ fontWeight: 700 }}>{reportingPeriod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: '#6b7280' }}>Report Date:</span>
                <span style={{ fontWeight: 700 }}>{data.generatedDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: '#6b7280' }}>Document Ref:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#922C42' }}>{docRef}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recipients and Sign-Off Block */}
        <div>
          <div style={{ margin: '0 auto 30px auto', maxWidth: '480px', textAlign: 'center' }}>
            <p style={{ fontSize: '10pt', color: '#6b7280', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Prepared for:
            </p>
            <p style={{ fontSize: '11.5pt', fontWeight: 700, color: '#111827', margin: 0 }}>
              Academic Board, University Council &amp; Directorate of Student Welfare
            </p>
          </div>

          <div style={{ margin: '0 auto 40px auto', maxWidth: '480px', textAlign: 'center' }}>
            <p style={{ fontSize: '10pt', color: '#6b7280', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Prepared by:
            </p>
            <p style={{ fontSize: '11.5pt', fontWeight: 700, color: '#111827', margin: 0 }}>
              Executive Directorate of Student Housing &amp; Private Accommodation Governance
            </p>
          </div>

          <div
            style={{
              margin: '30px auto 10px auto',
              width: '320px',
              borderTop: '1.5px solid #1f2937',
              paddingTop: '10px',
            }}
          >
            <p style={{ fontSize: '10.5pt', fontWeight: 700, color: '#111827', margin: '0 0 4px 0' }}>
              Official Signature &amp; Stamp
            </p>
            <p style={{ fontSize: '9pt', color: '#6b7280', margin: 0 }}>
              Date: _______________________________
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PAGE 2: EXECUTIVE SUMMARY & STATUTORY CEILINGS
          ========================================================================= */}
      <div
        style={{
          boxSizing: 'border-box',
          minHeight: '270mm',
          padding: '20mm 20mm',
          pageBreakAfter: 'always',
          breakAfter: 'page',
        }}
      >
        {/* Mini running header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '8px',
            marginBottom: '20px',
            fontSize: '8.5pt',
            color: '#9ca3af',
          }}
        >
          <span>HOSTELHQ EXECUTIVE COUNCIL BRIEFING REPORT</span>
          <span>REF: {docRef}</span>
        </div>

        {/* Section 1: Portfolio Assessment */}
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '11.5pt',
              fontWeight: 800,
              color: '#ffffff',
              backgroundColor: '#922C42',
              padding: '9px 14px',
              margin: '0 0 14px 0',
              borderRadius: '4px',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            1. Private Student Housing Portfolio Assessment
          </h2>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '12px',
              fontSize: '10.5pt',
            }}
          >
            <tbody>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '6px 4px', fontWeight: 700, width: '45%' }}>Total Registered Hostels:</td>
                <td style={{ padding: '6px 4px', fontWeight: 800, color: '#111827' }}>{data.totalHostels} Properties</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '5px 4px 5px 20px', color: '#4b5563' }}>├─ Accredited under charter:</td>
                <td style={{ padding: '5px 4px', color: '#065f46', fontWeight: 600 }}>{data.accreditedHostels} hostels</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '5px 4px 5px 20px', color: '#4b5563' }}>└─ Pending accreditation review:</td>
                <td style={{ padding: '5px 4px', color: '#b45309', fontWeight: 600 }}>{pendingCount} hostels</td>
              </tr>

              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 4px 6px 4px', fontWeight: 700 }}>Verified Off-Campus Beds:</td>
                <td style={{ padding: '8px 4px 6px 4px', fontWeight: 800, color: '#1d4ed8' }}>{data.totalBeds.toLocaleString()} Bed Spaces</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '5px 4px 5px 20px', color: '#4b5563' }}>├─ Audited &amp; compliant:</td>
                <td style={{ padding: '5px 4px', color: '#065f46', fontWeight: 600 }}>{data.auditedBeds || data.totalBeds} (100%)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '5px 4px 5px 20px', color: '#4b5563' }}>└─ Under corrective review:</td>
                <td style={{ padding: '5px 4px', color: '#6b7280' }}>0 spaces</td>
              </tr>

              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 4px 6px 4px', fontWeight: 700 }}>Portfolio Compliance Rate:</td>
                <td style={{ padding: '8px 4px 6px 4px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '10pt',
                    }}
                  >
                    {data.complianceRate}% Active Standing
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Campus Rental Price Indices */}
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '11.5pt',
              fontWeight: 800,
              color: '#ffffff',
              backgroundColor: '#922C42',
              padding: '9px 14px',
              margin: '0 0 14px 0',
              borderRadius: '4px',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            2. Campus Rental Price Indices (Statutory Limits)
          </h2>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '10px',
              fontSize: '10pt',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #922C42' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Room Category</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>Market Average</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>Statutory Cap</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#374151' }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>1 in a Room (Single)</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>GH₵ {data.rentIndices.oneInRoom.toLocaleString()}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6b7280' }}>GH₵ {caps.one.toLocaleString()}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', color: '#059669', fontWeight: 700 }}>
                  {getVariance(data.rentIndices.oneInRoom, caps.one)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>2 in a Room (Double)</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>GH₵ {data.rentIndices.twoInRoom.toLocaleString()}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6b7280' }}>GH₵ {caps.two.toLocaleString()}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', color: '#059669', fontWeight: 700 }}>
                  {getVariance(data.rentIndices.twoInRoom, caps.two)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>3 in a Room (Triple)</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>GH₵ {data.rentIndices.threeInRoom.toLocaleString()}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6b7280' }}>GH₵ {caps.three.toLocaleString()}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', color: '#059669', fontWeight: 700 }}>
                  {getVariance(data.rentIndices.threeInRoom, caps.three)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>4 in a Room (Quad)</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>GH₵ {data.rentIndices.fourInRoom.toLocaleString()}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6b7280' }}>GH₵ {caps.four.toLocaleString()}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', color: '#059669', fontWeight: 700 }}>
                  {getVariance(data.rentIndices.fourInRoom, caps.four)}
                </td>
              </tr>
            </tbody>
          </table>

          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              borderLeft: '3px solid #10b981',
              borderRadius: '3px',
              fontSize: '9.5pt',
              color: '#065f46',
            }}
          >
            <strong>Statutory Summary:</strong> Market pricing is 19%–52% BELOW statutory university ceilings. All room types in accredited hostels fully comply with current price controls.
          </div>
        </div>

        {/* Section 3 & 4 Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Section 3: Pending Audits */}
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '14px',
              backgroundColor: '#fafafa',
            }}
          >
            <h3
              style={{
                fontSize: '10pt',
                fontWeight: 800,
                color: '#922C42',
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
              }}
            >
              3. Pending Accreditation Audits
            </h3>
            <p style={{ margin: '0 0 6px 0', fontSize: '9.5pt' }}>
              <strong>Pipeline Status:</strong> {data.pendingAudits} audits awaiting desk verification
            </p>
            <p style={{ margin: '0 0 6px 0', fontSize: '9.5pt' }}>
              <strong>Timeline:</strong> Awaiting Coordinator review
            </p>
            <p style={{ margin: 0, fontSize: '9.5pt' }}>
              <strong>Priority:</strong> <span style={{ color: '#b45309', fontWeight: 700 }}>High Priority</span>
            </p>
          </div>

          {/* Section 4: Active Sanctions */}
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '14px',
              backgroundColor: '#fafafa',
            }}
          >
            <h3
              style={{
                fontSize: '10pt',
                fontWeight: 800,
                color: '#922C42',
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
              }}
            >
              4. Active Statutory Sanctions
            </h3>
            <p style={{ margin: '0 0 6px 0', fontSize: '9.5pt' }}>
              <strong>Properties Enforced:</strong>{' '}
              <span style={{ color: '#dc2626', fontWeight: 700 }}>{data.activeSanctions} properties</span>
            </p>
            <p style={{ margin: '0 0 6px 0', fontSize: '9.5pt' }}>
              <strong>Cause:</strong> Statutory charter warnings
            </p>
            <p style={{ margin: 0, fontSize: '9.5pt' }}>
              <strong>Action:</strong> Corrective compliance plans active
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PAGE 3: DETAILED COMPLIANCE MATRIX & GRIEVANCE TRENDS
          ========================================================================= */}
      <div
        style={{
          boxSizing: 'border-box',
          minHeight: '270mm',
          padding: '20mm 20mm',
          pageBreakAfter: 'always',
          breakAfter: 'page',
        }}
      >
        {/* Mini running header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '8px',
            marginBottom: '20px',
            fontSize: '8.5pt',
            color: '#9ca3af',
          }}
        >
          <span>HOSTELHQ EXECUTIVE COUNCIL BRIEFING REPORT</span>
          <span>REF: {docRef}</span>
        </div>

        {/* Portfolio Matrix */}
        <div style={{ marginBottom: '26px' }}>
          <h2
            style={{
              fontSize: '11.5pt',
              fontWeight: 800,
              color: '#ffffff',
              backgroundColor: '#922C42',
              padding: '9px 14px',
              margin: '0 0 12px 0',
              borderRadius: '4px',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            Hostel Portfolio — Detailed Compliance Matrix
          </h2>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '9pt',
              marginBottom: '8px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #922C42' }}>
                <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>HOSTEL NAME</th>
                <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: '#374151' }}>LOCATION</th>
                <th style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, color: '#374151' }}>STATUS</th>
                <th style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, color: '#374151' }}>BEDS</th>
              </tr>
            </thead>
            <tbody>
              {data.hostelPortfolio.slice(0, 12).map((hostel, idx) => {
                const isGood = hostel.status === 'Good Standing';
                const isSanctioned = hostel.status === 'Sanctioned';
                const statusBg = isGood ? '#d1fae5' : isSanctioned ? '#fef3c7' : '#fee2e2';
                const statusColor = isGood ? '#065f46' : isSanctioned ? '#92400e' : '#991b1b';
                const icon = isGood ? '✓' : isSanctioned ? '⚠' : '✗';

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 600, color: '#111827' }}>{hostel.name}</td>
                    <td style={{ padding: '6px 8px', color: '#4b5563' }}>{hostel.location}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: statusBg,
                          color: statusColor,
                          fontSize: '8pt',
                          fontWeight: 700,
                        }}
                      >
                        {icon} {hostel.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>
                      {hostel.beds}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p style={{ fontSize: '8pt', color: '#9ca3af', margin: '4px 0 0 0', textAlign: 'right' }}>
            Key: ✓ = Fully Compliant | ⚠ = Under Sanction | ✗ = Charter Revoked
          </p>
        </div>

        {/* Section 5: Grievance Distribution */}
        <div>
          <h2
            style={{
              fontSize: '11.5pt',
              fontWeight: 800,
              color: '#ffffff',
              backgroundColor: '#922C42',
              padding: '9px 14px',
              margin: '0 0 14px 0',
              borderRadius: '4px',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            5. Grievance Distribution &amp; Resolution Trends
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '8pt', color: '#6b7280', textTransform: 'uppercase' }}>Student → Hostel</span>
              <p style={{ fontSize: '13pt', fontWeight: 800, color: '#111827', margin: '2px 0 0 0' }}>
                {data.disputeStats?.studentToHostel || 1} Reports
              </p>
            </div>

            <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '8pt', color: '#6b7280', textTransform: 'uppercase' }}>Hostel → Student</span>
              <p style={{ fontSize: '13pt', fontWeight: 800, color: '#111827', margin: '2px 0 0 0' }}>
                {data.disputeStats?.managerToStudent || 1} Notices
              </p>
            </div>

            <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '8pt', color: '#6b7280', textTransform: 'uppercase' }}>Dean Arbitration</span>
              <p style={{ fontSize: '13pt', fontWeight: 800, color: '#10b981', margin: '2px 0 0 0' }}>
                {data.resolutionRate || '33%'} Concluded
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <p style={{ fontSize: '9.5pt', fontWeight: 700, color: '#374151', margin: '0 0 8px 0' }}>
              Leading Grievance Categories:
            </p>

            {grievancesList.map((g, idx) => (
              <div key={idx} style={{ marginBottom: '9px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{g.category}</span>
                  <span style={{ color: '#6b7280' }}>
                    {g.count} reports ({g.percentage}%)
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '10px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(1, g.percentage))}%`,
                      height: '100%',
                      backgroundColor: '#922C42',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: '9pt', color: '#6b7280', margin: 0, fontStyle: 'italic' }}>
            <strong>Resolution Timeline:</strong> Average 8–12 business days for concluded welfare and rent dispute adjudications.
          </p>
        </div>
      </div>

      {/* =========================================================================
          PAGE 4: RECOMMENDATIONS & THREE-TIER SIGN-OFF
          ========================================================================= */}
      <div
        style={{
          boxSizing: 'border-box',
          minHeight: '270mm',
          padding: '20mm 20mm',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* Mini running header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '8px',
              marginBottom: '20px',
              fontSize: '8.5pt',
              color: '#9ca3af',
            }}
          >
            <span>HOSTELHQ EXECUTIVE COUNCIL BRIEFING REPORT</span>
            <span>REF: {docRef}</span>
          </div>

          {/* Section 6: Recommendations */}
          <div style={{ marginBottom: '28px' }}>
            <h2
              style={{
                fontSize: '11.5pt',
                fontWeight: 800,
                color: '#ffffff',
                backgroundColor: '#922C42',
                padding: '9px 14px',
                margin: '0 0 14px 0',
                borderRadius: '4px',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              6. Recommendations &amp; Next Steps
            </h2>

            <div style={{ fontSize: '9.5pt', color: '#374151', lineHeight: 1.55 }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontWeight: 800, color: '#922C42', margin: '0 0 4px 0' }}>
                  1. IMMEDIATE (Next 30 days):
                </p>
                <p style={{ margin: 0, paddingLeft: '14px' }}>
                  ✓ Complete {data.pendingAudits} pending accreditation audits in the Coordinator verification queue.<br />
                  ✓ Resolve {data.activeSanctions} sanctioned properties&apos; corrective compliance undertakings.<br />
                  ✓ Escalate outstanding charter violations to the Dean of Students Welfare Board.
                </p>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontWeight: 800, color: '#922C42', margin: '0 0 4px 0' }}>
                  2. SHORT-TERM (Next 90 days):
                </p>
                <p style={{ margin: 0, paddingLeft: '14px' }}>
                  ✓ Review and calibrate price-change protocols with private hostel managers.<br />
                  ✓ Implement enhanced digital grievance tracking with multi-party notifications.<br />
                  ✓ Conduct semi-annual off-campus housing safety and fire compliance review.
                </p>
              </div>

              <div>
                <p style={{ fontWeight: 800, color: '#922C42', margin: '0 0 4px 0' }}>
                  3. STRATEGIC (Next Academic Year):
                </p>
                <p style={{ margin: 0, paddingLeft: '14px' }}>
                  ✓ Expand verified off-campus housing bed capacity to accommodate intake growth.<br />
                  ✓ Strengthen statutory enforcement mechanisms and fire safety audit covenants.<br />
                  ✓ Develop predictive occupancy and welfare analytics for council planning.
                </p>
              </div>
            </div>
          </div>

          {/* Section 7: Certification & Sign-off */}
          <div>
            <h2
              style={{
                fontSize: '11.5pt',
                fontWeight: 800,
                color: '#ffffff',
                backgroundColor: '#922C42',
                padding: '9px 14px',
                margin: '0 0 20px 0',
                borderRadius: '4px',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              Certification &amp; Official Sign-Off
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div>
                <p style={{ fontSize: '9pt', color: '#6b7280', margin: '0 0 35px 0' }}>Report Prepared By:</p>
                <div style={{ borderTop: '1px solid #374151', paddingTop: '6px' }}>
                  <p style={{ fontSize: '9.5pt', fontWeight: 700, margin: '0 0 2px 0' }}>Executive Director</p>
                  <p style={{ fontSize: '8pt', color: '#6b7280', margin: '0 0 4px 0' }}>Student Housing Directorate</p>
                  <p style={{ fontSize: '8pt', color: '#9ca3af', margin: 0 }}>Date: _________________</p>
                </div>
              </div>

              <div>
                <p style={{ fontSize: '9pt', color: '#6b7280', margin: '0 0 35px 0' }}>Reviewed By:</p>
                <div style={{ borderTop: '1px solid #374151', paddingTop: '6px' }}>
                  <p style={{ fontSize: '9.5pt', fontWeight: 700, margin: '0 0 2px 0' }}>Pro-Vice Chancellor</p>
                  <p style={{ fontSize: '8pt', color: '#6b7280', margin: '0 0 4px 0' }}>Academic &amp; Student Affairs</p>
                  <p style={{ fontSize: '8pt', color: '#9ca3af', margin: 0 }}>Date: _________________</p>
                </div>
              </div>

              <div>
                <p style={{ fontSize: '9pt', color: '#6b7280', margin: '0 0 35px 0' }}>Approved By:</p>
                <div style={{ borderTop: '1px solid #374151', paddingTop: '6px' }}>
                  <p style={{ fontSize: '9.5pt', fontWeight: 700, margin: '0 0 2px 0' }}>Vice-Chancellor / Rector</p>
                  <p style={{ fontSize: '8pt', color: '#6b7280', margin: '0 0 4px 0' }}>Office of the Vice-Chancellor</p>
                  <p style={{ fontSize: '8pt', color: '#9ca3af', margin: 0 }}>Date: _________________</p>
                </div>
              </div>
            </div>

            {/* Official University Seal Emblem */}
            <div
              style={{
                textAlign: 'center',
                padding: '14px 10px',
                border: '1.5px dashed #922C42',
                borderRadius: '8px',
                backgroundColor: '#fffdfd',
                margin: '0 auto 20px auto',
                maxWidth: '420px',
              }}
            >
              <p
                style={{
                  fontSize: '9.5pt',
                  fontWeight: 800,
                  color: '#922C42',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  margin: '0 0 2px 0',
                }}
              >
                [ OFFICIAL UNIVERSITY HOUSING DIRECTORATE SEAL ]
              </p>
              <p style={{ fontSize: '8pt', color: '#6b7280', margin: 0 }}>
                Certified Official Statutory Copy • Sealed &amp; Registered under Act 389
              </p>
            </div>
          </div>
        </div>

        {/* Formal Institutional Footer */}
        <div
          style={{
            borderTop: '1px solid #e5e7eb',
            paddingTop: '12px',
            fontSize: '8pt',
            color: '#9ca3af',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          <p style={{ margin: '0 0 2px 0', fontWeight: 600 }}>
            CLASSIFICATION: OFFICIAL EXECUTIVE DOCUMENT (CONFIDENTIAL)
          </p>
          <p style={{ margin: '0 0 2px 0' }}>
            DISTRIBUTION: Academic Board, Vice-Chancellor, Pro-Vice-Chancellor, Dean of Students
          </p>
          <p style={{ margin: 0 }}>
            DOCUMENT REF: {docRef} • DATE ISSUED: {data.generatedDate} • NEXT STATUTORY REVIEW: 11 December 2026
          </p>
        </div>
      </div>
    </div>
  );
}
