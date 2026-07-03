// IDBI Underwriting Portal - Portfolio Hub Controller
const BACKEND_URL = "http://127.0.0.1:5000";

let allApplications = [];

document.addEventListener("DOMContentLoaded", () => {
  fetchApplications();
  setupSearch();
});

// --- Fetch Applications from Database ---
async function fetchApplications() {
  const statusBadge = document.getElementById("backend-status-text");
  
  try {
    const res = await fetch(`${BACKEND_URL}/api/applications`);
    if (res.ok) {
      allApplications = await res.json();
      
      // Update header status badge
      statusBadge.textContent = "Secured Session (Connected)";
      statusBadge.parentElement.className = "meta-badge pulse-badge";
      
      renderStats();
      renderTable(allApplications);
    }
  } catch (err) {
    console.error("Failed to connect to backend:", err);
    statusBadge.textContent = "Simulation Mode (Offline)";
    statusBadge.parentElement.className = "meta-badge";
    
    // Offline Mode Mock Fallback data in case server is not running
    allApplications = [
      {
        id: 1,
        company_name: "S.R. Textiles",
        pan: "AAAPW9928M",
        health_score: 80,
        reliability_index: 92,
        risk_tier: "Low-Medium Risk",
        decision: "APPROVE",
        recommended_limit_lakhs: 18.0
      },
      {
        id: 2,
        company_name: "Gopal Retailers Ltd",
        pan: "BCCPG8837K",
        health_score: 46,
        reliability_index: 90,
        risk_tier: "High Risk",
        decision: "REFER",
        recommended_limit_lakhs: 3.0
      },
      {
        id: 3,
        company_name: "AgroFarms Innovate",
        pan: "DDFPS4492A",
        health_score: 68,
        reliability_index: 78,
        risk_tier: "Medium-High Risk",
        decision: "REFER",
        recommended_limit_lakhs: 8.0
      },
      {
        id: 4,
        company_name: "Apex Trading Shell",
        pan: "EEEPX1002G",
        health_score: 32,
        reliability_index: 40,
        risk_tier: "High Risk",
        decision: "DECLINE",
        recommended_limit_lakhs: 0.0
      }
    ];
    renderStats();
    renderTable(allApplications);
  }
}

// --- Render Header statistics ---
function renderStats() {
  document.getElementById("stat-total").textContent = allApplications.length;
  
  const approved = allApplications.filter(app => app.decision === "APPROVE").length;
  const referred = allApplications.filter(app => app.decision === "REFER").length;
  const declined = allApplications.filter(app => app.decision === "DECLINE").length;

  document.getElementById("stat-approved").textContent = approved;
  document.getElementById("stat-referred").textContent = referred;
  document.getElementById("stat-declined").textContent = declined;
}

// --- Render Portfolio Table ---
function renderTable(apps) {
  const tbody = document.getElementById("portfolio-table-body");
  tbody.innerHTML = "";

  if (apps.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No assessment history logs registered in database.
        </td>
      </tr>
    `;
    return;
  }

  apps.forEach(app => {
    let decisionBadge = "badge-refer";
    if (app.decision === "APPROVE") decisionBadge = "badge-approved";
    if (app.decision === "DECLINE") decisionBadge = "badge-declined";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="bold-cell">#${app.id}</td>
      <td class="bold-cell">${app.company_name}</td>
      <td class="pan-cell">${app.pan}</td>
      <td>
        <strong>${app.health_score}</strong>/100
      </td>
      <td>${app.reliability_index}%</td>
      <td>${app.risk_tier}</td>
      <td>
        <span class="badge ${decisionBadge}">${app.decision}</span>
      </td>
      <td class="bold-cell">${app.recommended_limit_lakhs > 0 ? `₹${app.recommended_limit_lakhs.toFixed(1)}L` : "₹0"}</td>
      <td>
        <a href="case_details.html?id=${app.id}" class="review-link">
          Review File ➔
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Search Filtering ---
function setupSearch() {
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("keyup", (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (query === "") {
      renderTable(allApplications);
      return;
    }

    const filtered = allApplications.filter(app => {
      return app.company_name.toLowerCase().includes(query) || 
             app.pan.toLowerCase().includes(query);
    });
    
    renderTable(filtered);
  });
}
