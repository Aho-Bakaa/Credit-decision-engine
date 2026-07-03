// IDBI Underwriting Portal - New Assessment Sandbox Controller
const BACKEND_URL = "http://127.0.0.1:5000";

// --- Case Presets with DPI Integration details and Ingested Transaction Analytics ---
const PRESETS = {
  invisible: {
    company_name: "S.R. Textiles",
    pan: "AAAPW9928M",
    cibil: 720,
    cibilUnavailable: true,
    gstin: "27AAASR9928A1Z3",
    aaHandle: "srtextiles@onemoney",
    epfoId: "MH/MUM/0099281/000",
    upiVpa: "srtextiles@idbi",
    utilityId: "",
    gstSales: 24.5,
    upiReceipts: 25.2,
    aaDeposits: 24.8,
    growth: 5,
    employees: 12,
    vendorDelays: false,
    circularSignals: false,
    bounce_rate: 0,
    customer_concentration: 18,
    gst_delay_days: 1,
    od_utilization: 0,
    adb_ratio: 24
  },
  silent: {
    company_name: "Gopal Retailers Ltd",
    pan: "BCCPG8837K",
    cibil: 770,
    cibilUnavailable: false,
    gstin: "27BCCGOP8837A1Z3",
    aaHandle: "gopalretailers@onemoney",
    epfoId: "MH/MUM/0088372/000",
    upiVpa: "gopalstores@idbi",
    utilityId: "",
    gstSales: 7.2,
    upiReceipts: 7.8,
    aaDeposits: 7.5,
    growth: -40,
    employees: 9,
    vendorDelays: true,
    circularSignals: false,
    bounce_rate: 4,
    customer_concentration: 45,
    gst_delay_days: 18,
    od_utilization: 88,
    adb_ratio: 2
  },
  volatile: {
    company_name: "AgroFarms Innovate",
    pan: "DDFPS4492A",
    cibil: 680,
    cibilUnavailable: false,
    gstin: "27DDFAG4492A1Z3",
    aaHandle: "agrofarms@onemoney",
    epfoId: "",
    upiVpa: "agrofarms@idbi",
    utilityId: "MSEDCL-44921",
    gstSales: 22.0,
    upiReceipts: 31.0,
    aaDeposits: 26.0,
    growth: 15,
    employees: 4,
    vendorDelays: false,
    circularSignals: false,
    bounce_rate: 1,
    customer_concentration: 32,
    gst_delay_days: 2,
    od_utilization: 35,
    adb_ratio: 12
  },
  fraud: {
    company_name: "Apex Trading Shell",
    pan: "EEEPX1002G",
    cibil: 710,
    cibilUnavailable: false,
    gstin: "27EEEAP1002A1Z3",
    aaHandle: "apextrading@onemoney",
    epfoId: "",
    upiVpa: "",
    utilityId: "",
    gstSales: 14.8,
    upiReceipts: 1.2,
    aaDeposits: 14.6,
    growth: 2,
    employees: 2,
    vendorDelays: false,
    circularSignals: true,
    bounce_rate: 0,
    customer_concentration: 95,
    gst_delay_days: 0,
    od_utilization: 10,
    adb_ratio: 50
  }
};

let isBackendLive = false;

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkBackendLiveness();
  loadPreset(PRESETS.invisible);
});

// --- Setup Form Controls listeners ---
function setupEventListeners() {
  const inputs = {
    cibil: document.getElementById("input-cibil"),
    cibilUnavailable: document.getElementById("cibil-unavailable"),
    gst: document.getElementById("input-gst-val"),
    upi: document.getElementById("input-upi-val"),
    aa: document.getElementById("input-aa-val"),
    growth: document.getElementById("input-revenue-growth"),
    employees: document.getElementById("input-employees"),
    form: document.getElementById("assessment-form"),
    presetBtns: document.querySelectorAll(".preset-btn"),
    
    // 5 New sliders
    bounce: document.getElementById("input-bounce-rate"),
    odUtil: document.getElementById("input-od-utilization"),
    adbRatio: document.getElementById("input-adb-ratio"),
    custConc: document.getElementById("input-customer-concentration"),
    gstDelay: document.getElementById("input-gst-delay")
  };

  // Preset button clicks
  inputs.presetBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      inputs.presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.preset;
      loadPreset(PRESETS[key]);
    });
  });

  // Slider value feedbacks
  inputs.cibil.addEventListener("input", (e) => {
    document.getElementById("val-cibil").textContent = e.target.value;
  });
  inputs.cibilUnavailable.addEventListener("change", (e) => {
    inputs.cibil.disabled = e.target.checked;
    document.getElementById("val-cibil").style.opacity = e.target.checked ? "0.4" : "1";
  });

  inputs.gst.addEventListener("input", (e) => {
    document.getElementById("val-gst").textContent = `₹${parseFloat(e.target.value).toFixed(1)}L`;
  });
  inputs.upi.addEventListener("input", (e) => {
    document.getElementById("val-upi").textContent = `₹${parseFloat(e.target.value).toFixed(1)}L`;
  });
  inputs.aa.addEventListener("input", (e) => {
    document.getElementById("val-aa").textContent = `₹${parseFloat(e.target.value).toFixed(1)}L`;
  });
  inputs.growth.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    document.getElementById("val-growth").textContent = (val >= 0 ? "+" : "") + val + "%";
  });
  inputs.employees.addEventListener("input", (e) => {
    document.getElementById("val-employees").textContent = `${e.target.value} staff`;
  });

  // 5 New sliders listeners
  inputs.bounce.addEventListener("input", (e) => {
    const val = e.target.value;
    document.getElementById("val-bounce").textContent = `${val} bounce${val == 1 ? '' : 's'}`;
  });
  inputs.odUtil.addEventListener("input", (e) => {
    document.getElementById("val-od-util").textContent = `${e.target.value}%`;
  });
  inputs.adbRatio.addEventListener("input", (e) => {
    document.getElementById("val-adb-ratio").textContent = `${e.target.value}%`;
  });
  inputs.custConc.addEventListener("input", (e) => {
    document.getElementById("val-cust-conc").textContent = `${e.target.value}%`;
  });
  inputs.gstDelay.addEventListener("input", (e) => {
    const val = e.target.value;
    document.getElementById("val-gst-delay").textContent = `${val} day${val == 1 ? '' : 's'} delay`;
  });

  // Form submit assessor trigger
  inputs.form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitUnderwritingForm();
  });
}

// --- Load Preset details ---
function loadPreset(preset) {
  document.getElementById("company-name-input").value = preset.company_name;
  document.getElementById("pan-input").value = preset.pan;
  
  const cibil = document.getElementById("input-cibil");
  const cibilUnavailable = document.getElementById("cibil-unavailable");
  cibilUnavailable.checked = preset.cibilUnavailable;
  cibil.value = preset.cibil;
  cibil.disabled = preset.cibilUnavailable;
  document.getElementById("val-cibil").textContent = preset.cibil;
  document.getElementById("val-cibil").style.opacity = preset.cibilUnavailable ? "0.4" : "1";

  // DPI Credentials
  document.getElementById("gstin-input").value = preset.gstin;
  document.getElementById("aa-handle-input").value = preset.aaHandle;
  document.getElementById("epfo-id-input").value = preset.epfoId;
  document.getElementById("upi-vpa-input").value = preset.upiVpa;
  document.getElementById("utility-id-input").value = preset.utilityId || "";

  // Monthly values
  document.getElementById("input-gst-val").value = preset.gstSales;
  document.getElementById("val-gst").textContent = `₹${preset.gstSales.toFixed(1)}L`;
  document.getElementById("input-upi-val").value = preset.upiReceipts;
  document.getElementById("val-upi").textContent = `₹${preset.upiReceipts.toFixed(1)}L`;
  document.getElementById("input-aa-val").value = preset.aaDeposits;
  document.getElementById("val-aa").textContent = `₹${preset.aaDeposits.toFixed(1)}L`;

  document.getElementById("input-revenue-growth").value = preset.growth;
  document.getElementById("val-growth").textContent = (preset.growth >= 0 ? "+" : "") + preset.growth + "%";
  document.getElementById("input-employees").value = preset.employees;
  document.getElementById("val-employees").textContent = `${preset.employees} staff`;

  document.getElementById("vendor-delays").checked = preset.vendorDelays;
  document.getElementById("circular-signals").checked = preset.circularSignals;

  // 5 New sliders preset loader
  document.getElementById("input-bounce-rate").value = preset.bounce_rate;
  document.getElementById("val-bounce").textContent = `${preset.bounce_rate} bounce${preset.bounce_rate == 1 ? '' : 's'}`;
  
  document.getElementById("input-od-utilization").value = preset.od_utilization;
  document.getElementById("val-od-util").textContent = `${preset.od_utilization}%`;
  
  document.getElementById("input-adb-ratio").value = preset.adb_ratio;
  document.getElementById("val-adb-ratio").textContent = `${preset.adb_ratio}%`;
  
  document.getElementById("input-customer-concentration").value = preset.customer_concentration;
  document.getElementById("val-cust-conc").textContent = `${preset.customer_concentration}%`;
  
  document.getElementById("input-gst-delay").value = preset.gst_delay_days;
  document.getElementById("val-gst-delay").textContent = `${preset.gst_delay_days} day${preset.gst_delay_days == 1 ? '' : 's'} delay`;
}

// --- Check Liveness status ---
async function checkBackendLiveness() {
  const statusBadge = document.getElementById("backend-status-text");
  try {
    const res = await fetch(`${BACKEND_URL}/api/applications`);
    if (res.ok) {
      isBackendLive = true;
      statusBadge.textContent = "Secured Session (Connected)";
      statusBadge.parentElement.className = "meta-badge pulse-badge";
    }
  } catch (err) {
    isBackendLive = false;
    statusBadge.textContent = "Simulation Mode (Offline)";
    statusBadge.parentElement.className = "meta-badge";
  }
}

// --- Submit form data ---
async function submitUnderwritingForm() {
  const payload = {
    company_name: document.getElementById("company-name-input").value,
    pan: document.getElementById("pan-input").value.toUpperCase(),
    gstin: document.getElementById("gstin-input").value.trim(),
    cibil: parseInt(document.getElementById("input-cibil").value),
    cibil_unavailable: document.getElementById("cibil-unavailable").checked,
    gst_sales: parseFloat(document.getElementById("input-gst-val").value),
    upi_receipts: parseFloat(document.getElementById("input-upi-val").value),
    aa_deposits: parseFloat(document.getElementById("input-aa-val").value),
    growth_trend: parseFloat(document.getElementById("input-revenue-growth").value),
    employees: parseInt(document.getElementById("input-employees").value),
    sources: {
      gst: document.getElementById("gstin-input").value.trim().length > 0,
      upi: document.getElementById("upi-vpa-input").value.trim().length > 0,
      aa: document.getElementById("aa-handle-input").value.trim().length > 0,
      epfo: document.getElementById("epfo-id-input").value.trim().length > 0,
      utility: document.getElementById("utility-id-input").value.trim().length > 0
    },
    vendor_delays: document.getElementById("vendor-delays").checked,
    circular_signals: document.getElementById("circular-signals").checked,
    
    // 5 New parameters
    bounce_rate: parseInt(document.getElementById("input-bounce-rate").value),
    customer_concentration: parseFloat(document.getElementById("input-customer-concentration").value),
    gst_delay_days: parseInt(document.getElementById("input-gst-delay").value),
    od_utilization: parseFloat(document.getElementById("input-od-utilization").value),
    adb_ratio: parseFloat(document.getElementById("input-adb-ratio").value)
  };

  if (isBackendLive) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/underwrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        window.location.href = `case_details.html?id=${data.id}`;
      } else {
        const err = await res.json();
        alert(`Assessment failed: ${err.detail || "Validation check error"}`);
      }
    } catch (err) {
      alert("Error sending underwriting parameters to backend.");
    }
  } else {
    alert("Backend server offline. Generating simulation case file locally...");
    const simulatedId = Math.floor(Math.random() * 1000) + 10;
    
    const localCase = {
      id: simulatedId,
      ...payload,
      created_at: new Date().toISOString()
    };
    localStorage.setItem(`simulated_case_${simulatedId}`, JSON.stringify(localCase));
    
    window.location.href = `case_details.html?id=${simulatedId}&mock=true`;
  }
}
