import numpy as np

# --- Calibration Coefficients (Simulating a Trained Logistic Regression Model) ---
# The weights represent the relative risk impact of each normalized feature.
# Bias is negative because default is a rare event (base probability is low).
MODEL_BIAS = -0.5

WEIGHTS = {
    "data_coverage": -1.2,      # High coverage reduces default probability
    "source_variance": 2.5,     # High variance between registries increases risk
    "revenue_trend": -1.8,      # Positive growth reduces risk
    "payroll_intensity": -0.8,  # Higher payroll contributions reduce risk
    "cibil_score": -2.2,        # Higher CIBIL reduces risk
    "cibil_missing": 0.4,       # Penalty for lack of credit history (bureau-blind)
    "circular_trading": 4.5,    # Massive positive coefficient (high default risk if flagged)
    "vendor_delay": 1.5         # Delayed payments increase default probability
}

# Base expected values for features (for SHAP attribution calculation)
FEATURE_BASES = {
    "data_coverage": 0.8,
    "source_variance": 0.1,
    "revenue_trend": 0.05,
    "payroll_intensity": 0.5,
    "cibil_score": 0.75,
    "cibil_missing": 0.1,
    "circular_trading": 0.02,
    "vendor_delay": 0.05
}

class UnderwritingEngine:
    @staticmethod
    def extract_features(data: dict) -> dict:
        """
        Transforms raw data from GST, UPI, AA, and EPFO into a normalized feature vector.
        No hardcoded rule filtering is applied here.
        """
        # 1. Data Coverage (ratio of active sources)
        sources = data.get("sources", {})
        active_count = sum(1 for v in sources.values() if v)
        total_count = len(sources) if sources else 1
        coverage = active_count / total_count

        # 2. Source Variance (discrepancy between GST, UPI, and AA banking)
        gst = data.get("gst_sales", 0.0)
        upi = data.get("upi_receipts", 0.0)
        aa = data.get("aa_deposits", 0.0)
        
        flows = []
        if sources.get("gst"): flows.append(gst)
        if sources.get("upi"): flows.append(upi)
        if sources.get("aa"): flows.append(aa)
        
        avg_flow = np.mean(flows) if flows else 0.0
        
        if avg_flow > 0:
            std_dev = np.std(flows)
            source_variance = std_dev / avg_flow
        else:
            source_variance = 0.5  # Neutral default for empty files

        # 3. Revenue Trend
        revenue_trend = data.get("growth_trend", 0.0) / 100.0  # convert % to decimal

        # 4. Payroll Intensity (employees per unit revenue)
        employees = data.get("employees", 0)
        payroll_intensity = min(1.0, (employees * 0.1) / (avg_flow + 1.0))

        # 5. CIBIL score normalization (300-900 mapped to 0-1)
        cibil_raw = data.get("cibil", 300)
        cibil_missing = 1.0 if data.get("cibil_unavailable", False) else 0.0
        
        if cibil_missing:
            cibil_score = 0.5  # Neutral expectation
        else:
            cibil_score = (cibil_raw - 300) / 600.0

        # 6. Operational Flags (Boolean inputs mapped to float representation)
        circular_trading = 1.0 if data.get("circular_signals", False) else 0.0
        vendor_delay = 1.0 if data.get("vendor_delays", False) else 0.0

        return {
            "data_coverage": coverage,
            "source_variance": source_variance,
            "revenue_trend": revenue_trend,
            "payroll_intensity": payroll_intensity,
            "cibil_score": cibil_score,
            "cibil_missing": cibil_missing,
            "circular_trading": circular_trading,
            "vendor_delay": vendor_delay,
            "avg_flow": avg_flow
        }

    @classmethod
    def evaluate_risk(cls, raw_data: dict) -> dict:
        """
        Runs the mathematical logistic scoring and SHAP attribution models.
        """
        features = cls.extract_features(raw_data)
        
        # Calculate log-odds (z)
        z = MODEL_BIAS
        attributions = {}
        
        for feature, val in features.items():
            if feature == "avg_flow":
                continue
            weight = WEIGHTS[feature]
            # Contribution to log-odds
            z += weight * val
            
            # SHAP value = weight * (value - expected_baseline)
            # Reversing sign for readability (so positive SHAP score = positive credit contribution)
            shap_val = -1.0 * weight * (val - FEATURE_BASES[feature])
            attributions[feature] = shap_val

        # Sigmoid activation to get Probability of Default (PD)
        pd = 1.0 / (1.0 + np.exp(-z))
        
        # Financial Health Score: derived as a function of the survival probability (1 - PD)
        # Healthy business = low PD.
        health_score = int(round((1.0 - pd) * 100))

        # Reliability Index: based on coverage and lack of variance
        coverage = features["data_coverage"]
        variance = features["source_variance"]
        reliability = (coverage * 0.4) + (max(0.0, 1.0 - variance) * 0.6)
        if raw_data.get("circular_signals", False):
            reliability = max(0.2, reliability - 0.25)
        reliability = int(round(reliability * 100))

        # Risk Tier Classification based on mathematical boundaries of Probability of Default (PD)
        if pd < 0.15:
            risk_tier = "Low Risk"
        elif pd < 0.35:
            risk_tier = "Low-Medium Risk"
        elif pd < 0.65:
            risk_tier = "Medium-High Risk"
        else:
            risk_tier = "High Risk"

        # Dynamic Credit Limit Recommendation (Revenue average scaled by survival probability and reliability)
        avg_flow = features["avg_flow"]
        if pd > 0.65:  # High risk cut-off based on score threshold
            decision = "DECLINE"
            recommended_limit = 0.0
            interest_rate = 0.0
            terms = "Not Applicable"
        else:
            survival_factor = 1.0 - pd
            reliability_factor = reliability / 100.0
            
            # Limit = average monthly revenue * survival * reliability * safety margin multiplier
            recommended_limit = avg_flow * 0.8 * survival_factor * reliability_factor
            
            # NTC scaling incentive (increase limit slightly if files are highly reliable but CIBIL is missing)
            if features["cibil_missing"] == 1.0 and reliability > 80:
                recommended_limit *= 1.1
                
            recommended_limit = round(min(35.0, max(0.0, recommended_limit)), 1)
            
            if pd < 0.25 and reliability > 75:
                decision = "APPROVE"
                # Interest rate scales dynamically between 10.5% and 13.5%
                interest_rate = round(10.5 + (pd * 12), 1)
                terms = "Monthly Escrow Account Settlement"
            else:
                decision = "REFER"
                interest_rate = 14.5
                terms = "Weekly Escrow / Post-Dated Cheque Collection"

        # Format SHAP drivers for output
        shap_drivers = []
        feature_labels = {
            "data_coverage": "Registry Data Coverage",
            "source_variance": "Multi-Source Variance",
            "revenue_trend": "Monthly Revenue Growth Trend",
            "payroll_intensity": "EPFO Payroll Stability",
            "cibil_score": "Bureau Credit History Overlay",
            "cibil_missing": "Lack of Bureau History (NTC)",
            "circular_trading": "Anomalous Topology (Circular Trade)",
            "vendor_delay": "Vendor Payment Delays"
        }

        for k, v in attributions.items():
            impact_points = int(round(v * 10))  # Scale to points format
            if impact_points != 0:
                shap_drivers.append({
                    "feature": k,
                    "label": feature_labels[k],
                    "impact": impact_points
                })

        # Sort drivers by absolute impact
        shap_drivers.sort(key=lambda item: abs(item["impact"]), reverse=True)

        return {
            "health_score": health_score,
            "reliability_index": reliability,
            "risk_tier": risk_tier,
            "probability_of_default": round(float(pd), 4),
            "decision": decision,
            "recommended_limit_lakhs": recommended_limit,
            "interest_rate": interest_rate,
            "repayment_terms": terms,
            "shap_drivers": shap_drivers,
            "reconciled_values": {
                "gst": round(features["avg_flow"] if raw_data.get("sources", {}).get("gst") else 0, 1),
                "upi": round(features["avg_flow"] if raw_data.get("sources", {}).get("upi") else 0, 1),
                "aa": round(features["avg_flow"] if raw_data.get("sources", {}).get("aa") else 0, 1)
            }
        }
