// Valkyrie Credit Decision Engine - Frontend Controller
const BACKEND_URL = "http://127.0.0.1:5000";

// --- Case Study Presets (Frontend inputs) ---
const PRESETS = {
  invisible: {
    company_name: "S.R. Textiles",
    pan: "AAAPW9928M",
    cibil: 720,
    cibilUnavailable: true,
    gstSales: 24.5,
    upiReceipts: 25.2,
    aaDeposits: 24.8,
    growth: 5,
    employees: 12,
    vendorDelays: false,
    circularSignals: false,
    sources: { gst: true, upi: true, aa: true, epfo: true, utility: false },
    auditTrail: "Case Weaver-783. Verified against GSTIN: 27AAAAA1111A1Z3 & UPI: merchant@idbi."
  },
  silent: {
    company_name: "Gopal Retailers Ltd",
    pan: "BCCPG8837K",
    cibil: 770,
    cibilUnavailable: false,
    gstSales: 7.2,
    upiReceipts: 7.8,
    aaDeposits: 7.5,
    growth: -40,
    employees: 9,
    vendorDelays: true,
    circularSignals: false,
    sources: { gst: true, upi: true, aa: true, epfo: true, utility: false },
    auditTrail: "Case Retail-402. Warning: 3-month operational volume contraction flagged."
  },
  volatile: {
    company_name: "AgroFarms Innovate",
    pan: "DDFPS4492A",
    cibil: 680,
    cibilUnavailable: false,
    gstSales: 22.0,
    upiReceipts: 31.0,
    aaDeposits: 26.0,
    growth: 15,
    employees: 4,
    vendorDelays: false,
    circularSignals: false,
    sources: { gst: true, upi: true, aa: true, epfo: false, utility: true },
    auditTrail: "Case Agtech-991. High variance between GST and merchant UPI receipts."
  },
  fraud: {
    company_name: "Apex Trading Shell",
    pan: "EEEPX1002G",
    cibil: 710,
    cibilUnavailable: false,
    gstSales: 14.8,
    upiReceipts: 1.2,
    aaDeposits: 14.6,
    growth: 2,
    employees: 2,
    vendorDelays: false,
    circularSignals: true,
    sources: { gst: true, upi: true, aa: true, epfo: false, utility: false },
    auditTrail: "Case Paper-009. CRITICAL: Transaction topology flags circular credit loop."
  }
};

// --- Application State Variables ---
let currentApplicationId = null;
let currentRecommendedLimit = 0;
let isBackendLive = false;
let updateDebounceTimeout = null;

// --- DOM References ---
const dom = {
  // Preset Controls
  presetBtns: document.querySelectorAll(".preset-btn"),
  btnReset: document.getElementById("reset-parameters"),
  backendStatusText: document.getElementById("backend-status-text"),

  // Sandbox sliders & text fields
  companyNameInput: document.getElementById("company-name-input"),
  panInput: document.getElementById("pan-input"),
  inputCibil: document.getElementById("input-cibil"),
  cibilUnavailable: document.getElementById("cibil-unavailable"),
  valCibil: document.getElementById("val-cibil"),
  
  sourceGst: document.getElementById("source-gst"),
  sourceUpi: document.getElementById("source-upi"),
  sourceAa: document.getElementById("source-aa"),
  sourceEpfo: document.getElementById("source-epfo"),
  sourceUtility: document.getElementById("source-utility"),

  inputGstVal: document.getElementById("input-gst-val"),
  valGst: document.getElementById("val-gst"),
  inputUpiVal: document.getElementById("input-upi-val"),
  valUpi: document.getElementById("val-upi"),
  inputAaVal: document.getElementById("input-aa-val"),
  valAa: document.getElementById("val-aa"),

  inputRevenueGrowth: document.getElementById("input-revenue-growth"),
  valGrowth: document.getElementById("val-growth"),
  inputEmployees: document.getElementById("input-employees"),
  valEmployees: document.getElementById("val-employees"),
  vendorDelays: document.getElementById("vendor-delays"),
  circularSignals: document.getElementById("circular-signals"),

  // Output summary gauges
  gaugeHealth: document.getElementById("gauge-health"),
  textHealth: document.getElementById("text-health"),
  gaugeReliability: document.getElementById("gauge-reliability"),
  textReliability: document.getElementById("text-reliability"),

  // Credit recommendation
  recDecision: document.getElementById("rec-decision"),
  recLimit: document.getElementById("rec-limit"),
  recRate: document.getElementById("rec-rate"),
  recTenure: document.getElementById("rec-tenure"),

  // CIBIL calibration scale
  calibCibilVal: document.getElementById("calib-cibil-val"),
  calibCibilTag: document.getElementById("calib-cibil-tag"),
  calibEstTier: document.getElementById("calib-est-tier"),
  calibConfidence: document.getElementById("calib-confidence"),
  riskPointer: document.getElementById("risk-pointer-indicator"),
  riskConfidenceBand: document.getElementById("risk-confidence-band"),
  calibExplanationText: document.getElementById("calib-explanation-text"),

  // Verification Matrix
  matrixGstVal: document.getElementById("matrix-gst-val"),
  matrixGstStatus: document.getElementById("matrix-gst-status"),
  matrixUpiVal: document.getElementById("matrix-upi-val"),
  matrixUpiStatus: document.getElementById("matrix-upi-status"),
  matrixAaVal: document.getElementById("matrix-aa-val"),
  matrixAaStatus: document.getElementById("matrix-aa-status"),
  matrixAgreementVal: document.getElementById("matrix-agreement-val"),
  matrixAgreementBar: document.getElementById("matrix-agreement-bar"),
  fraudCard: document.getElementById("fraud-card"),
  fraudIcon: document.getElementById("fraud-icon"),
  textFraud: document.getElementById("text-fraud"),
  textFraudDetails: document.getElementById("text-fraud-details"),

  // Explainability Renders
  shapDriversList: document.getElementById("shap-drivers-list"),
  textNarrative: document.getElementById("text-narrative"),
  auditTrailInfo: document.getElementById("audit-trail-info"),

  // Underwriter manual override console
  overrideForm: document.getElementById("override-form"),
  underwriterNameInput: document.getElementById("underwriter-name"),
  overrideDecisionSelect: document.getElementById("override-decision-select"),
  overrideLimitInput: document.getElementById("override-limit-input"),
  overrideReasonText: document.getElementById("override-reason-text"),
  auditLogsContainer: document.getElementById("audit-logs-container"),

  // Generic control targets
  btnEscalate: document.getElementById("btn-escalate"),
  btnApprove: document.getElementById("btn-approve")
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupEventListeners();
  checkBackendLiveness();
  loadPreset(PRESETS.invisible);
});

// --- Tab Setup ---
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // Toggle Tab buttons
      tabs.forEach(btn => btn.classList.remove("active"));
      tab.classList.add("active");

      // Toggle Content displays
      const targetId = tab.dataset.tab;
      document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.remove("active-content");
      });
      document.getElementById(targetId).classList.add("active-content");
    });
  });
}

// --- Setup Event Listeners ---
function setupEventListeners() {
  // Preset Clicks
  dom.presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      dom.presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.preset;
      loadPreset(PRESETS[key]);
    });
  });

  // Reset Parameter trigger
  dom.btnReset.addEventListener("click", () => {
    const activePreset = document.querySelector(".preset-btn.active").dataset.preset;
    loadPreset(PRESETS[activePreset]);
  });

  // Check CIBIL toggle
  dom.cibilUnavailable.addEventListener("change", (e) => {
    dom.inputCibil.disabled = e.target.checked;
    dom.valCibil.style.opacity = e.target.checked ? "0.4" : "1";
    triggerCalculation();
  });

  // Sliders value feedback displays
  dom.inputCibil.addEventListener("input", (e) => {
    dom.valCibil.textContent = e.target.value;
    triggerCalculation();
  });
  dom.inputGstVal.addEventListener("input", (e) => {
    dom.valGst.textContent = `₹${parseFloat(e.target.value).toFixed(1)}L`;
    triggerCalculation();
  });
  dom.inputUpiVal.addEventListener("input", (e) => {
    dom.valUpi.textContent = `₹${parseFloat(e.target.value).toFixed(1)}L`;
    triggerCalculation();
  });
  dom.inputAaVal.addEventListener("input", (e) => {
    dom.valAa.textContent = `₹${parseFloat(e.target.value).toFixed(1)}L`;
    triggerCalculation();
  });
  dom.inputRevenueGrowth.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    dom.valGrowth.textContent = (val >= 0 ? "+" : "") + val + "%";
    triggerCalculation();
  });
  dom.inputEmployees.addEventListener("input", (e) => {
    dom.valEmployees.textContent = `${e.target.value} staff`;
    triggerCalculation();
  });

  // Checkboxes & Flag changes
  const checkBoxes = [
    dom.sourceGst, dom.sourceUpi, dom.sourceAa, dom.sourceEpfo, dom.sourceUtility,
    dom.vendorDelays, dom.circularSignals, dom.companyNameInput, dom.panInput
  ];
  checkBoxes.forEach(input => {
    input.addEventListener("input", triggerCalculation);
    input.addEventListener("change", triggerCalculation);
  });

  // Manual Override Form submit
  dom.overrideForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitManualOverride();
  });

  // Underwriting Action Buttons
  dom.btnApprove.addEventListener("click", () => {
    if (!currentApplicationId) {
      alert("No active application processed yet. Adjust parameters first.");
      return;
    }
    alert(`AI Audit Approved!\nOpening standard print utility to file credit assessment logs.`);
    window.print();
  });

  dom.btnEscalate.addEventListener("click", () => {
    alert("Application escalated to Senior Credit Risk Committee.");
  });
}

// --- Check Backend Connection status ---
async function checkBackendLiveness() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/applications`);
    if (res.ok) {
      isBackendLive = true;
      dom.backendStatusText.textContent = "LIVE BACKEND (DB ACTIVE)";
      dom.backendStatusText.parentElement.className = "meta-badge pulse-badge";
      triggerCalculation();
    }
  } catch (err) {
    isBackendLive = false;
    dom.backendStatusText.textContent = "OFFLINE: RUNNING LOCAL SIMULATION";
    dom.backendStatusText.parentElement.className = "meta-badge";
    triggerLocalCalculation(); // Fallback simulation
  }
}

// --- Load Preset Value states ---
function loadPreset(preset) {
  dom.companyNameInput.value = preset.company_name;
  dom.panInput.value = preset.pan;
  
  dom.cibilUnavailable.checked = preset.cibilUnavailable;
  dom.inputCibil.value = preset.cibil;
  dom.inputCibil.disabled = preset.cibilUnavailable;
  dom.valCibil.textContent = preset.cibil;
  dom.valCibil.style.opacity = preset.cibilUnavailable ? "0.4" : "1";

  dom.sourceGst.checked = preset.sources.gst;
  dom.sourceUpi.checked = preset.sources.upi;
  dom.sourceAa.checked = preset.sources.aa;
  dom.sourceEpfo.checked = preset.sources.epfo;
  dom.sourceUtility.checked = preset.sources.utility;

  dom.inputGstVal.value = preset.gstSales;
  dom.valGst.textContent = `₹${preset.gstSales.toFixed(1)}L`;
  dom.inputUpiVal.value = preset.upiReceipts;
  dom.valUpi.textContent = `₹${preset.upiReceipts.toFixed(1)}L`;
  dom.inputAaVal.value = preset.aaDeposits;
  dom.valAa.textContent = `₹${preset.aaDeposits.toFixed(1)}L`;

  dom.inputRevenueGrowth.value = preset.growth;
  dom.valGrowth.textContent = (preset.growth >= 0 ? "+" : "") + preset.growth + "%";
  dom.inputEmployees.value = preset.employees;
  dom.valEmployees.textContent = `${preset.employees} staff`;

  dom.vendorDelays.checked = preset.vendorDelays;
  dom.circularSignals.checked = preset.circularSignals;

  dom.auditTrailInfo.textContent = preset.auditTrail || "Custom workspace configuration";

  triggerCalculation();
}

// --- Debounce endpoint calculator ---
function triggerCalculation() {
  clearTimeout(updateDebounceTimeout);
  
  if (!isBackendLive) {
    // If backend is offline, run calculations locally on frontend (Fallback simulation)
    triggerLocalCalculation();
    return;
  }

  // Debounce API calls (fires 200ms after slider dragging stops)
  updateDebounceTimeout = setTimeout(fetchUnderwritingResults, 200);
}

// --- API Request to FastAPI Backend ---
async function fetchUnderwritingResults() {
  const payload = {
    company_name: dom.companyNameInput.value,
    pan: dom.panInput.value,
    gstin: "12AAAAA1111A1Z1",
    cibil: parseInt(dom.inputCibil.value),
    cibil_unavailable: dom.cibilUnavailable.checked,
    gst_sales: parseFloat(dom.inputGstVal.value),
    upi_receipts: parseFloat(dom.inputUpiVal.value),
    aa_deposits: parseFloat(dom.inputAaVal.value),
    growth_trend: parseFloat(dom.inputRevenueGrowth.value),
    employees: parseInt(dom.inputEmployees.value),
    sources: {
      gst: dom.sourceGst.checked,
      upi: dom.sourceUpi.checked,
      aa: dom.sourceAa.checked,
      epfo: dom.sourceEpfo.checked,
      utility: dom.sourceUtility.checked
    },
    vendor_delays: dom.vendorDelays.checked,
    circular_signals: dom.circularSignals.checked
  };

  try {
    const res = await fetch(`${BACKEND_URL}/api/underwrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      currentApplicationId = data.id;
      currentRecommendedLimit = data.recommended_limit_lakhs;
      
      updateUI(data);
      fetchAuditHistory(); // refresh overrides list for this file
    }
  } catch (err) {
    console.error("API Call error:", err);
    isBackendLive = false;
    dom.backendStatusText.textContent = "OFFLINE: LOCAL SIMULATION RUNNING";
    dom.backendStatusText.parentElement.className = "meta-badge";
    triggerLocalCalculation();
  }
}

// --- Update UI with API response ---
function updateUI(data) {
  // 1. Health Score Gauge
  dom.textHealth.textContent = data.health_score;
  setGaugeOffset(dom.gaugeHealth, data.health_score);

  // 2. Reliability Index Gauge
  dom.textReliability.textContent = `${data.reliability_index}%`;
  setGaugeOffset(dom.gaugeReliability, data.reliability_index);

  // 3. Dynamic Credit Recommendation
  dom.recDecision.textContent = data.decision;
  
  let decisionClass = "";
  if (data.decision === "REFER") decisionClass = "badge-refer";
  if (data.decision === "DECLINE") decisionClass = "badge-decline";
  dom.recDecision.className = `rec-badge ${decisionClass}`;

  dom.recLimit.textContent = data.recommended_limit_lakhs > 0 ? `₹${data.recommended_limit_lakhs.toFixed(1)} Lakhs` : "₹0";
  dom.recRate.textContent = data.interest_rate > 0 ? `${data.interest_rate.toFixed(1)}% p.a.` : "N/A";
  dom.recTenure.textContent = data.repayment_terms;

  // Initialize values in manual overrides console form
  dom.overrideDecisionSelect.value = data.decision;
  dom.overrideLimitInput.value = data.recommended_limit_lakhs;

  // 4. CIBIL Calibration risk mapping
  dom.calibCibilVal.textContent = data.pan.startsWith("AAA") ? "Unavailable" : dom.inputCibil.value;
  dom.calibCibilTag.textContent = data.pan.startsWith("AAA") ? "Credit Invisible" : (dom.inputCibil.value >= 750 ? "Excellent Bureau" : "Fair Bureau");
  dom.calibCibilTag.className = `box-tag ${data.pan.startsWith("AAA") ? 'tag-gray' : 'tag-purple'}`;

  dom.calibEstTier.textContent = data.risk_tier;
  dom.calibConfidence.textContent = `Confidence: ${data.reliability_index}%`;

  // Scale position along Risk bar
  let pointerPosition = 50;
  if (data.risk_tier === "Low Risk") pointerPosition = 15;
  else if (data.risk_tier === "Low-Medium Risk") pointerPosition = 35;
  else if (data.risk_tier === "Medium-High Risk") pointerPosition = 65;
  else pointerPosition = 85;

  dom.riskPointer.style.left = `${pointerPosition}%`;
  
  const bandWidth = Math.max(6, (100 - data.reliability_index) * 0.4);
  dom.riskConfidenceBand.style.left = `${pointerPosition - (bandWidth / 2)}%`;
  dom.riskConfidenceBand.style.width = `${bandWidth}%`;

  // Dynamic explanation text
  if (data.pan.startsWith("AAA")) {
    dom.calibExplanationText.innerHTML = `Without bureau files, the logistic engine maps alternative GST/UPI parameters to a credit-equivalent <strong>${data.risk_tier}</strong> rating (Confidence: ${data.reliability_index}%).`;
  } else {
    const isMismatched = (parseInt(dom.inputCibil.value) >= 750 && data.health_score < 55);
    if (isMismatched) {
      dom.calibExplanationText.innerHTML = `<strong>EARLY WARNING TRIGGERED:</strong> High bureau score overlay overridden by declining real-time cash flow. Risk level calibrated at <strong>${data.risk_tier}</strong>.`;
    } else {
      dom.calibExplanationText.innerHTML = `Bureau and Alternative transaction data aligned. Risk calibrated at <strong>${data.risk_tier}</strong>.`;
    }
  }

  // 5. Verification Matrix table
  dom.matrixGstVal.textContent = data.reconciled_values.gst > 0 ? `₹${data.reconciled_values.gst.toFixed(1)}L` : "No GST Data";
  dom.matrixUpiVal.textContent = data.reconciled_values.upi > 0 ? `₹${data.reconciled_values.upi.toFixed(1)}L` : "No UPI Data";
  dom.matrixAaVal.textContent = data.reconciled_values.aa > 0 ? `₹${data.reconciled_values.aa.toFixed(1)}L` : "No AA Data";

  const totalAgreement = calculateReconciledAgreement(data.reconciled_values);
  dom.matrixAgreementVal.textContent = `${totalAgreement}% Agreement`;
  dom.matrixAgreementBar.style.width = `${totalAgreement}%`;
  
  // Color code agreement bar
  dom.matrixAgreementBar.className = `progress-bar-fill ${
    totalAgreement >= 85 ? 'fill-emerald' : (totalAgreement >= 60 ? 'fill-indigo' : (totalAgreement >= 45 ? 'fill-amber' : 'fill-red'))
  }`;

  // Update status badges
  updateMatchBadge(dom.matrixGstStatus, totalAgreement, dom.sourceGst.checked);
  updateMatchBadge(dom.matrixUpiStatus, totalAgreement, dom.sourceUpi.checked);
  updateMatchBadge(dom.matrixAaStatus, totalAgreement, dom.sourceAa.checked);

  // Fraud & Anomaly Shield status
  let fraudLevel = "LOW";
  let fraudDetails = "Verified consistent registries";
  let fraudClass = "text-green";
  let shieldClass = "text-green";
  let shieldBgClass = "";

  if (dom.circularSignals.checked) {
    fraudLevel = "HIGH";
    fraudDetails = "Circular credit routing flagged";
    fraudClass = "text-red";
    shieldClass = "text-red";
    shieldBgClass = "bg-red-tint";
    dom.fraudCard.className = "grid-card card-glass score-card card-glow-red";
  } else if (dom.vendorDelays.checked && totalAgreement < 85) {
    fraudLevel = "MEDIUM";
    fraudDetails = "Discrepancies & delayed payments detected";
    fraudClass = "text-amber";
    shieldClass = "text-amber";
    shieldBgClass = "bg-amber-tint";
    dom.fraudCard.className = "grid-card card-glass score-card card-glow-amber";
  } else {
    dom.fraudCard.className = "grid-card card-glass score-card card-glow-emerald";
  }

  dom.textFraud.textContent = fraudLevel;
  dom.textFraud.className = `fraud-level ${fraudClass}`;
  dom.textFraudDetails.textContent = fraudDetails;
  
  dom.fraudIcon.setAttribute("class", `shield-icon ${shieldClass}`);
  dom.fraudIcon.parentElement.className = `shield-icon-container ${shieldBgClass}`;

  // 6. SHAP drivers rendering
  renderShapDriversList(data.shap_drivers);

  // 7. Dynamic Narrative Memo text
  generateNarrativeMemo(data, totalAgreement, fraudLevel);
}

// Helper: Calculate standard agreement score
function calculateReconciledAgreement(recVals) {
  const vals = Object.values(recVals).filter(v => v > 0);
  if (vals.length < 2) return dom.circularSignals.checked ? 35 : 100;
  
  const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
  const variance = vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length;
  const stdDev = Math.sqrt(variance);
  
  const relDev = stdDev / avg;
  let score = Math.max(0, 100 - (relDev * 150));
  if (dom.circularSignals.checked) score = Math.min(score, 35);
  return Math.round(score);
}

// Helper: Set Gauge stroke-dashoffset
function setGaugeOffset(gaugeCircle, scorePercent) {
  const radius = gaugeCircle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (scorePercent / 100) * circumference;
  gaugeCircle.style.strokeDasharray = `${circumference} ${circumference}`;
  gaugeCircle.style.strokeDashoffset = offset;
}

// Helper: Match Status badge updates
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

// --- Render SHAP Drivers list in Explainability tab ---
function renderShapDriversList(drivers) {
  dom.shapDriversList.innerHTML = "";
  if (!drivers || drivers.length === 0) {
    dom.shapDriversList.innerHTML = '<p class="empty-state">No driver metrics calculated.</p>';
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
    dom.shapDriversList.appendChild(item);
  });
}

// --- Generate dynamic underwriter Narrative Brief ---
function generateNarrativeMemo(data, agreement, fraud) {
  let text = "";
  const avg = (data.reconciled_values.gst + data.reconciled_values.upi + data.reconciled_values.aa) / 3;

  if (fraud === "HIGH") {
    text = `[CRITICAL ANOMALY DETECTED]\n`;
    text += `Scoring models bypassed. Application DECLINED due to circular invoicing patterns.\n`;
    text += `• Anomaly Analysis: System identifies high-frequency credits matching related accounts, inflating AA statement volumes by ${100 - agreement}% compared to merchant transactions.\n`;
    text += `• Directives: Immediately stop process. Do not override this limit.`;
  } else if (data.decision === "APPROVE") {
    text = `[UNDERWRITING ASSESSMENT SUMMARY - APPROVED]\n`;
    text += `Business operational health is stable (Score: ${data.health_score}/100) with strong ledger alignment (Agreement: ${agreement}%).\n`;
    if (data.pan.startsWith("AAA")) {
      text += `• Inclusivity Mapping: Credit invisible NTC profile. Average monthly business inflows verified at ₹${avg.toFixed(1)}L via bank accounts with stable payroll indicators.\n`;
      text += `• Risk Calibration: Calibrated at traditional Low-Medium Risk with high reliability (${data.reliability_index}%).\n`;
    } else {
      text += `• Profile: CIBIL Score is ${dom.inputCibil.value} and real-time cash flow verification confirms capital solvency.\n`;
    }
    text += `• Recommendation: Authorize credit limit of ₹${data.recommended_limit_lakhs.toFixed(1)} Lakhs at ${data.interest_rate.toFixed(1)}% p.a. with monthly bank escrow rules.`;
  } else if (data.decision === "REFER") {
    text = `[POLICY EXCEPTION LOGGED - REFER TO COMMITTEE]\n`;
    text += `Manual override required. System flags variables sitting outside auto-approval envelopes:\n`;
    if (parseFloat(dom.inputRevenueGrowth.value) < -20) {
      text += `• Sales Contraction: 90-day transaction trend reports a ${Math.abs(parseFloat(dom.inputRevenueGrowth.value))}% shrinkage.\n`;
    }
    if (dom.vendorDelays.checked) {
      text += `• Supplier Delays: Warning indicators verify delays in vendor payment timelines.\n`;
    }
    text += `• Recommendation: Cap credit allocation at ₹${data.recommended_limit_lakhs.toFixed(1)} Lakhs under weekly collections covenant.`;
  } else {
    text = `[UNDERWRITING ASSESSMENT SUMMARY - DECLINED]\n`;
    text += `Application declined. Business health is insufficient (Health: ${data.health_score}/100).\n`;
    text += `• Drivers: Operational contraction and severe liquidity delay indicators exceed safety parameters.`;
  }

  dom.textNarrative.textContent = text;
  dom.auditTrailInfo.textContent = `Case ID ${data.id || "Pending"}. verified PAN: ${data.pan} | Reconciled Index: ${agreement}%`;
}

// --- Submit Human-in-the-Loop Override ---
async function submitManualOverride() {
  if (!currentApplicationId) {
    alert("Process an application first before trying to log overrides.");
    return;
  }

  const payload = {
    underwriter_name: dom.underwriterNameInput.value,
    action_taken: dom.overrideDecisionSelect.value,
    approved_limit_lakhs: parseFloat(dom.overrideLimitInput.value),
    override_reason: dom.overrideReasonText.value
  };

  try {
    const res = await fetch(`${BACKEND_URL}/api/applications/${currentApplicationId}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert("Manual override successfully logged in PostgreSQL audit logs!");
      
      // Update the main dashboard decision badges immediately to reflect human override
      dom.recDecision.textContent = payload.action_taken;
      
      let decisionClass = "";
      if (payload.action_taken === "REFER") decisionClass = "badge-refer";
      if (payload.action_taken === "DECLINE") decisionClass = "badge-decline";
      dom.recDecision.className = `rec-badge ${decisionClass}`;
      
      dom.recLimit.textContent = payload.approved_limit_lakhs > 0 ? `₹${payload.approved_limit_lakhs.toFixed(1)} Lakhs` : "₹0";
      if (payload.approved_limit_lakhs === 0) {
        dom.recRate.textContent = "N/A";
        dom.recTenure.textContent = "Not Applicable";
      }

      // Reset override form text fields
      dom.overrideReasonText.value = "";
      fetchAuditHistory(); // refresh logs
    } else {
      const errData = await res.json();
      alert(`Override rejected: ${errData.detail || "Validation check failed"}`);
    }
  } catch (err) {
    alert("Connection to backend server failed. Override cannot be logged.");
  }
}

// --- Fetch Manual Overrides Log from Backend Database ---
async function fetchAuditHistory() {
  if (!currentApplicationId) return;

  try {
    const res = await fetch(`${BACKEND_URL}/api/applications/${currentApplicationId}/audit`);
    if (res.ok) {
      const audits = await res.json();
      renderAuditLogs(audits);
    }
  } catch (err) {
    console.error("Audit log retrieve failure:", err);
  }
}

// --- Render Override Logs in Console tab ---
function renderAuditLogs(audits) {
  dom.auditLogsContainer.innerHTML = "";
  
  if (!audits || audits.length === 0) {
    dom.auditLogsContainer.innerHTML = '<p class="empty-state">No overrides logged for this application.</p>';
    return;
  }

  audits.forEach(log => {
    const dt = new Date(log.timestamp).toLocaleString();
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
      <div class="term-footer-txt" style="text-align: right; margin-top: 0.15rem;">
        Logged: ${dt}
      </div>
    `;
    dom.auditLogsContainer.appendChild(item);
  });
}

// --- Fallback Local calculation engine (If backend is offline) ---
// This ensures the dashboard remains completely interactive as a client-only prototype
function triggerLocalCalculation() {
  const averageFlow = (
    parseFloat(dom.inputGstVal.value) * (dom.sourceGst.checked ? 1 : 0) +
    parseFloat(dom.inputUpiVal.value) * (dom.sourceUpi.checked ? 1 : 0) +
    parseFloat(dom.inputAaVal.value) * (dom.sourceAa.checked ? 1 : 0)
  ) / [dom.sourceGst.checked, dom.sourceUpi.checked, dom.sourceAa.checked].filter(Boolean).length || 0;

  const raw_data = {
    company_name: dom.companyNameInput.value,
    pan: dom.panInput.value,
    health_score: Math.min(100, Math.max(0, 70 + (averageFlow * 0.5) + (dom.vendorDelays.checked ? -18 : 10))),
    reliability_index: dom.circularSignals.checked ? 40 : 90,
    risk_tier: dom.circularSignals.checked ? "High Risk" : (averageFlow >= 20 ? "Low-Medium Risk" : "Medium-High Risk"),
    probability_of_default: dom.circularSignals.checked ? 0.8 : (averageFlow >= 20 ? 0.12 : 0.45),
    decision: dom.circularSignals.checked ? "DECLINE" : (averageFlow >= 15 ? "APPROVE" : "REFER"),
    recommended_limit_lakhs: dom.circularSignals.checked ? 0 : Math.round(averageFlow * 0.8),
    interest_rate: dom.circularSignals.checked ? 0 : 11.5,
    repayment_terms: dom.circularSignals.checked ? "Not Applicable" : "Monthly Escrow Account Settlement",
    shap_drivers: [
      { feature: "data_coverage", label: "Registry Data Coverage", impact: 12 },
      { feature: "source_variance", label: "Multi-Source Variance", impact: dom.circularSignals.checked ? -38 : 14 }
    ],
    reconciled_values: {
      gst: dom.sourceGst.checked ? parseFloat(dom.inputGstVal.value) : 0,
      upi: dom.sourceUpi.checked ? parseFloat(dom.inputUpiVal.value) : 0,
      aa: dom.sourceAa.checked ? parseFloat(dom.inputAaVal.value) : 0
    }
  };

  updateUI(raw_data);
}
