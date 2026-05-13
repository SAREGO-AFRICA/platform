// src/utils/email.js
// Fire-and-forget transactional email helper, backed by Resend.
// Each function returns a promise but is intended to be called without await
// from request handlers; failures are logged but never thrown to the user.

import { Resend } from 'resend';
import { query } from '../db/index.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'SAREGO <noreply@sarego.africa>';
const REPLY_TO = process.env.REPLY_TO || 'support@sarego.africa';
const APP_URL = process.env.APP_URL || 'https://sarego.africa';

if (!RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY not set - email sending will be skipped.');
}

const _resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// ---------- Core send helper ----------

async function send({ to, subject, html, text }) {
  if (!_resend) {
    console.warn('[email] skipped (no API key):', subject, 'to', to);
    return;
  }
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return;
  }
  try {
    const result = await _resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      reply_to: REPLY_TO,
      subject,
      html,
      text: text || stripHtml(html),
    });
    if (result.error) {
      console.warn('[email] send failed:', subject, '->', to, result.error);
    } else {
      console.log('[email] sent:', subject, '->', Array.isArray(to) ? to.join(',') : to);
    }
  } catch (err) {
    console.warn('[email] exception sending:', subject, err.message);
  }
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fireAndForget(promise) {
  Promise.resolve(promise).catch((err) => {
    console.warn('[email] fire-and-forget error:', err.message);
  });
}

// ---------- Shared template wrapper ----------

function wrap({ heading, body, ctaLabel, ctaUrl, footer }) {
  const cta = ctaLabel && ctaUrl
    ? `<p style="margin: 28px 0;"><a href="${ctaUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">${ctaLabel}</a></p>`
    : '';
  const footerHtml = footer
    ? `<p style="color:#888;font-size:12px;margin-top:32px;line-height:1.6;">${footer}</p>`
    : '';
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#fafafa;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
<tr><td>
<div style="font-size:11px;letter-spacing:0.14em;color:#888;text-transform:uppercase;margin-bottom:14px;">SAREGO</div>
<h1 style="font-size:20px;margin:0 0 16px;color:#1a1a1a;font-weight:600;">${heading}</h1>
<div style="font-size:14px;line-height:1.65;color:#3a3a3a;">${body}</div>
${cta}
${footerHtml}
</td></tr>
</table>
<p style="color:#999;font-size:11px;margin-top:24px;line-height:1.5;">SAREGO &middot; Southern Africa Regional Economic Growth Office<br/>Replies go to <a href="mailto:${REPLY_TO}" style="color:#999;">${REPLY_TO}</a></p>
</td></tr></table>
</body></html>`;
}

// ---------- 7 typed notification functions ----------

// 1. Welcome email (on signup)
export function sendWelcomeEmail({ to, fullName, role }) {
  const roleLabel = {
    investor: 'Investor',
    project_developer: 'Project Developer',
    government: 'Government',
    corporate: 'Corporate',
    sme: 'SME',
  }[role] || 'Member';

  return send({
    to,
    subject: 'Welcome to SAREGO',
    html: wrap({
      heading: `Welcome, ${fullName}.`,
      body: `
        <p>Your SAREGO ${roleLabel} account is active.</p>
        <p>Next step: complete KYC verification to unlock the marketplace. Once verified you'll be able to ${role === 'investor' ? 'express interest in projects and join deal rooms' : 'publish projects and engage with verified investors'}.</p>
      `,
      ctaLabel: 'Open Dashboard',
      ctaUrl: `${APP_URL}/dashboard`,
      footer: `If you didn't create this account, reply to this email and we'll investigate.`,
    }),
  });
}

// 2. KYC submitted -> notify admins
export async function sendKycSubmittedNotifyAdmins({ submittedByName, documentType }) {
  const admins = await query(
    `SELECT email, full_name FROM users WHERE role = 'admin' AND is_active = true`
  );
  if (admins.rows.length === 0) return;

  return send({
    to: admins.rows.map((a) => a.email),
    subject: `New KYC submission: ${documentType}`,
    html: wrap({
      heading: 'New KYC document for review',
      body: `
        <p><strong>${submittedByName}</strong> just submitted a <strong>${documentType.replace(/_/g, ' ')}</strong> for KYC verification.</p>
        <p>Open the admin queue to review and approve or reject.</p>
      `,
      ctaLabel: 'Open KYC Queue',
      ctaUrl: `${APP_URL}/admin`,
    }),
  });
}

// 3. KYC decided -> notify user
export function sendKycDecisionEmail({ to, fullName, documentType, decision, notes, promotedTier }) {
  const approved = decision === 'approve';
  const heading = approved
    ? `KYC ${humanType(documentType)}: approved`
    : `KYC ${humanType(documentType)}: needs another look`;

  const tierLine = approved && promotedTier
    ? `<p>Your account tier is now <strong>${promotedTier}</strong>. Additional platform features have been unlocked.</p>`
    : '';

  const body = approved
    ? `
      <p>Hi ${fullName},</p>
      <p>Your <strong>${humanType(documentType)}</strong> submission has been approved by SAREGO compliance.</p>
      ${tierLine}
      ${notes ? `<p style="background:#f6f6f6;padding:12px 14px;border-radius:6px;font-size:13px;color:#555;"><strong>Reviewer notes:</strong> ${escapeHtml(notes)}</p>` : ''}
    `
    : `
      <p>Hi ${fullName},</p>
      <p>Your <strong>${humanType(documentType)}</strong> submission was not accepted in its current form.</p>
      ${notes ? `<p style="background:#f6f6f6;padding:12px 14px;border-radius:6px;font-size:13px;color:#555;"><strong>Reviewer notes:</strong> ${escapeHtml(notes)}</p>` : ''}
      <p>You can re-submit a corrected version from your KYC page.</p>
    `;

  return send({
    to,
    subject: heading,
    html: wrap({
      heading,
      body,
      ctaLabel: approved ? 'Open Dashboard' : 'Re-submit Document',
      ctaUrl: approved ? `${APP_URL}/dashboard` : `${APP_URL}/kyc`,
    }),
  });
}

// 4. Investment interest expressed -> notify project owner
export function sendInterestExpressedEmail({
  to,
  ownerName,
  investorName,
  investorOrg,
  projectTitle,
  projectSlug,
  ticketUsd,
  message,
}) {
  const ticketLine = ticketUsd
    ? `<p><strong>Indicated ticket size:</strong> $${(ticketUsd / 1_000_000).toLocaleString()}M</p>`
    : '';
  const msgLine = message
    ? `<p style="background:#f6f6f6;padding:12px 14px;border-radius:6px;font-size:13px;color:#555;font-style:italic;">"${escapeHtml(message)}"</p>`
    : '';

  return send({
    to,
    subject: `${investorName} expressed interest in ${projectTitle}`,
    html: wrap({
      heading: 'New investor interest',
      body: `
        <p>Hi ${ownerName},</p>
        <p><strong>${investorName}</strong>${investorOrg ? ` (${investorOrg})` : ''} has expressed interest in your project <strong>${projectTitle}</strong>.</p>
        ${ticketLine}
        ${msgLine}
        <p>Open your project page to review and, if you choose, open a confidential deal room.</p>
      `,
      ctaLabel: 'View Project',
      ctaUrl: `${APP_URL}/projects/${projectSlug}`,
    }),
  });
}

// 5. Deal room opened -> notify investor (just added)
export function sendDealRoomOpenedEmail({ to, investorName, sponsorName, projectTitle, roomId, description }) {
  return send({
    to,
    subject: `Deal room opened: ${projectTitle}`,
    html: wrap({
      heading: 'A deal room has been opened for you',
      body: `
        <p>Hi ${investorName},</p>
        <p><strong>${sponsorName}</strong> has opened a confidential deal room for <strong>${projectTitle}</strong> and added you as an editor.</p>
        ${description ? `<p style="background:#f6f6f6;padding:12px 14px;border-radius:6px;font-size:13px;color:#555;">${escapeHtml(description)}</p>` : ''}
        <p>You can now view, upload, and discuss due-diligence documents in a private workspace.</p>
      `,
      ctaLabel: 'Enter Deal Room',
      ctaUrl: `${APP_URL}/deal-rooms/${roomId}`,
    }),
  });
}

// 6. Deal room document uploaded -> notify other members (throttled)
// Throttle: don't email if uploader uploaded another doc in same room in last 30 mins
export async function sendDealRoomDocumentUploadedEmail({
  roomId,
  uploaderUserId,
  uploaderName,
  documentTitle,
  projectTitle,
}) {
  // Throttle check: any previous upload by this user in this room in last 30 min?
  const throttleRes = await query(
    `SELECT 1 FROM deal_room_access_log
      WHERE deal_room_id = $1
        AND user_id = $2
        AND action = 'upload'
        AND created_at > now() - interval '30 minutes'
        AND created_at < now() - interval '5 seconds'
      LIMIT 1`,
    [roomId, uploaderUserId]
  );
  if (throttleRes.rows.length > 0) {
    console.log('[email] throttled doc upload notification for room', roomId);
    return;
  }

  // Get other members' emails (exclude uploader)
  const recipientsRes = await query(
    `SELECT u.email, u.full_name
       FROM deal_room_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.deal_room_id = $1 AND m.user_id <> $2 AND u.is_active = true`,
    [roomId, uploaderUserId]
  );
  if (recipientsRes.rows.length === 0) return;

  return send({
    to: recipientsRes.rows.map((r) => r.email),
    subject: `New document in ${projectTitle}`,
    html: wrap({
      heading: 'New document uploaded',
      body: `
        <p><strong>${uploaderName}</strong> uploaded <strong>${escapeHtml(documentTitle)}</strong> to the <strong>${projectTitle}</strong> deal room.</p>
      `,
      ctaLabel: 'Open Deal Room',
      ctaUrl: `${APP_URL}/deal-rooms/${roomId}`,
      footer: `You're receiving this because you're a member of this deal room.`,
    }),
  });
}

// 7. New member invited -> notify existing members AND welcome the new member
export async function sendDealRoomMemberInvitedEmail({
  roomId,
  inviteeUserId,
  inviteeName,
  inviteeEmail,
  inviterName,
  projectTitle,
}) {
  // Welcome the new member
  fireAndForget(send({
    to: inviteeEmail,
    subject: `You've been added to ${projectTitle}'s deal room`,
    html: wrap({
      heading: 'Deal room access granted',
      body: `
        <p>Hi ${inviteeName},</p>
        <p><strong>${inviterName}</strong> has added you to the <strong>${projectTitle}</strong> deal room.</p>
        <p>You now have access to confidential project documents and can collaborate with the rest of the team.</p>
      `,
      ctaLabel: 'Enter Deal Room',
      ctaUrl: `${APP_URL}/deal-rooms/${roomId}`,
    }),
  }));

  // Notify existing members (excluding inviter and invitee)
  const recipientsRes = await query(
    `SELECT u.email
       FROM deal_room_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.deal_room_id = $1
        AND m.user_id <> $2
        AND u.is_active = true`,
    [roomId, inviteeUserId]
  );
  if (recipientsRes.rows.length === 0) return;

  return send({
    to: recipientsRes.rows.map((r) => r.email),
    subject: `New member in ${projectTitle}'s deal room`,
    html: wrap({
      heading: 'New deal room member',
      body: `
        <p><strong>${inviteeName}</strong> has been added to the <strong>${projectTitle}</strong> deal room by ${inviterName}.</p>
      `,
      ctaLabel: 'Open Deal Room',
      ctaUrl: `${APP_URL}/deal-rooms/${roomId}`,
    }),
  });
}

// ---------- Public fire-and-forget wrappers ----------

export const email = {
  welcome: (args) => fireAndForget(sendWelcomeEmail(args)),
  kycSubmitted: (args) => fireAndForget(sendKycSubmittedNotifyAdmins(args)),
  kycDecided: (args) => fireAndForget(sendKycDecisionEmail(args)),
  interestExpressed: (args) => fireAndForget(sendInterestExpressedEmail(args)),
  dealRoomOpened: (args) => fireAndForget(sendDealRoomOpenedEmail(args)),
  dealRoomDocumentUploaded: (args) => fireAndForget(sendDealRoomDocumentUploadedEmail(args)),
  dealRoomMemberInvited: (args) => fireAndForget(sendDealRoomMemberInvitedEmail(args)),
};

// ---------- Utilities ----------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function humanType(t) {
  return String(t || '').replace(/_/g, ' ');
}
