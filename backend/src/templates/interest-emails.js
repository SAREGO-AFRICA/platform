// ============================================================
// interest-emails.js
// Session H Phase 6: institutional notification emails for owner-side
// interest state transitions.
//
// Three templates: shortlistedEmail, declinedEmail, awardedEmail.
// Each returns { subject, html, text } and is consumed by utils/email.js send().
//
// Tone: institutional, conversational with context (Q10=b). Sender is
// noreply but message identifies the organization (Q11=b). Decline reason
// is never surfaced (Q12=b). Awarded email includes indicative terms if
// any were submitted (Q13=a). Contact-reveal language is institutional
// (Q14 institutional wording).
// ============================================================

const APP_URL = process.env.APP_URL || 'https://sarego.africa';

// ============================================================
// Style fragments (kept simple - inline HTML/CSS for max email-client compat)
// ============================================================
function wrap({ preheader, bodyHtml }) {
  // Email clients (especially Gmail/Outlook) have varied HTML support.
  // We use a minimal table layout, inline styles, and avoid external resources.
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SAREGO</title>
</head>
<body style="margin:0;padding:0;background:#0b0d10;font-family:Georgia,serif;color:#e5e7eb;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b0d10;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#161a1f;border:1px solid rgba(255,255,255,0.06);border-radius:12px;">

          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.05);">
              <div style="font-size:18px;font-weight:600;color:#f4bf4c;letter-spacing:0.3px;">SAREGO</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Southern Africa Regional Economic Growth Office</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#d1d5db;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);font-family:Arial,Helvetica,sans-serif;font-size:11px;color:rgba(255,255,255,0.4);line-height:1.5;">
              You are receiving this notification because you expressed interest in an opportunity on SAREGO.<br>
              Reply directly to <a href="mailto:support@sarego.africa" style="color:#f4bf4c;text-decoration:none;">support@sarego.africa</a> for any questions.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function viewListingUrl(listingType, listingId) {
  return `${APP_URL}/opportunities/${listingType}/${listingId}`;
}

function ctaButton({ href, label }) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr><td style="background:#f4bf4c;border-radius:6px;">
        <a href="${href}" style="display:inline-block;padding:11px 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#0b0d10;text-decoration:none;letter-spacing:0.3px;">${escapeHtml(label)}</a>
      </td></tr>
    </table>
  `;
}

// ============================================================
// 1. SHORTLISTED EMAIL
// ============================================================
export function shortlistedEmail({ partyName, ownerOrgName, listingTitle, listingType, listingId, listingTypeLabel }) {
  const orgDisplay = ownerOrgName || 'the opportunity owner';
  const url = viewListingUrl(listingType, listingId);

  const subject = `Your interest in "${truncate(listingTitle, 60)}" has been shortlisted`;

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#fff;font-size:16px;">Hello ${escapeHtml(partyName)},</p>

    <p style="margin:0 0 16px;">
      Your expression of interest in <strong style="color:#fff;">${escapeHtml(listingTitle)}</strong> has been shortlisted by <strong style="color:#fff;">${escapeHtml(orgDisplay)}</strong>.
    </p>

    <p style="margin:0 0 16px;">
      Your contact details have been shared with the opportunity owner to facilitate direct engagement regarding this opportunity.
    </p>

    <p style="margin:0 0 8px;">
      Listing reference: ${listingTypeLabel} on SAREGO
    </p>

    ${ctaButton({ href: url, label: 'View Opportunity' })}

    <p style="margin:24px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">
      You'll be notified of further status changes related to this opportunity.
    </p>
  `;

  const text = `Hello ${partyName},

Your expression of interest in "${listingTitle}" has been shortlisted by ${orgDisplay}.

Your contact details have been shared with the opportunity owner to facilitate direct engagement regarding this opportunity.

Listing reference: ${listingTypeLabel} on SAREGO
View opportunity: ${url}

You'll be notified of further status changes related to this opportunity.

— SAREGO
support@sarego.africa`;

  return {
    subject,
    html: wrap({
      preheader: `Shortlisted by ${orgDisplay} for ${listingTitle}`,
      bodyHtml,
    }),
    text,
  };
}

// ============================================================
// 2. DECLINED EMAIL
// ============================================================
export function declinedEmail({ partyName, ownerOrgName, listingTitle, listingType, listingId, listingTypeLabel }) {
  const orgDisplay = ownerOrgName || 'the opportunity owner';

  const subject = `Update on your interest in "${truncate(listingTitle, 60)}"`;

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#fff;font-size:16px;">Hello ${escapeHtml(partyName)},</p>

    <p style="margin:0 0 16px;">
      Thank you for expressing interest in <strong style="color:#fff;">${escapeHtml(listingTitle)}</strong>.
    </p>

    <p style="margin:0 0 16px;">
      ${escapeHtml(orgDisplay)} has decided not to proceed with your expression of interest on this opportunity.
    </p>

    <p style="margin:0 0 16px;color:rgba(255,255,255,0.7);">
      Other live opportunities across the SAREGO network may align with your mandate. Browse all active opportunities to discover further engagements.
    </p>

    ${ctaButton({ href: `${APP_URL}/opportunities`, label: 'Browse Opportunities' })}
  `;

  const text = `Hello ${partyName},

Thank you for expressing interest in "${listingTitle}".

${orgDisplay} has decided not to proceed with your expression of interest on this opportunity.

Other live opportunities across the SAREGO network may align with your mandate. Browse all active opportunities at ${APP_URL}/opportunities.

— SAREGO
support@sarego.africa`;

  return {
    subject,
    html: wrap({
      preheader: `${orgDisplay} has decided not to proceed.`,
      bodyHtml,
    }),
    text,
  };
}

// ============================================================
// 3. AWARDED EMAIL
// ============================================================
export function awardedEmail({
  partyName,
  ownerOrgName,
  listingTitle,
  listingType,
  listingId,
  listingTypeLabel,
  indicative, // { amount, rate_range, tenor, conditions } - may be all null
}) {
  const orgDisplay = ownerOrgName || 'the opportunity owner';
  const url = viewListingUrl(listingType, listingId);

  const subject = `You've been awarded "${truncate(listingTitle, 50)}"`;

  // Construct indicative terms section if any are present
  let indicativeBlock = '';
  let indicativeText = '';
  const hasAnyIndicative =
    indicative && (indicative.amount != null || indicative.rate_range || indicative.tenor || indicative.conditions);

  if (hasAnyIndicative) {
    const rows = [];
    if (indicative.amount != null) {
      rows.push(`<tr><td style="padding:6px 12px 6px 0;color:rgba(255,255,255,0.5);font-size:12px;">Amount</td><td style="padding:6px 0;color:#fff;font-size:13px;">$${Number(indicative.amount).toLocaleString()}</td></tr>`);
      indicativeText += `\n  Amount: $${Number(indicative.amount).toLocaleString()}`;
    }
    if (indicative.rate_range) {
      rows.push(`<tr><td style="padding:6px 12px 6px 0;color:rgba(255,255,255,0.5);font-size:12px;">Rate</td><td style="padding:6px 0;color:#fff;font-size:13px;">${escapeHtml(indicative.rate_range)}</td></tr>`);
      indicativeText += `\n  Rate: ${indicative.rate_range}`;
    }
    if (indicative.tenor) {
      rows.push(`<tr><td style="padding:6px 12px 6px 0;color:rgba(255,255,255,0.5);font-size:12px;">Tenor</td><td style="padding:6px 0;color:#fff;font-size:13px;">${escapeHtml(indicative.tenor)}</td></tr>`);
      indicativeText += `\n  Tenor: ${indicative.tenor}`;
    }
    if (indicative.conditions) {
      rows.push(`<tr><td style="padding:6px 12px 6px 0;color:rgba(255,255,255,0.5);font-size:12px;vertical-align:top;">Conditions</td><td style="padding:6px 0;color:#fff;font-size:13px;">${escapeHtml(indicative.conditions)}</td></tr>`);
      indicativeText += `\n  Conditions: ${indicative.conditions}`;
    }

    indicativeBlock = `
      <div style="margin:24px 0;padding:16px;background:rgba(132,204,22,0.06);border:1px solid rgba(132,204,22,0.25);border-radius:8px;">
        <div style="font-size:11px;color:#84cc16;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Indicative Terms Submitted</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          ${rows.join('\n          ')}
        </table>
      </div>
    `;
  }

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#fff;font-size:16px;">Hello ${escapeHtml(partyName)},</p>

    <p style="margin:0 0 16px;">
      <strong style="color:#84cc16;">Congratulations.</strong> ${escapeHtml(orgDisplay)} has awarded the opportunity <strong style="color:#fff;">${escapeHtml(listingTitle)}</strong> to you.
    </p>

    <p style="margin:0 0 16px;">
      The opportunity owner will engage with you directly to proceed with next steps. The listing has been marked as fulfilled on SAREGO.
    </p>

    ${indicativeBlock}

    <p style="margin:0 0 8px;">
      Listing reference: ${listingTypeLabel} on SAREGO
    </p>

    ${ctaButton({ href: url, label: 'View Awarded Opportunity' })}
  `;

  const text = `Hello ${partyName},

Congratulations. ${orgDisplay} has awarded the opportunity "${listingTitle}" to you.

The opportunity owner will engage with you directly to proceed with next steps. The listing has been marked as fulfilled on SAREGO.

${hasAnyIndicative ? `Indicative Terms Submitted:${indicativeText}\n` : ''}
Listing reference: ${listingTypeLabel} on SAREGO
View opportunity: ${url}

— SAREGO
support@sarego.africa`;

  return {
    subject,
    html: wrap({
      preheader: `Awarded by ${orgDisplay}`,
      bodyHtml,
    }),
    text,
  };
}

// ============================================================
// Helpers
// ============================================================
function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n - 1) + '…' : s;
}
