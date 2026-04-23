import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { proposalPartAService, proposalBudgetService, proposalWorkPackageService } from '@/services/proposalWorkflowService'
import type {
  ProposalPartA, ProposalBudget, ProposalWorkPackage,
  PartAContact, PartAResearcher, PartARiAsset,
  PartAAffiliatedEntity, PartAPlannedEvent,
} from '@/types'

/**
 * Read-only renderer for Part A / Budget forms. Surfaced in the
 * coordinator's review panel so they can read what the partner filled in
 * without leaving the matrix view.
 */

interface Props {
  proposalId: string
  partnerId: string
  kind: 'part_a' | 'budget'
}

export function ProposalFormPreview({ proposalId, partnerId, kind }: Props) {
  const [loading, setLoading] = useState(true)
  const [partA, setPartA] = useState<ProposalPartA | null>(null)
  const [budget, setBudget] = useState<ProposalBudget | null>(null)
  const [wps, setWps] = useState<ProposalWorkPackage[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        if (kind === 'part_a') {
          const row = await proposalPartAService.get(proposalId, partnerId)
          if (!cancelled) setPartA(row)
        } else {
          const [b, wpRows] = await Promise.all([
            proposalBudgetService.get(proposalId, partnerId),
            proposalWorkPackageService.list(proposalId),
          ])
          if (!cancelled) {
            setBudget(b)
            setWps(wpRows)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [proposalId, partnerId, kind])

  if (loading) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mx-auto animate-spin" />
      </div>
    )
  }

  if (kind === 'part_a') {
    if (!partA) {
      return <EmptyPreview label="The partner hasn't saved any Part A content yet." />
    }
    return <PartAPreview row={partA} />
  }

  if (!budget) {
    return <EmptyPreview label="The partner hasn't saved any Budget content yet." />
  }
  return <BudgetPreview budget={budget} wps={wps} />
}

// ────────────────────────────────────────────────────────────────────────────
// Part A preview
// ────────────────────────────────────────────────────────────────────────────

function PartAPreview({ row }: { row: ProposalPartA }) {
  return (
    <div className="rounded-lg border bg-muted/10 text-sm divide-y">
      {/* 1.1 */}
      <PreviewBlock title="1.1 Organisation">
        <KV rows={[
          ['Legal name', row.legal_name],
          ['Acronym',    row.acronym],
          ['City',       row.city],
          ['Country',    row.country],
          ['Website',    row.website],
          ['PIC',        row.pic],
          ['Non-profit', row.is_non_profit === null ? null : row.is_non_profit ? 'Yes' : 'No'],
          ['Org type',   row.org_type === 'other' ? row.org_type_other || 'Other' : row.org_type],
        ]} />
      </PreviewBlock>

      {/* 1.2 */}
      {(row.ubo_location || row.ubo_country || row.ubo_notes) && (
        <PreviewBlock title="1.2 UBOs">
          <KV rows={[
            ['Location',  row.ubo_location],
            ['Country',   row.ubo_country],
            ['Notes',     row.ubo_notes],
          ]} />
        </PreviewBlock>
      )}

      {/* 1.3 */}
      {(row.main_contact || (row.other_contacts?.length ?? 0) > 0) && (
        <PreviewBlock title="1.3 Contacts">
          {row.main_contact && (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Main contact</div>
              <ContactLine c={row.main_contact} />
            </div>
          )}
          {(row.other_contacts?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Other contacts</div>
              <ul className="space-y-1">
                {row.other_contacts.map((c, i) => <li key={i}><ContactLine c={c} /></li>)}
              </ul>
            </div>
          )}
        </PreviewBlock>
      )}

      {/* 1.4 */}
      {(row.departments?.length ?? 0) > 0 && (
        <PreviewBlock title="1.4 Departments">
          <TagList items={row.departments} />
        </PreviewBlock>
      )}

      {/* 1.5 */}
      {(row.researchers?.length ?? 0) > 0 && (
        <PreviewBlock title="1.5 Researchers">
          <ul className="space-y-1.5">
            {row.researchers.map((r, i) => <li key={i}><ResearcherLine r={r} /></li>)}
          </ul>
        </PreviewBlock>
      )}

      {/* 1.6 */}
      {(row.roles?.length ?? 0) > 0 && (
        <PreviewBlock title="1.6 Roles in project">
          <TagList items={row.roles} />
        </PreviewBlock>
      )}

      {/* 1.7 */}
      {(row.achievements?.length ?? 0) > 0 && (
        <PreviewBlock title="1.7 Achievements">
          <ul className="space-y-1">
            {row.achievements.map((a, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium capitalize">{a.kind}:</span> {a.description}
              </li>
            ))}
          </ul>
        </PreviewBlock>
      )}

      {/* 1.8 */}
      {(row.previous_projects?.length ?? 0) > 0 && (
        <PreviewBlock title="1.8 Previous projects">
          <ul className="space-y-1">
            {row.previous_projects.map((p, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{p.name}</span>
                {p.description ? ` — ${p.description}` : ''}
              </li>
            ))}
          </ul>
        </PreviewBlock>
      )}

      {/* 1.9 */}
      {(row.infrastructure?.length ?? 0) > 0 && (
        <PreviewBlock title="1.9 Infrastructure">
          <ul className="space-y-1">
            {row.infrastructure.map((inf, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{inf.name}</span>
                {inf.description ? ` — ${inf.description}` : ''}
              </li>
            ))}
          </ul>
        </PreviewBlock>
      )}

      {/* 1.10 */}
      {(row.has_gep !== null || row.gep_notes) && (
        <PreviewBlock title="1.10 Gender Equality Plan">
          <KV rows={[
            ['GEP in place', row.has_gep === null ? null : row.has_gep ? 'Yes' : 'No / in preparation'],
            ['Notes',        row.gep_notes],
          ]} />
        </PreviewBlock>
      )}

      {/* 2 */}
      {(row.pm_rate_amount !== null || (row.other_direct_costs?.length ?? 0) > 0) && (
        <PreviewBlock title="2. Budget details">
          <KV rows={[
            ['PM rate', row.pm_rate_amount !== null ? `${row.pm_rate_amount} ${row.pm_rate_currency ?? 'EUR'}` : null],
          ]} />
          {(row.other_direct_costs?.length ?? 0) > 0 && (
            <ul className="mt-2 space-y-1">
              {row.other_direct_costs.map((c, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium">{c.label}</span>
                  {c.amount !== null ? ` — ${c.amount} ${row.pm_rate_currency ?? 'EUR'}` : ''}
                  {c.justification ? ` · ${c.justification}` : ''}
                </li>
              ))}
            </ul>
          )}
        </PreviewBlock>
      )}

      {/* 3 */}
      {((row.standards_bodies?.length ?? 0) > 0 || (row.ri_assets?.length ?? 0) > 0 || (row.similar_projects?.length ?? 0) > 0) && (
        <PreviewBlock title="3. Standards & R&I assets">
          {(row.standards_bodies?.length ?? 0) > 0 && (
            <div className="mb-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Standards bodies</div>
              <TagList items={row.standards_bodies} />
            </div>
          )}
          {(row.ri_assets?.length ?? 0) > 0 && (
            <div className="mb-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">R&I assets</div>
              <ul className="space-y-1">
                {row.ri_assets.map((a, i) => <li key={i}><AssetLine a={a} /></li>)}
              </ul>
            </div>
          )}
          {(row.similar_projects?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Similar projects</div>
              <TagList items={row.similar_projects} />
            </div>
          )}
        </PreviewBlock>
      )}

      {/* 4 */}
      {(row.dissemination_plan || row.exploitation_plan || (row.planned_events?.length ?? 0) > 0 ||
        row.planned_publications || row.dissemination_bodies || row.standardisation_involvement ||
        row.patents_planned) && (
        <PreviewBlock title="4. Dissemination / Exploitation">
          <KV rows={[
            ['Dissemination',         row.dissemination_plan],
            ['Exploitation',          row.exploitation_plan],
            ['Planned publications',  row.planned_publications],
            ['Bodies',                row.dissemination_bodies],
            ['Standardisation',       row.standardisation_involvement],
            ['Patents / IPR',         row.patents_planned],
          ]} />
          {(row.planned_events?.length ?? 0) > 0 && (
            <div className="mt-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Planned events</div>
              <ul className="space-y-1">
                {row.planned_events.map((ev: PartAPlannedEvent, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium">{ev.kind}:</span> {ev.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PreviewBlock>
      )}

      {/* 5 */}
      {(row.short_profile || row.role_description) && (
        <PreviewBlock title="5. Profile & role">
          <KV rows={[
            ['Short profile', row.short_profile],
            ['Role',          row.role_description],
          ]} />
        </PreviewBlock>
      )}

      {/* 6 */}
      {(row.affiliated_entities?.length ?? 0) > 0 && (
        <PreviewBlock title="6. Affiliated entities">
          <ul className="space-y-1">
            {row.affiliated_entities.map((e: PartAAffiliatedEntity, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{e.legal_name}</span>
                {e.pic ? ` · PIC ${e.pic}` : ''}
              </li>
            ))}
          </ul>
        </PreviewBlock>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Budget preview
// ────────────────────────────────────────────────────────────────────────────

function BudgetPreview({ budget, wps }: { budget: ProposalBudget; wps: ProposalWorkPackage[] }) {
  const currency = budget.pm_rate_currency || 'EUR'
  const rate = budget.pm_rate_amount ?? 0
  const lines = budget.lines ?? []
  const pms = lines.reduce((s, l) => s + (l.person_months || 0), 0)
  const personnel = pms * rate
  const directExSub =
    personnel + budget.budget_travel + budget.budget_equipment + budget.budget_other_goods
  const directAll = directExSub + budget.budget_subcontracting
  let indirectBase = 0
  switch (budget.indirect_cost_base) {
    case 'all_direct':                indirectBase = directAll; break
    case 'personnel_only':            indirectBase = personnel; break
    case 'all_except_subcontracting': indirectBase = directExSub; break
  }
  const indirect = indirectBase * (budget.indirect_cost_rate / 100)
  const total = directAll + indirect
  const funded = total * (budget.funding_rate / 100)

  const wpTitle = (id: string) => {
    const wp = wps.find(w => w.id === id)
    return wp ? `WP${wp.wp_number} — ${wp.title}` : '(Work package deleted)'
  }
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n))

  return (
    <div className="rounded-lg border bg-muted/10 divide-y text-sm">
      <PreviewBlock title="Rate & funding">
        <KV rows={[
          ['PM rate',           rate > 0 ? `${rate} ${currency}` : null],
          ['Funding rate',      `${budget.funding_rate}%`],
          ['Indirect rate',     `${budget.indirect_cost_rate}%`],
          ['Indirect base',     budget.indirect_cost_base.replace(/_/g, ' ')],
        ]} />
      </PreviewBlock>

      <PreviewBlock title="Person-months per WP">
        {lines.length === 0 ? (
          <div className="text-xs text-muted-foreground">No WP effort recorded.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left font-normal py-1">Work package</th>
                  <th className="text-right font-normal">PMs</th>
                  <th className="text-left font-normal pl-3">Role</th></tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.id}>
                  <td className="py-0.5">{wpTitle(l.wp_id)}</td>
                  <td className="text-right tabular-nums">{l.person_months.toFixed(1)}</td>
                  <td className="pl-3 capitalize">{l.partner_role}</td>
                </tr>
              ))}
              <tr className="border-t font-medium">
                <td className="py-1">Total</td>
                <td className="text-right tabular-nums">{pms.toFixed(1)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </PreviewBlock>

      <PreviewBlock title={`Other direct costs (${currency})`}>
        <KV rows={[
          ['Travel',          fmt(budget.budget_travel)],
          ['Subcontracting',  fmt(budget.budget_subcontracting)],
          ['Equipment',       fmt(budget.budget_equipment)],
          ['Other goods',     fmt(budget.budget_other_goods)],
        ]} />
      </PreviewBlock>

      <PreviewBlock title="Totals">
        <KV rows={[
          ['Personnel',      `${fmt(personnel)} ${currency}`],
          ['Direct',         `${fmt(directAll)} ${currency}`],
          ['Indirect',       `${fmt(indirect)} ${currency}`],
          ['Total',          `${fmt(total)} ${currency}`],
          [`Funded (${budget.funding_rate}%)`, `${fmt(funded)} ${currency}`],
        ]} />
      </PreviewBlock>

      {budget.notes && (
        <PreviewBlock title="Notes">
          <p className="text-xs whitespace-pre-wrap">{budget.notes}</p>
        </PreviewBlock>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function EmptyPreview({ label }: { label: string }) {
  return (
    <div className="rounded-lg border bg-muted/10 p-4 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function PreviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {title}
      </div>
      {children}
    </div>
  )
}

function KV({ rows }: { rows: Array<[string, React.ReactNode | null | undefined]> }) {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (visible.length === 0) return null
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-xs">
      {visible.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i, idx) => (
        <span key={idx} className="inline-block rounded-full border px-2 py-0.5 text-[11px]">
          {i}
        </span>
      ))}
    </div>
  )
}

function ContactLine({ c }: { c: PartAContact }) {
  const name = [c.title, c.first_name, c.last_name].filter(Boolean).join(' ')
  const rest: string[] = []
  if (c.position) rest.push(c.position)
  if (c.email)    rest.push(c.email)
  if (c.phone)    rest.push(c.phone)
  return <div className="text-xs">{name || '(unnamed)'} {rest.length > 0 && <span className="text-muted-foreground">· {rest.join(' · ')}</span>}</div>
}

function ResearcherLine({ r }: { r: PartAResearcher }) {
  const name = [r.title, r.first_name, r.last_name].filter(Boolean).join(' ')
  const bits: string[] = []
  if (r.career_stage) bits.push(`R${({ A: 1, B: 2, C: 3, D: 4 } as const)[r.career_stage]}`)
  if (r.role)         bits.push(r.role === 'leading' ? 'Leading' : 'Team member')
  if (r.nationality)  bits.push(r.nationality)
  if (r.email)        bits.push(r.email)
  if (r.orcid)        bits.push(`ORCID ${r.orcid}`)
  return <div className="text-xs">{name} {bits.length > 0 && <span className="text-muted-foreground">· {bits.join(' · ')}</span>}</div>
}

function AssetLine({ a }: { a: PartARiAsset }) {
  const trl = [a.current_trl, a.target_trl].filter(v => typeof v === 'number')
  const bits: string[] = []
  if (trl.length === 2) bits.push(`TRL ${trl[0]}→${trl[1]}`)
  else if (trl.length === 1) bits.push(`TRL ${trl[0]}`)
  if (a.partners)            bits.push(a.partners)
  if (a.reference_projects)  bits.push(a.reference_projects)
  return (
    <div className="text-xs">
      <span className="font-medium">{a.asset_name}</span>
      {bits.length > 0 && <span className="text-muted-foreground"> · {bits.join(' · ')}</span>}
      {a.description && <div className="text-muted-foreground">{a.description}</div>}
    </div>
  )
}

