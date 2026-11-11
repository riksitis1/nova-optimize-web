'use strict';

const { getAction, serializeAction } = require('./actions');

const MINIMAL = ['advertising-id', 'consumer-suggestions', 'windows-tips', 'feedback-prompts'];
const STANDARD = [...MINIMAL, 'activity-feed', 'windows-widgets', 'delivery-optimization'];
const DEBLOAT_IDS = new Set([...STANDARD, 'store-background-policy', 'capture-history', 'telemetry-stutter', 'window-animations']);
const PRESETS = [
  { id: 'minimal', name: 'Minimal', description: 'Reduce Windows suggestions, feedback prompts, and ad personalization.', ids: MINIMAL },
  { id: 'standard', name: 'Standard', description: 'Includes Minimal, plus Activity Feed, Widgets, and update sharing.', ids: STANDARD },
];

function isDebloatAction(id) {
  return DEBLOAT_IDS.has(id);
}

function getDebloatPlan(snapshot, applied) {
  const tweaks = [...DEBLOAT_IDS]
    .map((id) => serializeAction(getAction(id), snapshot, applied))
    .filter((action) => action.applicable || action.appliedByNexa);
  const available = new Set(tweaks.filter((tweak) => tweak.applicable).map((tweak) => tweak.id));
  return {
    tweaks,
    presets: PRESETS.map((preset) => ({ ...preset, ids: preset.ids.filter((id) => available.has(id)) })),
  };
}

module.exports = { getDebloatPlan, isDebloatAction };
