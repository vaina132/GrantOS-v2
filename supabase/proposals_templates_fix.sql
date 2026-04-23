-- ============================================================================
-- proposals_templates_fix.sql
-- Corrects the built-in call templates based on the 10-agent domain audit.
--
-- Summary of changes by template:
--
--   HORIZON EUROPE
--     - Removed the invented "Budget commitment" framing — budget is Part A §3.
--     - Added the Part B technical narrative (the primary scored doc — was missing).
--     - Demoted "Ownership Control Declaration" from required → optional:
--       per HE Reg. (EU) 2021/695 Art. 22(5) it is only required on calls
--       flagged strategic-autonomy / security-sensitive.
--     - Fixed the Ethics row — it's Part A §4 completed inside SEDIA,
--       not a file upload. We keep a checklist row (upload, optional) so
--       coordinators can confirm the SEDIA checkboxes were ticked.
--     - Fixed the Ownership-Control template_url to the direct DOCX
--       (the old URL landed on a generic portal index page).
--     - "Letter of Commitment" demoted to optional — only required for
--       associated partners / third-country entities not receiving EU funding.
--     - "CVs of key researchers" removed — HE embeds CVs in Part B,
--       not as a separate annex.
--
--   LIFE PROGRAMME
--     - Removed "Ownership Control Declaration" entirely. OCD is a
--       Horizon Europe / DEP / EDF / CEF-DIG instrument; LIFE has no such
--       requirement. (Worker 3 + Worker 8 confirmed; LIFE-specific OCD URL 404s.)
--     - Added Detailed Budget Table (Annex 2) — LIFE Call Fiche §5.
--     - Added Participant Information annex — LIFE 2025 FAQ.
--     - Added Financial Capacity self-check — conditional on EU contribution
--       ≥ €500k per Financial Regulation Art. 198.
--
--   ERASMUS+
--     - Clarified OID (not PIC) as the partner identifier.
--     - Added Declaration of Honour — mandatory in every KA220 submission
--       from the legal representative of each partner.
--     - Reframed "Mandate letter" → "Partner mandates (one per partner)"
--       to reflect KA220 cardinality (N mandates, not 1).
--     - Added Part B narrative (the scored technical document).
--
--   GENERIC CALL
--     - Added a narrative row — any grant has a primary technical doc.
--
-- Verification query at the bottom.
-- Safe to re-run: UPDATEs match on (name, is_builtin, org_id IS NULL).
-- ============================================================================

BEGIN;

-- ─── Horizon Europe ─────────────────────────────────────────────────────────
UPDATE proposal_call_templates
SET default_documents = '[
  {
    "type": "part_a",
    "label": "Part A — Partner profile (SEDIA worksheet)",
    "handler": "form",
    "required": true,
    "template_url": null,
    "description": "Administrative and profile information you will transcribe into SEDIA Part A. Filled inside GrantLume as a worksheet per partner."
  },
  {
    "type": "budget",
    "label": "Budget worksheet (Part A §3 input)",
    "handler": "form",
    "required": true,
    "template_url": null,
    "description": "Per-WP person-months, PM rate, and other direct costs. Feeds SEDIA Part A Section 3."
  },
  {
    "type": "part_b_narrative",
    "label": "Part B — Technical proposal (PDF)",
    "handler": "upload_with_template",
    "required": true,
    "template_url": "https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/temp-form/af/af_he-ria-ia_en.pdf",
    "description": "Excellence, Impact, Implementation (Sections 1–3). The scored technical proposal. Use the EC RIA/IA standard template (PDF) and upload the filled version."
  },
  {
    "type": "ownership_control",
    "label": "Ownership Control Declaration (conditional)",
    "handler": "upload_with_template",
    "required": false,
    "template_url": "https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/common/temp-form/af/ownership-control-declaration_dep-he-edf-cef-dig_en.docx",
    "description": "Required ONLY for calls flagged ''EU strategic autonomy / security-sensitive'' (check your Topic conditions). Download the EC DOCX template, fill it in, sign, and upload."
  },
  {
    "type": "ethics_issues",
    "label": "Ethics issues table — confirm Part A §4 complete",
    "handler": "upload",
    "required": false,
    "template_url": null,
    "description": "No file to upload here. The Ethics Issues Table lives in SEDIA Part A Section 4. Use this row to confirm the checklist has been completed."
  },
  {
    "type": "commitment_letter",
    "label": "Letter of Commitment (associated partners only)",
    "handler": "upload",
    "required": false,
    "template_url": null,
    "description": "Required for associated partners and third-country entities not receiving EU funding. Optional on standard RIA/IA consortia."
  }
]'::jsonb,
    description = 'Horizon Europe consortium proposal template. RIA/IA baseline — add Security annex / Third-country justification manually for flagged calls.',
    updated_at = now()
WHERE name = 'Horizon Europe' AND org_id IS NULL AND is_builtin = TRUE;

-- ─── Generic call ───────────────────────────────────────────────────────────
UPDATE proposal_call_templates
SET default_documents = '[
  {
    "type": "part_a",
    "label": "Part A — Partner profile worksheet",
    "handler": "form",
    "required": true,
    "template_url": null,
    "description": "Administrative and profile information per partner."
  },
  {
    "type": "budget",
    "label": "Budget worksheet",
    "handler": "form",
    "required": true,
    "template_url": null,
    "description": "Per-WP person-months and direct costs."
  },
  {
    "type": "narrative",
    "label": "Proposal narrative (PDF)",
    "handler": "upload",
    "required": true,
    "template_url": null,
    "description": "The primary technical/scientific proposal document."
  },
  {
    "type": "commitment_letter",
    "label": "Letter of Commitment",
    "handler": "upload",
    "required": false,
    "template_url": null,
    "description": "Signed partner commitment letter — required on many calls, optional on others."
  }
]'::jsonb,
    description = 'Minimal starter template — Part A, Budget, narrative, and optional commitment letter. Adapt for any non-EU or internal call.',
    updated_at = now()
WHERE name = 'Generic call' AND org_id IS NULL AND is_builtin = TRUE;

-- ─── Erasmus+ ───────────────────────────────────────────────────────────────
UPDATE proposal_call_templates
SET default_documents = '[
  {
    "type": "part_a",
    "label": "Part A — Partner profile worksheet (OID-based)",
    "handler": "form",
    "required": true,
    "template_url": null,
    "description": "Erasmus+ uses OID (not PIC) as the partner identifier. Record each partner''s OID on the Partners page."
  },
  {
    "type": "budget",
    "label": "Budget worksheet",
    "handler": "form",
    "required": true,
    "template_url": null,
    "description": "Per-WP effort and direct costs."
  },
  {
    "type": "part_b_narrative",
    "label": "Application Form — Part B narrative",
    "handler": "upload",
    "required": true,
    "template_url": null,
    "description": "The scored technical narrative for KA2 / KA220 actions."
  },
  {
    "type": "mandate_letter",
    "label": "Partner mandates (one per partner)",
    "handler": "upload",
    "required": true,
    "template_url": null,
    "description": "KA220 requires a signed mandate from every co-applicant partner authorising the coordinator. Upload a combined PDF or have each partner upload their own."
  },
  {
    "type": "declaration_of_honour",
    "label": "Declaration of Honour (legal representative)",
    "handler": "upload",
    "required": true,
    "template_url": null,
    "description": "Mandatory in every KA220 submission. Signed by each partner''s legal representative."
  }
]'::jsonb,
    description = 'Erasmus+ KA220 proposal template. Uses OID (not PIC); per-partner mandates; Declaration of Honour required.',
    updated_at = now()
WHERE name = 'Erasmus+' AND org_id IS NULL AND is_builtin = TRUE;

-- ─── LIFE Programme ─────────────────────────────────────────────────────────
UPDATE proposal_call_templates
SET default_documents = '[
  {
    "type": "part_a",
    "label": "Part A — Partner profile worksheet",
    "handler": "form",
    "required": true,
    "template_url": null,
    "description": "Administrative and profile information per partner."
  },
  {
    "type": "budget",
    "label": "Budget worksheet (Part A §3 input)",
    "handler": "form",
    "required": true,
    "template_url": null,
    "description": "Per-WP person-months, PM rate, and other direct costs."
  },
  {
    "type": "detailed_budget",
    "label": "Detailed budget table (Annex 2)",
    "handler": "upload",
    "required": true,
    "template_url": null,
    "description": "Structured Excel/PDF budget beyond Part A Section 3. Required per LIFE Call Fiche §5 Admissibility."
  },
  {
    "type": "participant_info",
    "label": "Participant information annex",
    "handler": "upload",
    "required": true,
    "template_url": null,
    "description": "Short profile information for main participants — LIFE does not require full CVs (per 2025 FAQ)."
  },
  {
    "type": "financial_capacity",
    "label": "Financial capacity self-check (conditional)",
    "handler": "upload",
    "required": false,
    "template_url": null,
    "description": "Required when EU contribution exceeds €500,000 per Financial Regulation Art. 198. Upload signed financial statements or a simplified self-check form."
  },
  {
    "type": "commitment_letter",
    "label": "Letter of Commitment",
    "handler": "upload",
    "required": true,
    "template_url": null,
    "description": "Signed partner commitment letter."
  }
]'::jsonb,
    description = 'LIFE (environment & climate) proposal template. Excludes Ownership Control (not a LIFE requirement).',
    updated_at = now()
WHERE name = 'LIFE Programme' AND org_id IS NULL AND is_builtin = TRUE;

COMMIT;

-- ─── Verification ───────────────────────────────────────────────────────────
-- Run these to confirm the corrections landed:
--
--   SELECT name,
--          jsonb_array_length(default_documents) AS doc_count,
--          (SELECT count(*) FROM jsonb_array_elements(default_documents) e
--             WHERE (e->>'required')::bool) AS required_count,
--          updated_at
--   FROM proposal_call_templates
--   WHERE is_builtin = TRUE AND org_id IS NULL
--   ORDER BY name;
--
-- Expected:
--   Erasmus+         5 docs, 5 required
--   Generic call     4 docs, 3 required
--   Horizon Europe   6 docs, 3 required
--   LIFE Programme   6 docs, 5 required
