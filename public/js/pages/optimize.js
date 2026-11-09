import {
  state,
  icon,
  escapeHtml,
  toast,
  openModal,
  applyActions,
  undoAction,
  elevate,
  api,
  requestRender,
} from '../core.js';
import {
  scoreRing,
  severityBadge,
  riskBadge,
  impactBadge,
  rebootBadge,
  adminBadge,
  sectionHead,
  emptyState,
  metricRow,
} from '../ui.js';

function categoryBars(scan) {
  return Object.entries(scan.categoryScores || {}).map(([category, score]) => `
    <div style="display:flex;align-items:center;gap:10px;margin-top:7px">
      <span class="small muted" style="width:86px">${escapeHtml(category)}</span>
      <div class="meter" style="flex:1"><span style="width:${score}%;background:${score >= 85 ? 'var(--lime)' : score >= 65 ? 'var(--amber)' : 'var(--red)'}"></span></div>
      <span class="mono" style="width:28px;text-align:right">${score}</span>
    </div>`).join('');
}

function summaryCard(scan, mode, actionPool = []) {
  const issueCount = scan.counts.issues;
  const issueText = `${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}`;
  return `
    <div class="card card-pad optimize-hero">
      <div class="optimize-hero-grid">
        <div class="optimize-hero-left">
          <div class="hero-score">${scoreRing(scan.score, scan.potentialScore, 144)}</div>
          <div class="optimize-hero-meta">
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:7px">
              <span class="badge lime">${icon('spark')} ${escapeHtml(scan.rank)}</span>
              <span class="badge muted">${issueText}</span>
              <span class="badge muted">${scan.counts.optimized} already optimized</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">
              <button class="button button-primary" type="button" data-action="apply-safe">${icon('zap')} Apply safe fixes</button>
              <button class="button" type="button" data-action="restore-point">${icon('shield')} Create restore point</button>
            </div>
          </div>
        </div>
        <div class="optimize-hero-right">
          <p class="muted" style="margin:0 0 12px;font-size:12px;line-height:1.5">${escapeHtml(scan.summary)}</p>
          <div class="category-bars-wrap">
            ${categoryBars(scan)}
          </div>
        </div>
      </div>
    </div>`;
}

function actionCard(action) {
  const locked = action.requiresAdmin && !state.snapshot?.admin;
  return `
    <article class="action-card ${action.appliedByNexa ? 'is-applied' : action.optimized ? 'is-optimized' : ''}">
      <div class="action-top">
        <h3>${escapeHtml(action.name)}</h3>
        ${action.risk === 'advanced' ? '<span class="badge advanced">Advanced</span>' : action.risk === 'caution' ? '<span class="badge amber">Caution</span>' : '<span class="badge green">Safe</span>'}
      </div>
      <p class="action-desc">${escapeHtml(action.description)}</p>
      ${action.risk !== 'safe' && action.note ? `<p class="action-note">${escapeHtml(action.note)}</p>` : ''}
      ${action.currentValue ? `<div class="action-current"><span>Current</span><strong class="mono">${escapeHtml(action.currentValue)}</strong></div>` : ''}
      <div class="action-foot">
        <span class="badge muted">${escapeHtml(action.category)}</span>
        ${impactBadge(action.impact)}
        ${action.requiresReboot ? rebootBadge() : ''}
        ${action.requiresAdmin ? adminBadge() : ''}
        ${action.appliedByNexa
          ? `<button class="button button-small" style="margin-left:auto" type="button" data-undo-action="${escapeHtml(action.id)}">${icon('undo')} Undo</button>`
          : action.optimized
            ? '<span class="action-status">' + icon('check') + ' Active</span>'
            : `<button class="button button-small ${locked ? '' : 'button-primary'}" style="margin-left:auto" type="button" data-apply-action="${escapeHtml(action.id)}">${locked ? icon('lock') + ' Admin' : icon('zap') + ' Apply'}</button>`}
      </div>
    </article>`;
}

function findingCard(finding) {
  return `
    <div class="finding">
      <div class="finding-sev ${escapeHtml(finding.severity)}">${icon(finding.severity === 'high' ? 'alert' : finding.severity === 'info' ? 'info' : 'zap')}</div>
      <div class="finding-body">
        <h3 class="finding-title">${escapeHtml(finding.title)} ${severityBadge(finding.severity)}</h3>
        <p class="finding-desc">${escapeHtml(finding.description)}</p>
        ${finding.detail ? `<p class="finding-detail">${escapeHtml(finding.detail)}</p>` : ''}
      </div>
      <div class="finding-side">
        ${finding.page ? `<button class="button button-small" type="button" data-nav="${escapeHtml(finding.page)}">${icon('arrow')} Review</button>` : ''}
        ${finding.link ? `<a class="button button-small" href="${escapeHtml(finding.link)}" target="_blank" rel="noreferrer">${icon('external')} ${escapeHtml(finding.linkLabel || 'Open')}</a>` : ''}
      </div>
    </div>`;
}

function appliedSection(scan) {
  const applied = scan.actions.filter((action) => action.appliedByNexa);
  if (!applied.length) return '';
  return `
    ${sectionHead('Applied by Nexa', 'Backed up and reversible. Undo one at a time or from the Activity page.')}
    <div class="card card-pad">
      <div class="chip-row">${applied.map((action) => `<span class="badge lime">${icon('check')} ${escapeHtml(action.name)}</span>`).join('')}</div>
      <p class="small muted" style="margin:12px 0 0">Some changes need a restart to fully revert.</p>
    </div>`;
}

export function renderOptimize(mode = 'safe') {
  if (!state.scan) {
    return '<div class="page-loading"><div class="loading-orbit"></div><p>Scanning settings…</p></div>';
  }
  const scan = state.scan;
  const actionPool = scan.actions.filter((action) => action.applicable && (mode === 'advanced' ? action.risk === 'advanced' : action.risk !== 'advanced'));
  const safePool = actionPool.filter((action) => action.risk === 'safe');
  const cautionPool = actionPool.filter((action) => action.risk === 'caution');
  const safeReady = safePool.filter((action) => !action.optimized && !action.appliedByNexa);
  const cautionReady = cautionPool.filter((action) => !action.optimized && !action.appliedByNexa);
  const findings = scan.findings.filter((finding) => !finding.actionId);
  const primaryFindings = findings.filter((finding) => finding.severity !== 'info');
  const infoFindings = findings.filter((finding) => finding.severity === 'info');

  if (mode === 'advanced') {
    return `
      <div class="callout warn">${icon('alert')}<div><strong>Low-level Windows parameters.</strong> These settings modify kernel scheduling, input, and TCP behavior and are excluded from your main readiness score. Apply one change at a time and revert any setting that does not improve your workload.</div></div>
      ${sectionHead('Advanced controls', 'Low-level scheduling, input, and TCP stack parameters.', `<span class="badge muted">${actionPool.length} controls</span>`)}
      ${actionPool.length ? `<div class="action-grid">${actionPool.map((action) => actionCard(action)).join('')}</div>` : emptyState('check', 'Nothing to apply here', 'Every available setting in this section is already in the recommended state.')}
      ${appliedSection(scan)}
    `;
  }

  return `
    ${summaryCard(scan, mode, actionPool)}
    ${sectionHead('Safe optimizations', 'Recommended, reversible changes with no side effects for normal use.', `<span class="badge muted">${safeReady.length} ready</span>`)}
    ${safePool.length ? `<div class="action-grid">${safePool.map((action) => actionCard(action)).join('')}</div>` : emptyState('check', 'Nothing to apply here', 'Every safe setting is already in the recommended state.')}
    ${cautionPool.length ? `
      ${sectionHead('Situational optimizations', 'Hardware-dependent settings. Review the notes below before enabling; these are excluded from "Apply safe fixes".', `<span class="badge amber">${cautionReady.length} review</span>`)}
      <div class="action-grid">${cautionPool.map((action) => actionCard(action)).join('')}</div>
    ` : ''}
    ${primaryFindings.length ? `${sectionHead('System advisories', 'Hardware or OS conditions that require manual review.')}<div>${primaryFindings.map(findingCard).join('')}</div>` : ''}
    ${infoFindings.length ? `${sectionHead('Hardware & OS notes', 'Informational system status.')}<div>${infoFindings.map(findingCard).join('')}</div>` : ''}
    ${appliedSection(scan)}
    <p class="small muted" style="margin-top:24px;line-height:1.6">Every applied setting is backed up to your local state file before modification. Windows updates, GPU drivers, and BIOS settings are never modified automatically.</p>
  `;
}

async function confirmApplyOne(id) {
  const action = state.scan?.actions?.find((item) => item.id === id);
  if (!action) return;
  if (action.requiresAdmin && !state.snapshot?.admin) {
    openModal({
      title: 'Administrator access needed',
      body: `<p>${escapeHtml(action.name)} changes a system-wide setting. Restart Nexa with administrator rights to apply it.</p>`,
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
    return;
  }
  if (action.risk === 'safe') {
    try {
      const response = await applyActions([id]);
      const failed = (response.results || []).find((result) => !result.ok);
      if (failed) throw new Error(failed.error || 'Could not apply change.');
      toast('success', 'Applied', action.name);
    } catch (error) {
      toast('error', 'Could not apply change', error.message);
    }
    return;
  }
  openModal({
    title: action.name,
    body: `<p>${escapeHtml(action.description)}</p><ul class="modal-list"><li>${escapeHtml(action.note)}</li><li>Nexa records a backup first.</li>${action.requiresReboot ? '<li>A reboot is required for this change.</li>' : ''}</ul>`,
    confirmLabel: 'Apply change',
    danger: true,
    onConfirm: async () => {
      const response = await applyActions([id]);
      const failed = (response.results || []).find((result) => !result.ok);
      if (failed) throw new Error(failed.error || 'The change could not be applied.');
      toast('success', 'Change applied', action.name);
    },
  });
}

async function confirmUndo(id) {
  const action = state.scan?.actions?.find((item) => item.id === id);
  if (!action) return;
  try {
    await undoAction(id);
    toast('success', 'Restored original setting', action.name);
  } catch (error) {
    toast('error', 'Could not undo change', error.message);
  }
}

export async function applySafe() {
  const candidates = (state.scan?.actions || []).filter(
    (action) => action.applicable && action.risk === 'safe' && !action.optimized && !action.appliedByNexa,
  );
  if (!candidates.length) {
    toast('info', 'Nothing to apply', 'Every safe optimization is already active.');
    return;
  }
  const blocked = !state.snapshot?.admin ? candidates.filter((action) => action.requiresAdmin) : [];
  const available = candidates.filter((action) => !blocked.includes(action));

  if (!state.snapshot?.admin && blocked.length > 0) {
    openModal({
      title: 'Administrator Rights Needed for Full Optimization',
      body: `
        <p>Windows requires Administrator rights to configure low-latency network throttling, multimedia scheduling, and high-performance power plans.</p>
        <ul class="modal-list">
          <li><strong>${blocked.length} system optimizations</strong> need Administrator rights to reach <strong>95–100/100</strong>.</li>
          <li>${available.length ? `Only ${available.length} user settings can be applied without administrator rights (Score: ~70–75).` : 'All remaining optimizations require Administrator rights.'}</li>
        </ul>
        <p class="small muted" style="margin-top:12px">Click below to approve the Windows prompt and restart Nexa as Administrator.</p>
      `,
      confirmLabel: 'Restart as Administrator (Recommended)',
      cancelLabel: available.length ? 'Apply Standard Fixes Only' : 'Cancel',
      danger: false,
      onConfirm: elevate,
      onCancel: available.length
        ? async () => {
            try {
              const response = await applyActions(available.map((action) => action.id));
              const failed = (response.results || []).filter((result) => !result.ok);
              if (failed.length) {
                toast('warn', 'Some changes were skipped', failed.map((result) => result.error).join(' · '));
              } else {
                toast('success', 'Safe fixes applied', `${available.length} settings updated. Restart as admin for full 95+ score.`);
              }
            } catch (error) {
              toast('error', 'Could not apply safe fixes', error.message);
            }
          }
        : null,
    });
    return;
  }

  if (!available.length) {
    openModal({
      title: 'Administrator access needed',
      body: '<p>The remaining safe fixes change system-wide settings. Restart Nexa with administrator rights to continue.</p>',
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
    return;
  }
  try {
    const response = await applyActions(available.map((action) => action.id));
    const failed = (response.results || []).filter((result) => !result.ok);
    if (failed.length) {
      toast('warn', 'Some changes were skipped', failed.map((result) => result.error).join(' · '));
    } else {
      toast('success', 'Safe fixes applied', `${available.length} settings updated.`);
    }
  } catch (error) {
    toast('error', 'Could not apply safe fixes', error.message);
  }
}

function createRestorePoint(button) {
  if (!state.snapshot?.admin) {
    openModal({
      title: 'Administrator access needed',
      body: '<p>Creating a Windows restore point requires administrator rights.</p>',
      confirmLabel: 'Restart as administrator',
      onConfirm: elevate,
    });
    return;
  }
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon('refresh')} Creating…`;
  }
  api('/api/restore-point', { method: 'POST', body: {} })
    .then(() => toast('success', 'Restore point created', 'Windows System Restore can now roll back system changes.'))
    .catch((error) => toast('error', 'Could not create restore point', error.message))
    .finally(() => {
      if (button) {
        button.disabled = false;
        button.innerHTML = `${icon('shield')} Create restore point`;
      }
    });
}

export function bindOptimize() {
  document.querySelectorAll('[data-apply-action]').forEach((button) => {
    button.addEventListener('click', () => confirmApplyOne(button.getAttribute('data-apply-action')));
  });
  document.querySelectorAll('[data-undo-action]').forEach((button) => {
    button.addEventListener('click', () => confirmUndo(button.getAttribute('data-undo-action')));
  });
  document.querySelectorAll('[data-action="apply-safe"]').forEach((button) => {
    button.addEventListener('click', applySafe);
  });
  document.querySelectorAll('[data-action="restore-point"]').forEach((button) => {
    button.addEventListener('click', () => createRestorePoint(button));
  });
}
