// src/routes/activity.js
// Unified event stream for the live activity feed.
// Aggregates recent events across projects, the 5 opportunity verticals,
// investment_interests, and deal_rooms. Audience filters narrow the mix
// to events relevant to investors / governments / trade-hub viewers.

import { Router } from 'express';
import { query } from '../db/index.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();

// Allowed audiences and which event types they show
const AUDIENCE_FILTERS = {
  investors:   ['project_published', 'tender_posted', 'agri_offtake_posted', 'interest_expressed', 'deal_room_opened'],
  governments: ['tender_posted', 'project_published', 'interest_expressed'],
  trade:       ['commodity_request_posted', 'logistics_load_posted', 'agri_offtake_posted', 'tender_posted'],
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const audience = req.query.audience?.toString();
    const country = req.query.country?.toString().toUpperCase();

    // Fetch each event type with a per-source cap so one type doesn't drown others
    const perSourceLimit = Math.max(5, Math.ceil(limit * 0.6));

    const [
      projectsRes,
      commodityRes,
      logisticsRes,
      agriRes,
      tendersRes,
      interestsRes,
      dealRoomsRes,
    ] = await Promise.all([
      query(
        `SELECT p.id, p.title, p.slug, p.country_iso AS country_iso,
                p.capital_required_usd AS value_usd, p.created_at AS ts,
                'project_published' AS event_type,
                COALESCE(p.organization_name, 'SAREGO Verified Listing') AS owner_label
           FROM (
             SELECT pp.id, pp.title, pp.slug, c.iso_code AS country_iso,
                    pp.capital_required_usd, pp.created_at,
                    org.name AS organization_name
               FROM projects pp
               JOIN countries c ON c.id = pp.country_id
               LEFT JOIN organizations org ON org.id = pp.organization_id
              WHERE pp.status = 'published'
                ${country ? "AND c.iso_code = $1" : ''}
              ORDER BY pp.created_at DESC
              LIMIT ${perSourceLimit}
           ) p`,
        country ? [country] : []
      ),
      query(
        `SELECT id, title, country_iso, value_usd, applicants_count, verified_level,
                published_at AS ts, 'commodity_request_posted' AS event_type,
                'Verified buyer' AS owner_label
           FROM commodity_requests
          WHERE status = 'published'
            ${country ? "AND country_iso = $1" : ''}
          ORDER BY published_at DESC
          LIMIT ${perSourceLimit}`,
        country ? [country] : []
      ),
      query(
        `SELECT id, title, country_iso, value_usd, applicants_count, verified_level,
                origin_country_iso, destination_country_iso,
                published_at AS ts, 'logistics_load_posted' AS event_type,
                'Verified shipper' AS owner_label
           FROM logistics_loads
          WHERE status = 'published'
            ${country ? "AND (origin_country_iso = $1 OR destination_country_iso = $1)" : ''}
          ORDER BY published_at DESC
          LIMIT ${perSourceLimit}`,
        country ? [country] : []
      ),
      query(
        `SELECT id, title, country_iso, value_usd, applicants_count, verified_level,
                published_at AS ts, 'agri_offtake_posted' AS event_type,
                'Verified offtaker' AS owner_label
           FROM agri_offtake_requests
          WHERE status = 'published'
            ${country ? "AND country_iso = $1" : ''}
          ORDER BY published_at DESC
          LIMIT ${perSourceLimit}`,
        country ? [country] : []
      ),
      query(
        `SELECT id, title, country_iso, value_usd, applicants_count, verified_level,
                tender_reference, issuing_authority, tender_type,
                published_at AS ts, 'tender_posted' AS event_type,
                COALESCE(issuing_authority, 'Government tender') AS owner_label
           FROM tenders
          WHERE status = 'published'
            ${country ? "AND country_iso = $1" : ''}
          ORDER BY published_at DESC
          LIMIT ${perSourceLimit}`,
        country ? [country] : []
      ),
      query(
        `SELECT i.id, i.ticket_usd AS value_usd, i.created_at AS ts,
                'interest_expressed' AS event_type,
                p.title, c.iso_code AS country_iso, p.slug,
                inv.full_name AS owner_label
           FROM investment_interests i
           JOIN projects p ON p.id = i.project_id
           JOIN countries c ON c.id = p.country_id
           JOIN users inv ON inv.id = i.investor_id
          WHERE p.status = 'published'
            ${country ? "AND c.iso_code = $1" : ''}
          ORDER BY i.created_at DESC
          LIMIT ${perSourceLimit}`,
        country ? [country] : []
      ),
      query(
        `SELECT dr.id, dr.created_at AS ts, 'deal_room_opened' AS event_type,
                p.title, c.iso_code AS country_iso, p.slug,
                'SAREGO Verified Listing' AS owner_label
           FROM deal_rooms dr
           JOIN projects p ON p.id = dr.project_id
           JOIN countries c ON c.id = p.country_id
          WHERE dr.is_active = true
            ${country ? "AND c.iso_code = $1" : ''}
          ORDER BY dr.created_at DESC
          LIMIT ${perSourceLimit}`,
        country ? [country] : []
      ),
    ]);

    // Normalize all rows into a unified event shape
    const events = [
      ...projectsRes.rows.map((r) => ({
        id: `proj-${r.id}`,
        type: r.event_type,
        title: r.title,
        slug: r.slug,
        country_iso: r.country_iso,
        value_usd: r.value_usd ? Number(r.value_usd) : null,
        applicants_count: null,
        verified_level: null,
        owner_label: r.owner_label,
        timestamp: r.ts,
      })),
      ...commodityRes.rows.map((r) => ({
        id: `commodity-${r.id}`,
        type: r.event_type,
        title: r.title,
        country_iso: r.country_iso,
        value_usd: r.value_usd ? Number(r.value_usd) : null,
        applicants_count: r.applicants_count,
        verified_level: r.verified_level,
        owner_label: r.owner_label,
        timestamp: r.ts,
      })),
      ...logisticsRes.rows.map((r) => ({
        id: `logistics-${r.id}`,
        type: r.event_type,
        title: r.title,
        country_iso: r.country_iso,
        value_usd: r.value_usd ? Number(r.value_usd) : null,
        applicants_count: r.applicants_count,
        verified_level: r.verified_level,
        owner_label: r.owner_label,
        metadata: {
          origin_country_iso: r.origin_country_iso,
          destination_country_iso: r.destination_country_iso,
        },
        timestamp: r.ts,
      })),
      ...agriRes.rows.map((r) => ({
        id: `agri-${r.id}`,
        type: r.event_type,
        title: r.title,
        country_iso: r.country_iso,
        value_usd: r.value_usd ? Number(r.value_usd) : null,
        applicants_count: r.applicants_count,
        verified_level: r.verified_level,
        owner_label: r.owner_label,
        timestamp: r.ts,
      })),
      ...tendersRes.rows.map((r) => ({
        id: `tender-${r.id}`,
        type: r.event_type,
        title: r.title,
        country_iso: r.country_iso,
        value_usd: r.value_usd ? Number(r.value_usd) : null,
        applicants_count: r.applicants_count,
        verified_level: r.verified_level,
        owner_label: r.owner_label,
        metadata: {
          tender_reference: r.tender_reference,
          issuing_authority: r.issuing_authority,
          tender_type: r.tender_type,
        },
        timestamp: r.ts,
      })),
      ...interestsRes.rows.map((r) => ({
        id: `interest-${r.id}`,
        type: r.event_type,
        title: r.title,
        slug: r.slug,
        country_iso: r.country_iso,
        value_usd: r.value_usd ? Number(r.value_usd) : null,
        applicants_count: null,
        verified_level: null,
        owner_label: r.owner_label,
        timestamp: r.ts,
      })),
      ...dealRoomsRes.rows.map((r) => ({
        id: `dealroom-${r.id}`,
        type: r.event_type,
        title: r.title,
        slug: r.slug,
        country_iso: r.country_iso,
        value_usd: null,
        applicants_count: null,
        verified_level: null,
        owner_label: r.owner_label,
        timestamp: r.ts,
      })),
    ];

    // Apply audience filter
    let filtered = events;
    if (audience && AUDIENCE_FILTERS[audience]) {
      const allowedTypes = new Set(AUDIENCE_FILTERS[audience]);
      filtered = events.filter((e) => allowedTypes.has(e.type));
    }

    // Sort by timestamp DESC and cap at requested limit
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const sliced = filtered.slice(0, limit);

    res.json({ events: sliced, count: sliced.length });
  })
);

export default router;
