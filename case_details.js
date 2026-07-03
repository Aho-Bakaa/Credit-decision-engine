// IDBI Underwriting Portal - Case Details File Controller
const BACKEND_URL = "http://127.0.0.1:5000";

let currentCaseId = null;
let isMockCase = false;
let isBackendLive = false;
let originalCalculatedLimit = 0;

document.addEventListener("DOMContentLoaded", () => {
  parseQueryParams();
  checkBackendLiveness();
});

// --- Read case ID from URL params ---
function parseQueryParams() {
  const urlParams = new URLSearchParams(window.location.search);
  currentCaseId = urlParams.get("id");
  isMockCase = urlParams.get("mock") === "true";

  if (!currentCaseId) {
    alert("Invalid case file access. Redirecting to Portfolio...");
    window.location.href = "index.html";
  }

  // Setup generic listeners
  document.getElementById("btn-print").addEventListener("click", () => window.print());
  document.getElementById("btn-escalate").addEventListener("click", () => {
    alert(`File #${currentCaseId} escalated to Senior Credit Committee with active override audits attached.`);
  });
}

// --- Check Liveness & Route Fetching ---
async function checkBackendLiveness() {
  const statusBadge = document.getElementById("backend-status-text");
  try {
    const res = await fetch(`${BACKEND_URL}/api/applications`);
    if (res.ok && !isMockCase) {
      isBackendLive = true;
      statusBadge.textContent = "Secured Session (Connected)";
      statusBadge.parentElement.className = "meta-badge pulse-badge";
      fetchCaseDetails();
    } else {
      setupOfflineFallback();
    }
  } catch (err) {
    setupOfflineFallback();
  }
}

function setupOfflineFallback() {
  isBackendLive = false;
  const statusBadge = document.getElementById("backend-status-text");
  statusBadge.textContent = "Simulation Mode (Offline)";
  statusBadge.parentElement.className = "meta-badge";
  fetchLocalCaseDetails();
}

// --- Fetch Case Details from backend server ---
async function fetchCaseDetails() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/applications/${currentCaseId}`);
    if (res.ok) {
      const data = await res.json();
      originalCalculatedLimit = data.recommended_limit_lakhs;
      
      populateUI(data);
      setupOverrideFormSubmit();
      fetchAuditHistory();
    } else {
      alert("Application file not found. Redirecting to Portfolio...");
      window.location.href = "index.html";
    }
  } catch (err) {
    console.error("Fetch case details error:", err);
    setupOfflineFallback();
  }
}

// --- Fetch Case details from LocalStorage (Offline Simulation) ---
function fetchLocalCaseDetails() {
  const storedData = localStorage.getItem(`simulated_case_${currentCaseId}`);
  
  // If not found in localStorage, search standard mock profiles
  if (!storedData) {
    // Reconstruct preset mapping
    const mocks = {
      "1": {
        id: 1, company_name: "S.R. Textiles", pan: "AAAPW9928M", cibil: 720, cibil_unavailable: true,
        gst_sales: 24.5, upi_receipts: 25.2, aa_deposits: 24.8, growth_trend: 5, employees: 12,
        sources: { gst: true, upi: true, aa: true, epfo: true, utility: false },
        vendor_delays: false, circular_signals: false, created_at: new Date().toISOString()
      },
      "2": {
        id: 2, company_name: "Gopal Retailers Ltd", pan: "BCCPG8837K", cibil: 770, cibil_unavailable: false,
        gst_sales: 7.2, upi_receipts: 7.8, aa_deposits: 7.5, growth_trend: -40, employees: 9,
        sources: { gst: true, upi: true, aa: true, epfo: true, utility: false },
        vendor_delays: true, circular_signals: false, created_at: new Date().toISOString()
      },
      "3": {
        id: 3, company_name: "AgroFarms Innovate", pan: "DDFPS4492A", cibil: 680, cibil_unavailable: false,
        gst_sales: 22.0, upi_receipts: 31.0, aa_deposits: 26.0, growth_trend: 15, employees: 4,
        sources: { gst: true, upi: true, aa: true, epfo: false, utility: true },
        vendor_delays: false, circular_signals: false, created_at: new Date().toISOString()
      },
      "4": {
        id: 4, company_name: "Apex Trading Shell", pan: "EEEPX1002G", cibil: 710, cibil_unavailable: false,
        gst_sales: 14.8, upi_receipts: 1.2, aa_deposits: 14.6, growth_trend: 2, employees: 2,
        sources: { gst: true, upi: true, aa: true, epfo: false, utility: false },
        vendor_delays: false, circular_signals: true, created_at: new Date().toISOString()
      }
    };
    
    if (mocks[currentCaseId]) {
      runLocalUnderwriteSimulation(mocks[currentCaseId]);
    } else {
      alert("Simulated file not found. Redirecting to Portfolio...");
      window.location.href = "index.html";
    }
  } else {
    runLocalUnderwriteSimulation(JSON.parse(storedData));
  }
}

// --- Run Local client-side Underwriting calculations ---
function runLocalUnderwriteSimulation(rawCase) {
  const flows = [];
  if (rawCase.sources.gst) flows.append = rawCase.gst_sales;
  if (rawCase.sources.upi) flows.append = rawCase.upi_receipts;
  if (rawCase.sources.aa) flows.append = rawCase.aa_deposits;
  
  const activeFlows = [
    rawCase.sources.gst ? rawCase.gst_sales : null,
    rawCase.sources.upi ? rawCase.upi_receipts : null,
    rawCase.sources.aa ? rawCase.aa_deposits : null
  ].filter(v => v !== null);
  
  const averageFlow = activeFlows.length > 0 ? (activeFlows.reduce((a,b)=>a+b,0) / activeFlows.length) : 0;

  // Local Replicated calculation parameters
  const agreement = calculateAgreementLocal(activeFlows, rawCase.circular_signals);
  let reliability = Math.round((agreement * 0.6) + ((Object.values(rawCase.sources).filter(Boolean).length / 5) * 40));
  if (rawCase.circular_signals) reliability = Math.max(20, reliability - 25);
  
  let health = 70 + (averageFlow * 0.3);
  if (rawCase.growth_trend > 0) health += Math.min(10, rawCase.growth_trend * 0.2);
  else health += Math.max(-20, rawCase.growth_trend * 0.5);
  if (rawCase.vendor_delays) health -= 18;
  if (rawCase.circular_signals) health -= 30;
  if (!rawCase.cibil_unavailable && rawCase.cibil < 600) health -= 15;
  health = Math.round(Math.min(100, Math.max(0, health)));

  let decision = "REFER";
  let limit = averageFlow * 0.8 * (health/100) * (reliability/100);
  let tier = "Medium Risk";
  let rate = 12.5;
  let terms = "Weekly Escrow / Post-Dated Cheque Collection";

  if (rawCase.circular_signals || health < 40 || reliability < 45) {
    decision = "DECLINE";
    limit = 0;
    tier = "High Risk";
    rate = 0;
    terms = "Not Applicable";
  } else if (health >= 68 && reliability >= 75) {
    decision = "APPROVE";
    tier = health >= 78 ? "Low Risk" : "Low-Medium Risk";
    limit = Math.min(35, Math.max(1.5, limit));
    rate = 10.5 + ((100 - health) * 0.08);
    terms = "Monthly Escrow Account Settlement";
  }

  const response = {
    id: rawCase.id,
    company_name: rawCase.company_name,
    pan: rawCase.pan,
    health_score: health,
    reliability_index: reliability,
    risk_tier: tier,
    probability_of_default: rawCase.circular_signals ? 0.82 : (health >= 70 ? 0.11 : 0.45),
    decision: decision,
    recommended_limit_lakhs: limit,
    interest_rate: rate,
    repayment_terms: terms,
    shap_drivers: [
      { feature: "data_coverage", label: "Registry Data Coverage", impact: 12 },
      { feature: "source_variance", label: "Multi-Source Variance", impact: rawCase.circular_signals ? -38 : 14 }
    ],
    reconciled_values: {
      gst: rawCase.sources.gst ? rawCase.gst_sales : 0,
      upi: rawCase.sources.upi ? rawCase.upi_receipts : 0,
      aa: rawCase.sources.aa ? rawCase.aa_deposits : 0
    },
    bounce_rate: rawCase.bounce_rate || 0,
    customer_concentration: rawCase.customer_concentration || 25,
    gst_delay_days: rawCase.gst_delay_days || 0,
    od_utilization: rawCase.od_utilization || 0,
    adb_ratio: rawCase.adb_ratio || 15,
    created_at: rawCase.created_at
  };

  originalCalculatedLimit = limit;
  populateUI(response);
  setupOverrideFormSubmitLocal();
  renderLocalAuditHistory();
}

function calculateAgreementLocal(vals, circular) {
  if (vals.length < 2) return circular ? 35 : 100;
  const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
  const variance = vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length;
  const stdDev = Math.sqrt(variance);
  const relDev = stdDev / avg;
  let score = Math.max(0, 100 - (relDev * 150));
  if (circular) score = Math.min(score, 35);
  return Math.round(score);
}

// --- Populate Dashboard UI elements ---
function populateUI(data) {
  // Case summary cards
  document.getElementById("case-company-name").textContent = data.company_name;
  document.getElementById("case-pan").textContent = data.pan;
  document.getElementById("case-date").textContent = new Date(data.created_at).toLocaleDateString();
  document.getElementById("case-uid").textContent = `VAL-${data.id}-${data.pan}`;
  
  document.getElementById("case-ai-limit").textContent = `₹${data.recommended_limit_lakhs.toFixed(1)}L`;
  
  // Set default values for override forms
  document.getElementById("override-limit-input").value = data.recommended_limit_lakhs;
  document.getElementById("override-decision-select").value = data.decision;

  // Render gauges
  document.getElementById("text-health").textContent = data.health_score;
  setGaugeOffset(document.getElementById("gauge-health"), data.health_score);
  
  document.getElementById("text-reliability").textContent = `${data.reliability_index}%`;
  setGaugeOffset(document.getElementById("gauge-reliability"), data.reliability_index);

  // Recommendations Details
  document.getElementById("rec-decision").textContent = data.decision;
  
  let decisionClass = "";
  if (data.decision === "REFER") decisionClass = "badge-refer";
  if (data.decision === "DECLINE") decisionClass = "badge-declined";
  document.getElementById("rec-decision").className = `badge ${decisionClass}`;

  document.getElementById("rec-rate").textContent = data.interest_rate > 0 ? `${data.interest_rate.toFixed(1)}% p.a.` : "N/A";
  document.getElementById("rec-terms").textContent = data.repayment_terms;

  // CIBIL calibrations
  const isCibilUnavailable = data.pan.startsWith("AAA");
  document.getElementById("calib-cibil-val").textContent = isCibilUnavailable ? "Unavailable" : domOrVal(isCibilUnavailable, domValOrDefault("input-cibil", 720));
  document.getElementById("calib-cibil-tag").textContent = isCibilUnavailable ? "Credit Invisible" : "Reconciled Profile";
  document.getElementById("calib-cibil-tag").className = `box-tag ${isCibilUnavailable ? 'tag-gray' : 'tag-purple'}`;

  document.getElementById("calib-est-tier").textContent = data.risk_tier;
  document.getElementById("calib-confidence").textContent = `Confidence: ${data.reliability_index}%`;

  // Risk calibration pointer location
  let pointerPosition = 50;
  if (data.risk_tier === "Low Risk") pointerPosition = 15;
  else if (data.risk_tier === "Low-Medium Risk") pointerPosition = 35;
  else if (data.risk_tier === "Medium-High Risk") pointerPosition = 65;
  else pointerPosition = 85;

  document.getElementById("risk-pointer-indicator").style.left = `${pointerPosition}%`;
  
  const bandWidth = Math.max(6, (100 - data.reliability_index) * 0.4);
  document.getElementById("risk-confidence-band").style.left = `${pointerPosition - (bandWidth / 2)}%`;
  document.getElementById("risk-confidence-band").style.width = `${bandWidth}%`;

  // Reconciliation Matrix
  document.getElementById("matrix-gst-val").textContent = data.reconciled_values.gst > 0 ? `₹${data.reconciled_values.gst.toFixed(1)}L` : "No GST Data";
  document.getElementById("matrix-upi-val").textContent = data.reconciled_values.upi > 0 ? `₹${data.reconciled_values.upi.toFixed(1)}L` : "No UPI Data";
  document.getElementById("matrix-aa-val").textContent = data.reconciled_values.aa > 0 ? `₹${data.reconciled_values.aa.toFixed(1)}L` : "No statement Data";

  const totalAgreement = calculateReconciledAgreement(data.reconciled_values);
  document.getElementById("matrix-agreement-val").textContent = `${totalAgreement}% Agreement`;
  document.getElementById("matrix-agreement-bar").style.width = `${totalAgreement}%`;
  document.getElementById("matrix-agreement-bar").className = `progress-bar-fill ${
    totalAgreement >= 85 ? 'fill-emerald' : (totalAgreement >= 60 ? 'fill-indigo' : (totalAgreement >= 45 ? 'fill-amber' : 'fill-red'))
  }`;

  updateMatchBadge(document.getElementById("matrix-gst-status"), totalAgreement, data.reconciled_values.gst > 0);
  updateMatchBadge(document.getElementById("matrix-upi-status"), totalAgreement, data.reconciled_values.upi > 0);
  updateMatchBadge(document.getElementById("matrix-aa-status"), totalAgreement, data.reconciled_values.aa > 0);

  // 5 New Diagnostics Indicators
  const bounces = data.bounce_rate || 0;
  const odUse = data.od_utilization || 0;
  const adbRatio = data.adb_ratio || 0;
  const custConc = data.customer_concentration || 0;
  const gstDelay = data.gst_delay_days || 0;

  document.getElementById("diag-bounces").textContent = `${bounces} bounce${bounces == 1 ? '' : 's'}`;
  document.getElementById("diag-od-use").textContent = `${odUse}%`;
  document.getElementById("diag-adb-ratio").textContent = `${adbRatio}%`;
  document.getElementById("diag-cust-conc").textContent = `${custConc}%`;
  document.getElementById("diag-gst-delay").textContent = `${gstDelay} day${gstDelay == 1 ? '' : 's'} delay`;

  // Color code them based on risk levels
  document.getElementById("diag-bounces").className = bounces > 2 ? "bold-cell color-orange" : (bounces > 0 ? "bold-cell color-warning" : "bold-cell");
  document.getElementById("diag-od-use").className = odUse > 80 ? "bold-cell color-orange" : (odUse > 50 ? "bold-cell color-warning" : "bold-cell");
  document.getElementById("diag-adb-ratio").className = adbRatio < 10 ? "bold-cell color-orange" : (adbRatio < 20 ? "bold-cell color-warning" : "bold-cell");
  document.getElementById("diag-cust-conc").className = custConc > 60 ? "bold-cell color-orange" : (custConc > 40 ? "bold-cell color-warning" : "bold-cell");
  document.getElementById("diag-gst-delay").className = gstDelay > 10 ? "bold-cell color-orange" : (gstDelay > 3 ? "bold-cell color-warning" : "bold-cell");

  // Fraud Assessment
  let fraudLvl = "LOW RISK";
  let fraudDets = "Reconciled registries verify legitimate counterparty payments";
  let fClass = "text-green";
  let sClass = "text-green";
  let sBgClass = "";

  const isCircularFlagged = (data.reliability_index <= 40 && data.recommended_limit_lakhs === 0);
  if (isCircularFlagged) {
    fraudLvl = "HIGH RISK";
    fraudDets = "Invoice loops and related credit flows detected";
    fClass = "text-red";
    sClass = "text-red";
    sBgClass = "bg-red-tint";
    document.getElementById("fraud-card").className = "fraud-card-inline bg-red-tint";
  } else if (totalAgreement < 85) {
    fraudLvl = "MEDIUM RISK";
    fraudDets = "Slight variance detected between GST ledgers and statements";
    fClass = "text-amber";
    sClass = "text-amber";
    sBgClass = "bg-amber-tint";
    document.getElementById("fraud-card").className = "fraud-card-inline bg-amber-tint";
  } else {
    document.getElementById("fraud-card").className = "fraud-card-inline";
  }

  document.getElementById("text-fraud").textContent = fraudLvl;
  document.getElementById("text-fraud").className = `badge ${fraudLvl === "HIGH RISK" ? 'badge-declined' : (fraudLvl === "MEDIUM RISK" ? 'badge-refer' : 'badge-approved')}`;
  document.getElementById("text-fraud-level").textContent = fraudLvl === "HIGH RISK" ? "Circular Trade" : "Verified";
  document.getElementById("text-fraud-details").textContent = fraudDets;
  
  document.getElementById("fraud-icon").setAttribute("class", `shield-icon ${sClass}`);
  document.getElementById("fraud-icon").parentElement.className = `shield-icon-container ${sBgClass}`;

  // Render SHAP waterfall list
  renderShapDriversList(data.shap_drivers);

  // Render dynamic AI Memo Note
  generateNarrativeMemoText(data, totalAgreement, fraudLvl);
}

// Helper: Reconciliation variance
function calculateReconciledAgreement(recVals) {
  const vals = Object.values(recVals).filter(v => v > 0);
  if (vals.length < 2) return 100;
  const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
  const variance = vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length;
  const stdDev = Math.sqrt(variance);
  const relDev = stdDev / avg;
  let score = Math.max(0, 100 - (relDev * 150));
  return Math.round(score);
}

function domOrVal(isCibilUnavailable, val) {
  return isCibilUnavailable ? "Unavailable" : val;
}

function domValOrDefault(id, fallback) {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}

// Helper: Status badge updates
function updateMatchBadge(badgeElement, matchPercent, isSourceActive) {
  if (!isSourceActive) {
    badgeElement.textContent = "Excluded";
    badgeElement.className = "match-badge badge-gray";
    return;
  }
  badgeElement.textContent = `${matchPercent}% Match`;
  badgeElement.className = `match-badge ${
    matchPercent >= 90 ? 'badge-green' : (matchPercent >= 70 ? 'badge-orange' : 'badge-red')
  }`;
}

// --- Render SHAP drivers list ---
function renderShapDriversList(drivers) {
  const list = document.getElementById("shap-drivers-list");
  list.innerHTML = "";
  
  if (!drivers || drivers.length === 0) {
    list.innerHTML = '<p class="empty-state">No drivers calculated.</p>';
    return;
  }

  drivers.forEach(d => {
    const isPositive = d.impact >= 0;
    const absImpact = Math.abs(d.impact);
    const barWidth = Math.min(100, (absImpact / 40) * 100);

    const item = document.createElement("div");
    item.className = `driver-item ${isPositive ? 'positive-driver' : 'negative-driver'}`;
    item.innerHTML = `
      <div class="driver-info">
        <span class="driver-name">${d.label}</span>
        <span class="driver-impact">${isPositive ? '+' : '-'}${absImpact} impact</span>
      </div>
      <div class="driver-bar-wrapper">
        <div class="driver-bar ${isPositive ? 'pos-bar' : 'neg-bar'}" style="width: ${barWidth}%;"></div>
      </div>
    `;
    list.appendChild(item);
  });
}

// --- Generate Underwriter Memo Narrative text ---
function generateNarrativeMemoText(data, agreement, fraud) {
  let text = "";
  const avg = (data.reconciled_values.gst + data.reconciled_values.upi + data.reconciled_values.aa) / 3;

  if (fraud === "HIGH RISK") {
    text = `[CRITICAL ANOMALY DETECTED]\n`;
    text += `Scoring models bypassed. Application DECLINED due to circular invoicing patterns.\n`;
    text += `• Anomaly Analysis: System identifies high-frequency credits matching related accounts, inflating statement volumes by ${100 - agreement}% compared to merchant transactions.\n`;
    text += `• Directives: Immediately stop process. Do not override this limit.`;
  } else if (data.decision === "APPROVE") {
    text = `[UNDERWRITING ASSESSMENT SUMMARY - APPROVED]\n`;
    text += `Business operational health is stable (Score: ${data.health_score}/100) with strong ledger alignment (Agreement: ${agreement}%).\n`;
    if (data.pan.startsWith("AAA")) {
      text += `• Inclusivity Mapping: Credit invisible NTC profile. Average monthly business inflows verified at ₹${avg.toFixed(1)}L via bank accounts with stable payroll indicators.\n`;
      text += `• Risk Calibration: Calibrated at traditional Low-Medium Risk with high reliability (${data.reliability_index}%).\n`;
    } else {
      text += `• Profile: Reconciled transaction data confirms capital solvency.\n`;
    }
    text += `• Recommendation: Authorize credit limit of ₹${data.recommended_limit_lakhs.toFixed(1)} Lakhs at ${data.interest_rate.toFixed(1)}% p.a. with monthly bank escrow rules.`;
  } else if (data.decision === "REFER") {
    text = `[POLICY EXCEPTION LOGGED - REFER TO COMMITTEE]\n`;
    text += `Manual override required. System flags variables sitting outside auto-approval envelopes:\n`;
    if (totalReconciliationVarianceIsHigh(data)) {
      text += `• Registry Mismatch: Discrepancy detected between GST reports and bank deposits.\n`;
    }
    text += `• Recommendation: Cap credit allocation at ₹${data.recommended_limit_lakhs.toFixed(1)} Lakhs under weekly collections covenant.`;
  } else {
    text = `[UNDERWRITING ASSESSMENT SUMMARY - DECLINED]\n`;
    text += `Application declined. Business health is insufficient (Health: ${data.health_score}/100).\n`;
    text += `• Drivers: Operational parameters fall below safety bands.`;
  }

  document.getElementById("text-narrative").textContent = text;
  document.getElementById("audit-trail-info").textContent = `FILE ID ${data.id} | RECONCILED ACCURACY: ${agreement}% | CONFIDENCE BAND: ${data.reliability_index}%`;
  
  // Set final approved limit display (will be updated on overrides)
  document.getElementById("case-approved-limit").textContent = `₹${data.recommended_limit_lakhs.toFixed(1)}L`;
}

function totalReconciliationVarianceIsHigh(data) {
  const vals = [data.reconciled_values.gst, data.reconciled_values.upi, data.reconciled_values.aa].filter(v=>v>0);
  if (vals.length < 2) return false;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  return (max - min) / max > 0.25;
}

// --- Connect SQL Overrides Form submit ---
function setupOverrideFormSubmit() {
  const form = document.getElementById("override-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const payload = {
      underwriter_name: document.getElementById("underwriter-name").value,
      action_taken: document.getElementById("override-decision-select").value,
      approved_limit_lakhs: parseFloat(document.getElementById("override-limit-input").value),
      override_reason: document.getElementById("override-reason-text").value
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/applications/${currentCaseId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("Override successfully recorded in PostgreSQL logs.");
        
        // Update header final approved limit text display
        document.getElementById("case-approved-limit").textContent = `₹${payload.approved_limit_lakhs.toFixed(1)}L`;
        
        // Update decision badge display in card
        document.getElementById("rec-decision").textContent = payload.action_taken;
        let dClass = "";
        if (payload.action_taken === "REFER") dClass = "badge-refer";
        if (payload.action_taken === "DECLINE") dClass = "badge-declined";
        document.getElementById("rec-decision").className = `badge ${dClass}`;
        
        // Reset form inputs
        document.getElementById("override-reason-text").value = "";
        fetchAuditHistory(); // refresh logs
      } else {
        const err = await res.json();
        alert(`Override failed: ${err.detail || "Validation error"}`);
      }
    } catch (err) {
      alert("Database override logging failed.");
    }
  });
}

// --- Fetch Overrides History logs list ---
async function fetchAuditHistory() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/applications/${currentCaseId}/audit`);
    if (res.ok) {
      const audits = await res.json();
      renderAuditLogs(audits);
    }
  } catch (err) {
    console.error("Retrieve audit logs error:", err);
  }
}

function renderAuditLogs(audits) {
  const container = document.getElementById("audit-logs-container");
  container.innerHTML = "";

  if (!audits || audits.length === 0) {
    container.innerHTML = '<p class="empty-state">No adjustments logged in database.</p>';
    return;
  }

  audits.forEach(log => {
    let actionClass = "action-refer";
    if (log.action_taken === "APPROVE") actionClass = "action-approve";
    if (log.action_taken === "DECLINE") actionClass = "action-decline";

    const item = document.createElement("div");
    item.className = "audit-log-item";
    item.innerHTML = `
      <div class="audit-log-header">
        <span class="audit-author">${log.underwriter_name}</span>
        <span class="audit-action ${actionClass}">${log.action_taken}</span>
      </div>
      <div class="audit-diff">
        Limit changed: ₹${log.original_limit_lakhs.toFixed(1)}L ➔ ₹${log.approved_limit_lakhs.toFixed(1)}L
      </div>
      <div class="audit-reason">
        "${log.override_reason}"
      </div>
      <div class="term-footer-txt" style="text-align: right; margin-top: 0.1rem;">
        Logged: ${new Date(log.timestamp).toLocaleString()}
      </div>
    `;
    container.appendChild(item);
  });
}

// --- Local Override form wiring (Offline simulation fallback) ---
function setupOverrideFormSubmitLocal() {
  const form = document.getElementById("override-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const approvedLimit = parseFloat(document.getElementById("override-limit-input").value);
    const action = document.getElementById("override-decision-select").value;
    const author = document.getElementById("underwriter-name").value;
    const reason = document.getElementById("override-reason-text").value;

    const logEntry = {
      id: Math.floor(Math.random() * 100),
      applicant_id: currentCaseId,
      underwriter_name: author,
      action_taken: action,
      original_limit_lakhs: originalCalculatedLimit,
      approved_limit_lakhs: approvedLimit,
      override_reason: reason,
      timestamp: new Date().toISOString()
    };

    // Store log locally in an array inside localStorage
    const localLogs = JSON.parse(localStorage.getItem(`simulated_case_${currentCaseId}_audit`) || "[]");
    localLogs.unshift(logEntry);
    localStorage.setItem(`simulated_case_${currentCaseId}_audit`, JSON.stringify(localLogs));

    alert("Manual override successfully logged in local mockup storage!");
    
    // Update summary labels
    document.getElementById("case-approved-limit").textContent = `₹${approvedLimit.toFixed(1)}L`;
    document.getElementById("rec-decision").textContent = action;
    let dClass = "";
    if (action === "REFER") dClass = "badge-refer";
    if (action === "DECLINE") dClass = "badge-declined";
    document.getElementById("rec-decision").className = `badge ${dClass}`;
    
    document.getElementById("override-reason-text").value = "";
    renderLocalAuditHistory();
  });
}

function renderLocalAuditHistory() {
  const localLogs = JSON.parse(localStorage.getItem(`simulated_case_${currentCaseId}_audit`) || "[]");
  renderAuditLogs(localLogs);
}
