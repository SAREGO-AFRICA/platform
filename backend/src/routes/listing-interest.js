// ============================================================
// listing-interest.js
// Session H: owner-side interest management
//
// Endpoints:
//   GET   /api/my-listings/:listing_type/:listing_id/interest
//   PATCH /api/my-listings/:listing_type/:listing_id/interest/:interest_id
//
// Auth: all endpoints require the requester to be the OWNER of the listing.
//
// State machine (5 owner-driven + 1 party-driven):
//   expressed  → shortlisted | declined
//   shortlisted → contacted | declined | awarded
//   contacted  → declined | awarded
//   declined   (terminal — owner declined the party)
//   awarded    (terminal — this party won)
//   withdrawn  (terminal — party withdrew themselves; not transitioned here)
//
// Award action is atomic:
//   1. Set this row -> awarded, awarded_at = now()
//   2. Set all OTHER non-terminal interests on this listing -> declined,
//      declined_at = now(), declined_by = owner_id, declined_reason = system message
//   3. Set listing.status -> 'fulfilled'
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
// SAREGO-INTEREST-EMAILS-V2
import { email } from '../utils/email.js';

const router = Router();

// ============================================================
// Constants
// ============================================================
const LISTING_TABLES = {
  commodity_request:    'commodity_requests',
  logistics_load:       'logistics_loads',
  agri_offtake:         'agri_offtake_requests',
  tender:               'tenders',
  trade_finance:        'trade_finance_requests',
};

const VALID_LISTING_TYPES = Object.keys(LISTING_TABLES);

// State machine: what's a valid next state from each current state
const VALID_TRANSITIONS = {
  expressed:   ['shortlisted', 'declined'],
  shortlisted: ['contacted', 'declined', 'awarded'],
  contacted:   ['declined', 'awarded'],
  declined:    [], // terminal
  awarded:     [], // terminal
  withdrawn:   [], // terminal (party-driven; can't be transitioned here)
};

// When status flips to one of these, set the corresponding timestamp column
const STATUS_TO_TIMESTAMP_COLUMN = {
  shortlisted: 'shortlisted_at',
  contacted:   'contacted_at',
  declined:    'declined_at',
  awarded:     'awarded_at',
};

// Status values where contact info is revealed to the owner
const STATUSES_REVEALING_CONTACT = ['shortlisted', 'contacted', 'awarded'];

// ============================================================
// Email notification helpers (Session H Phase 6)
// ============================================================
const TYPE_LABEL = {
  commodity_request: 'Commodity Request',
  logistics_load:    'Logistics Load',
  agri_offtake:      'Agri Offtake',
  tender:            'Tender',
  trade_finance:     'Trade Finance',
};

// Fetch the email context for a given interest_id.
// Returns { party_name, party_email, owner_org_name, listing_title, indicative }
// Owner_org_name is derived from the listing's owner_org_id, NOT the interest's
// org_id (which is the *interested party's* org).
async function fetchInterestEmailContext(listingType, listingId, interestId) {
  const tableMap = LISTING_TABLES;
  const listingTable = tableMap[listingType];
  if (!listingTable) return null;

  // Single query: fetch user + indicative + listing title + owner org name
  const r = await query(
    `SELECT
       u.full_name AS party_name,
       u.email     AS party_email,
       oi.indicative_amount,
       oi.indicative_rate_range,
       oi.indicative_tenor,
       oi.conditions,
       lst.title AS listing_title,
       owner_org.name AS owner_org_name
       FROM opportunity_interests oi
       JOIN users u ON u.id = oi.user_id
       JOIN ${listingTable} lst ON lst.id = $1
       LEFT JOIN organizations owner_org ON owner_org.id = lst.owner_org_id
       WHERE oi.id = $2`,
    [listingId, interestId]
  );
  if (r.rowCount === 0) return null;
  const row = r.rows[0];
  return {
    party_name: row.party_name,
    party_email: row.party_email,
    owner_org_name: row.owner_org_name,
    listing_title: row.listing_title,
    indicative: {
      amount:     row.indicative_amount != null ? Number(row.indicative_amount) : null,
      rate_range: row.indicative_rate_range,
      tenor:      row.indicative_tenor,
      conditions: row.conditions,
    },
  };
}



// ============================================================
// Helper: verify ownership of a listing
// Returns the listing row if owned by req.user.id; throws 403/404 otherwise.
// ============================================================
async function assertOwnership(req, listingType, listingId) {
  if (!VALID_LISTING_TYPES.includes(listingType)) {
    const err = new Error('Invalid listing type');
    err.status = 400;
    throw err;
  }
  const table = LISTING_TABLES[listingType];
  const r = await query(
    `SELECT id, owner_user_id, status, title FROM ${table} WHERE id = $1`,
    [listingId]
  );
  if (r.rowCount === 0) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }
  const row = r.rows[0];
  if (row.owner_user_id !== req.user.id) {
    const err = new Error('Not authorized — only the listing owner can manage interest');
    err.status = 403;
    throw err;
  }
  return row;
}

// ============================================================
// GET /api/my-listings/:listing_type/:listing_id/interest
// List all interest entries for a listing the requester owns.
// ============================================================
router.get(
  '/:listing_type/:listing_id/interest',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { listing_type, listing_id } = req.params;
    const listing = await assertOwnership(req, listing_type, listing_id);

    const r = await query(
      `SELECT
         oi.id,
         oi.status,
         oi.message,
         oi.created_at,
         oi.updated_at,
         oi.shortlisted_at,
         oi.contacted_at,
         oi.declined_at,
         oi.awarded_at,
         oi.declined_reason,
         oi.indicative_amount,
         oi.indicative_rate_range,
         oi.indicative_tenor,
         oi.conditions,
         oi.owner_response,
         oi.owner_response_note,
         oi.owner_counter_amount,
         oi.owner_counter_rate_range,
         oi.owner_counter_tenor,
         oi.owner_counter_conditions,
         oi.owner_responded_at,
         u.id          AS user_id,
         u.full_name   AS user_full_name,
         u.email       AS user_email,
         u.trust_tier  AS user_trust_tier,
         o.id          AS org_id,
         o.name        AS org_name,
         o.organization_type AS org_organization_type,
         o.institution_category AS org_institution_category,
         c.iso_code    AS org_country_iso,
         c.name        AS org_country_name,
         cv.id         AS conversation_id
       FROM opportunity_interests oi
       JOIN users u ON u.id = oi.user_id
       LEFT JOIN organizations o ON o.id = oi.org_id
       LEFT JOIN countries c ON c.id = o.country_id
       LEFT JOIN conversations cv ON cv.interest_id = oi.id
       WHERE oi.opportunity_type = $1 AND oi.opportunity_id = $2
       ORDER BY
         CASE oi.status
           WHEN 'awarded'     THEN 0
           WHEN 'shortlisted' THEN 1
           WHEN 'contacted'   THEN 2
           WHEN 'expressed'   THEN 3
           WHEN 'declined'    THEN 4
           WHEN 'withdrawn'   THEN 5
         END,
         oi.created_at DESC`,
      [listing_type, listing_id]
    );

    // Conditionally redact email per Q3:
    // Email visible only when status has reached 'shortlisted' or beyond
    const interests = r.rows.map((row) => {
      const revealContact = STATUSES_REVEALING_CONTACT.includes(row.status);
      return {
        id: row.id,
        status: row.status,
        message: row.message,
        created_at: row.created_at,
        updated_at: row.updated_at,
        timestamps: {
          shortlisted_at: row.shortlisted_at,
          contacted_at:   row.contacted_at,
          declined_at:    row.declined_at,
          awarded_at:     row.awarded_at,
        },
        declined_reason: row.declined_reason,
        indicative: {
          amount:     row.indicative_amount != null ? Number(row.indicative_amount) : null,
          rate_range: row.indicative_rate_range,
          tenor:      row.indicative_tenor,
          conditions: row.conditions,
        },
        owner_response: {
          type:             row.owner_response || null,
          note:             row.owner_response_note || null,
          counter_amount:   row.owner_counter_amount != null ? Number(row.owner_counter_amount) : null,
          counter_rate:     row.owner_counter_rate_range || null,
          counter_tenor:    row.owner_counter_tenor || null,
          counter_conditions: row.owner_counter_conditions || null,
          responded_at:     row.owner_responded_at || null,
        },
        user: {
          id: row.user_id,
          full_name: row.user_full_name,
          // Email gated by status
          email: revealContact ? row.user_email : null,
          trust_tier: row.user_trust_tier,
        },
        conversation_id: row.conversation_id || null,
        organization: row.org_id ? {
          id: row.org_id,
          name: row.org_name,
          organization_type: row.org_organization_type,
          institution_category: row.org_institution_category,
          country_iso: row.org_country_iso,
          country_name: row.org_country_name,
        } : null,
      };
    });

    // Aggregate counts per status for the page header
    const counts = interests.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      listing: {
        id:     listing.id,
        type:   listing_type,
        title:  listing.title,
        status: listing.status,
      },
      total:    interests.length,
      counts,
      interests,
    });
  })
);

// ============================================================
// PATCH /api/my-listings/:listing_type/:listing_id/interest/:interest_id
// Transition interest state (shortlist/contact/decline/award).
// Award cascade: other interests -> declined; listing -> fulfilled.
// ============================================================
const PATCH_SCHEMA = z.object({
  status:          z.enum(['shortlisted', 'contacted', 'declined', 'awarded']),
  declined_reason: z.string().max(500).optional(),
});

router.patch(
  '/:listing_type/:listing_id/interest/:interest_id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { listing_type, listing_id, interest_id } = req.params;
    const body = PATCH_SCHEMA.parse(req.body || {});
    const listing = await assertOwnership(req, listing_type, listing_id);

    // Fetch current interest row to validate transition
    const current = await query(
      `SELECT id, status FROM opportunity_interests
        WHERE id = $1 AND opportunity_type = $2 AND opportunity_id = $3`,
      [interest_id, listing_type, listing_id]
    );
    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Interest not found for this listing' });
    }
    const currentStatus = current.rows[0].status;

    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(body.status)) {
      return res.status(400).json({
        error: `Invalid transition: ${currentStatus} → ${body.status}`,
        allowed_from_current: allowedNext,
      });
    }

    const tsColumn = STATUS_TO_TIMESTAMP_COLUMN[body.status];
    const ownerId = req.user.id;

    // ====== Non-award transitions ======
    if (body.status !== 'awarded') {
      const setFragments = [
        `status = $1`,
        `${tsColumn} = now()`,
        `updated_at = now()`,
      ];
      const params = [body.status, interest_id];

      if (body.status === 'declined') {
        setFragments.push(`declined_by = $${params.length + 1}`);
        params.push(ownerId);
        if (body.declined_reason) {
          setFragments.push(`declined_reason = $${params.length + 1}`);
          params.push(body.declined_reason);
        }
      }

      const r = await query(
        `UPDATE opportunity_interests
            SET ${setFragments.join(', ')}
          WHERE id = $${params.indexOf(interest_id) + 1}
        RETURNING id, status, ${tsColumn} AS transition_at`,
        params
      );

      // Fire-and-forget email notification (shortlist / decline only — 'contacted' is internal)
      try {
        const ctx = await fetchInterestEmailContext(listing_type, listing_id, interest_id);
        if (ctx && ctx.party_email) {
          const templateInput = {
            to: ctx.party_email,
            partyName: ctx.party_name,
            ownerOrgName: ctx.owner_org_name,
            listingTitle: ctx.listing_title,
            listingType: listing_type,
            listingId: listing_id,
            listingTypeLabel: TYPE_LABEL[listing_type] || listing_type,
          };
          if (body.status === 'shortlisted') {
            email.interestShortlisted(templateInput);
            // Auto-create conversation thread (B2: auto-create on shortlist)
            try {
              await query(
                `INSERT INTO conversations (listing_type, listing_id, owner_user_id, party_user_id, interest_id)
                 VALUES ($1, $2, $3, (SELECT user_id FROM opportunity_interests WHERE id = $4), $4)
                 ON CONFLICT (listing_type, listing_id, party_user_id) DO NOTHING`,
                [listing_type, listing_id, ownerId, interest_id]
              );
            } catch (convErr) {
              console.warn('[conversation] auto-create failed:', convErr?.message);
            }
          } else if (body.status === 'declined') {
            email.interestDeclined(templateInput);
          }
          // 'contacted' is internal-only — no email
        }
      } catch (emailErr) {
        console.warn('[interest-email] context fetch failed:', emailErr?.message);
      }

      return res.json({
        updated: r.rows[0],
        cascade: null,
      });
    }

    // ====== Award transition: atomic cascade ======
    const cascadeResult = await withTransaction(async (client) => {
      // 1. Set this row -> awarded
      const awardR = await client.query(
        `UPDATE opportunity_interests
            SET status = 'awarded', awarded_at = now(), updated_at = now()
          WHERE id = $1
        RETURNING id, awarded_at`,
        [interest_id]
      );

      // 2. Decline all other non-terminal interests on this listing
      const declineR = await client.query(
        `UPDATE opportunity_interests
            SET status = 'declined',
                declined_at = now(),
                declined_by = $1,
                declined_reason = 'Listing awarded to another party',
                updated_at = now()
          WHERE opportunity_type = $2
            AND opportunity_id = $3
            AND id != $4
            AND status NOT IN ('declined', 'awarded', 'withdrawn')
        RETURNING id`,
        [ownerId, listing_type, listing_id, interest_id]
      );

      // 3. Close the listing
      const listingTable = LISTING_TABLES[listing_type];
      const listingR = await client.query(
        `UPDATE ${listingTable}
            SET status = 'fulfilled', updated_at = now()
          WHERE id = $1
        RETURNING id, status`,
        [listing_id]
      );

      return {
        awarded: awardR.rows[0],
        others_declined_count: declineR.rowCount,
        listing_closed: listingR.rows[0],
      };
    });

    // Fire-and-forget notification emails after award cascade
    try {
      const awardedCtx = await fetchInterestEmailContext(listing_type, listing_id, interest_id);
      if (awardedCtx && awardedCtx.party_email) {
        email.interestAwarded({
          to: awardedCtx.party_email,
          partyName: awardedCtx.party_name,
          ownerOrgName: awardedCtx.owner_org_name,
          listingTitle: awardedCtx.listing_title,
          listingType: listing_type,
          listingId: listing_id,
          listingTypeLabel: TYPE_LABEL[listing_type] || listing_type,
          indicative: awardedCtx.indicative,
        });
      }

      // Each auto-declined party gets a declined email.
      // Cascade just declined them with system reason; we don't include the reason per Q12=b.
      const declinedRows = await query(
        `SELECT u.full_name, u.email
           FROM opportunity_interests oi
           JOIN users u ON u.id = oi.user_id
          WHERE oi.opportunity_type = $1
            AND oi.opportunity_id = $2
            AND oi.id != $3
            AND oi.status = 'declined'
            AND oi.declined_reason = 'Listing awarded to another party'`,
        [listing_type, listing_id, interest_id]
      );
      for (const dRow of declinedRows.rows) {
        if (!dRow.email) continue;
        email.interestDeclined({
          to: dRow.email,
          partyName: dRow.full_name,
          ownerOrgName: awardedCtx?.owner_org_name,
          listingTitle: awardedCtx?.listing_title || 'this opportunity',
          listingType: listing_type,
          listingId: listing_id,
          listingTypeLabel: TYPE_LABEL[listing_type] || listing_type,
        });
      }
    } catch (emailErr) {
      console.warn('[interest-email] award cascade emails failed:', emailErr?.message);
    }

    res.json({
      updated: { id: interest_id, status: 'awarded' },
      cascade: cascadeResult,
    });
  })
);

// ============================================================
// PATCH /api/my-listings/:listing_type/:listing_id/interest/:interest_id/respond
// Owner responds to indicative terms: accept, counter, or request clarification.
// ============================================================
const RESPOND_SCHEMA = z.object({
  response_type: z.enum(['accepted', 'countered', 'clarification_requested']),
  note:          z.string().max(1000).optional(),
  counter_amount:     z.number().positive().optional(),
  counter_rate_range: z.string().max(100).optional(),
  counter_tenor:      z.string().max(100).optional(),
  counter_conditions: z.string().max(1000).optional(),
});

router.patch(
  '/:listing_type/:listing_id/interest/:interest_id/respond',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { listing_type, listing_id, interest_id } = req.params;
    const body = RESPOND_SCHEMA.parse(req.body || {});
    await assertOwnership(req, listing_type, listing_id);

    const current = await query(
      `SELECT id, indicative_amount, indicative_rate_range, indicative_tenor, conditions
         FROM opportunity_interests WHERE id = $1 AND opportunity_type = $2 AND opportunity_id = $3`,
      [interest_id, listing_type, listing_id]
    );
    if (current.rowCount === 0) return res.status(404).json({ error: 'Interest not found' });

    const r = await query(
      `UPDATE opportunity_interests SET
         owner_response           = $1,
         owner_response_note      = $2,
         owner_counter_amount     = $3,
         owner_counter_rate_range = $4,
         owner_counter_tenor      = $5,
         owner_counter_conditions = $6,
         owner_responded_at       = now(),
         updated_at               = now()
       WHERE id = $7
       RETURNING id, owner_response, owner_responded_at`,
      [body.response_type, body.note || null, body.counter_amount || null,
       body.counter_rate_range || null, body.counter_tenor || null,
       body.counter_conditions || null, interest_id]
    );

    res.json({ updated: r.rows[0] });
  })
);

export default router;
