# Valkyrie Risk Intel: Trustworthy AI Credit Decision Engine


Valkyrie is an **AI Underwriting Companion** designed to support credit underwriting teams by fetching real-time digital registry data (GST, UPI, EPFO, Account Aggregators) and generating explainable credit assessments.

This codebase is structured as a **3-Page Loan Origination System (LOS) Portal** styled to match the official brand aesthetic of **IDBI Bank** (deep teal green `#00836C`, orange passion `#F58220`, and crisp white card modules).

---

## 1. Streamlined Multi-Page Portal Architecture

To eliminate cognitive overload, the application is divided into three distinct functional pages:

```
                  ┌──────────────────────────────┐
                  │      index.html              │
                  │      (Portfolio Hub)         │
                  └──────────────┬───────────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            ▼                                         ▼
┌───────────────────────┐                 ┌───────────────────────┐
│  new_assessment.html  │                 │  case_details.html    │
│  (Sandbox Inputs &   │                 │  (Risk File Detail    │
│   Preset Templates)   │                 │   Audit & Overrides)  │
└───────────┬───────────┘                 └───────────────────────┘
            │                                         ▲
            └─────────── Run AI Underwrite ───────────┘
```

1. **[index.html](file:///C:/Users/anmol/OneDrive/Desktop/Work/idb-credit-decision-engine/index.html) (Portfolio Hub):** 
   Lists processed MSME files, shows summary statistics (Total, Approved, Referred, Declined), and provides search filters to scan history by Business Name or PAN.
2. **[new_assessment.html](file:///C:/Users/anmol/OneDrive/Desktop/Work/idb-credit-decision-engine/new_assessment.html) (Case Sandbox Input):**
   Where underwriters enter company names, PANs, adjust parameters (CIBIL score, monthly flows, EPFO staff counts, operational warning flags), or click presets to instantly load templates.
3. **[case_details.html](file:///C:/Users/anmol/OneDrive/Desktop/Work/idb-credit-decision-engine/case_details.html) (Assessment Case File):**
   A spacious file review page showing the risk calibration band, health/reliability gauges, GST-UPI-Statement clearing matrix, SHAP explainability variables, terminal-style narrative summaries, and a console to execute manual limit overrides.


## 2. Credit Scoring Core: Zero Hardcoded Rules or Filters

To bypass fragile, hardcoded if/else rules, the backend engine  standardizes input dimensions (Data Coverage, Source Variance, Sales Trends, EPFO staff, and normalized CIBIL) into a unified feature vector, feeding it into a logistic scoring function:

$$z = \text{Bias} + \sum \text{Weight}_i \times \text{Feature Value}_i$$
$$\text{Probability of Default (PD)} = \frac{1}{1 + e^{-z}}$$

* **Attribution Weights (SHAP):** Driver points are derived dynamically by comparing feature weights against population expectations:
  $$\text{Impact}_i = -10 \times \text{Weight}_i \times (\text{Feature Value}_i - \text{Expected Baseline}_i)$$
* **Manual Override & PostgreSQL Logging:** Credit officers can override the AI's recommendations. Submitting the override form writes the changes, the underwriter's identity, and their mandatory written justification to the `underwriting_audit_trails` database table, maintaining strict policy compliance.

---

## 3. Run & Test Instructions

### A. Boot the Backend API Server:
1. Ensure your terminal shell is running inside the virtual environment (`.venv`).
2. Navigate to the backend directory and launch the server:
   ```bash
   cd backend
   python run.py
   ```
   The backend starts Uvicorn on `http://127.0.0.1:5000`. On first start, it creates `valkyrie_lending.db` and auto-seeds the 4 cases.

### B. Launch the Frontend Local Server:
1. Start an HTTP server from the project root:
   ```bash
   python -m http.server 8000
   ```
2. Open your web browser and navigate to **[http://localhost:8000](http://localhost:8000)**.
3. The table lists the seeded history files. Click **"Review File ➔"** on any row to open the underwriting file details. Go to **Tab 4 (Console)** to log overrides and see them save to Uvicorn's database.

### C. Fallback Simulation (Offline Mode):
If the FastAPI backend is not running, the frontend scripts automatically activate **local simulation mode**. You can still fill out the form in `new_assessment.html` and click presets; the JS will run the credit scoring equations locally in the browser, save the file to `localStorage`, and redirect you to the details page with fully interactive local mock metrics.
