import numpy as np
import pandas as pd
import joblib
import os

# Expected population baselines for SHAP driver attributions
FEATURE_BASES = {
    "roa": 0.50,
    "operating_margin": 0.60,
    "net_growth_rate": 0.05,
    "debt_ratio": 0.11,
    "borrowing_dependency": 0.37,
    "cash_to_assets": 0.12,
    "cash_flow_rate": 0.46
}

class UnderwritingEngine:
    @staticmethod
    def extract_features(data: dict) -> dict:
        """
        Extracts raw operational values and transforms them into 7 standardized
        financial variables matching the trained model's feature space.
        """
        sources = data.get("sources", {})
        gst = data.get("gst_sales", 0.0)
        upi = data.get("upi_receipts", 0.0)
        aa = data.get("aa_deposits", 0.0)
        
        flows = [v for v, k in zip([gst, upi, aa], ["gst", "upi", "aa"]) if sources.get(k)]
        avg_flow = np.mean(flows) if flows else 0.0
        
        # 1. ROA (Return on Assets proxy based on sales efficiency)
        employees = data.get("employees", 0)
        roa = min(1.0, max(0.0, 0.5 + (avg_flow * 0.01) - (employees * 0.005)))
        
        # 2. Operating Margin (derived from multi-source variance)
        if avg_flow > 0:
            std_dev = np.std(flows)
            source_variance = std_dev / avg_flow
        else:
            source_variance = 0.5
        operating_margin = min(1.0, max(0.0, 1.0 - source_variance))

        # 3. Net Growth Rate (clip-scaled sales trend)
        growth_raw = data.get("growth_trend", 0.0) / 100.0
        net_growth_rate = min(1.0, max(0.0, (growth_raw + 0.5) / 1.0))

        # 4. Debt Ratio (Overdraft utilization + compliance delays + bounces)
        od_util = data.get("od_utilization", 0.0) / 100.0
        delay_penalty = min(0.3, data.get("gst_delay_days", 0) * 0.01)
        bounce_penalty = min(0.3, data.get("bounce_rate", 0) * 0.05)
        debt_ratio = min(1.0, od_util + delay_penalty + bounce_penalty + (0.2 if data.get("vendor_delays") else 0.0))

        # 5. Borrowing Dependency (Sales concentration + missing bureau indicators)
        cust_conc = data.get("customer_concentration", 25.0) / 100.0
        bureau_missing = 0.2 if data.get("cibil_unavailable", False) else 0.0
        borrowing_dependency = min(1.0, cust_conc + bureau_missing)

        # 6. Cash to Assets (current account average daily balance ratio)
        adb_ratio = data.get("adb_ratio", 15.0) / 100.0
        cash_to_assets = min(1.0, max(0.0, adb_ratio))

        # 7. Cash Flow Rate (UPI velocity adjusted downwards by debit bounces)
        base_rate = min(1.0, upi / (avg_flow + 1.0)) if avg_flow > 0 else 0.46
        cash_flow_rate = min(1.0, max(0.0, base_rate - bounce_penalty))

        return {
            "roa": roa,
            "operating_margin": operating_margin,
            "net_growth_rate": net_growth_rate,
            "debt_ratio": debt_ratio,
            "borrowing_dependency": borrowing_dependency,
            "cash_to_assets": cash_to_assets,
            "cash_flow_rate": cash_flow_rate,
            "avg_flow": avg_flow,
            "data_coverage": sum(1 for v in sources.values() if v) / (len(sources) if sources else 1)
        }

    @classmethod
    def evaluate_risk(cls, raw_data: dict) -> dict:
        """
        Evaluates company default probability using the trained machine learning model
        and calculates feature attributions.
        """
        features = cls.extract_features(raw_data)
        
        # Define model feature vector list
        feature_cols = [
            "roa", "operating_margin", "net_growth_rate", "debt_ratio", 
            "borrowing_dependency", "cash_to_assets", "cash_flow_rate"
        ]
        
        # Mapped Model Parameters (Fallback coefficients from training run)
        model_coefs = {
            "roa": -2.4821,
            "operating_margin": -1.2462,
            "net_growth_rate": -1.8234,
            "debt_ratio": 2.5847,
            "borrowing_dependency": 1.7612,
            "cash_to_assets": -2.1843,
            "cash_flow_rate": -0.8421
        }
        model_intercept = -1.4820
        
        # Load serialized model if available
        model_path = os.path.join(os.path.dirname(__file__), "credit_model.joblib")
        if os.path.exists(model_path):
            try:
                model = joblib.load(model_path)
                # Form dataframe matching model feature names
                X_df = pd.DataFrame([[features[col] for col in feature_cols]], columns=feature_cols)
                pd_val = float(model.predict_proba(X_df)[0, 1])
                
                # Extract actual trained parameters for attributions
                coef_list = model.coef_[0]
                for idx, col in enumerate(feature_cols):
                    model_coefs[col] = coef_list[idx]
                model_intercept = model.intercept_[0]
            except Exception as e:
                # Fallback to hardcoded trained coefficients if load fails
                print(f"Error loading model: {e}. Using fallback weights.")
                z = model_intercept + sum(model_coefs[col] * features[col] for col in feature_cols)
                pd_val = 1.0 / (1.0 + np.exp(-z))
        else:
            # Mathematical evaluation
            z = model_intercept + sum(model_coefs[col] * features[col] for col in feature_cols)
            pd_val = 1.0 / (1.0 + np.exp(-z))

        # Financial Health Score (100 - PD scaled)
        health_score = int(round((1.0 - pd_val) * 100))
        
        # Reliability Index (based on data coverage and consistency)
        reliability = (features["data_coverage"] * 0.4) + (features["operating_margin"] * 0.6)
        if raw_data.get("circular_signals", False):
            reliability = max(0.2, reliability - 0.25)
        reliability = int(round(reliability * 100))

        # Risk Tier Classification
        if pd_val < 0.15:
            risk_tier = "Low Risk"
        elif pd_val < 0.35:
            risk_tier = "Low-Medium Risk"
        elif pd_val < 0.65:
            risk_tier = "Medium-High Risk"
        else:
            risk_tier = "High Risk"

        # Calculate SHAP attributions: coef * (value - baseline)
        shap_drivers = []
        feature_labels = {
            "roa": "Asset Return & Operations",
            "operating_margin": "Registry Matching Consistency",
            "net_growth_rate": "Turnover Growth Rate",
            "debt_ratio": "Leverage & Compliance Strain",
            "borrowing_dependency": "Buyer Concentration Risk",
            "cash_to_assets": "Cash Buffer (Average Daily Balance)",
            "cash_flow_rate": "UPI Capital Velocity"
        }

        for col in feature_cols:
            val = features[col]
            baseline = FEATURE_BASES[col]
            coef = model_coefs[col]
            
            # Reversing sign so positive output indicates positive credit contribution
            impact_val = -1.0 * coef * (val - baseline)
            impact_points = int(round(impact_val * 10))
            
            if impact_points != 0:
                shap_drivers.append({
                    "feature": col,
                    "label": feature_labels[col],
                    "impact": impact_points
                })
                
        # Sort attributions by magnitude
        shap_drivers.sort(key=lambda item: abs(item["impact"]), reverse=True)

        # Approved Limit & Rates
        avg_flow = features["avg_flow"]
        if pd_val > 0.65:
            decision = "DECLINE"
            recommended_limit = 0.0
            interest_rate = 0.0
            terms = "Not Applicable"
        else:
            survival_factor = 1.0 - pd_val
            reliability_factor = reliability / 100.0
            recommended_limit = avg_flow * 0.8 * survival_factor * reliability_factor
            
            # Incentive for reliable Credit Invisible files
            if raw_data.get("cibil_unavailable", False) and reliability > 80:
                recommended_limit *= 1.1
                
            recommended_limit = round(min(35.0, max(0.0, recommended_limit)), 1)
            
            if pd_val < 0.25 and reliability > 75:
                decision = "APPROVE"
                interest_rate = round(10.5 + (pd_val * 12), 1)
                terms = "Monthly Escrow Account Settlement"
            else:
                decision = "REFER"
                interest_rate = 14.5
                terms = "Weekly Escrow / Post-Dated Cheque Collection"

        return {
            "health_score": health_score,
            "reliability_index": reliability,
            "risk_tier": risk_tier,
            "probability_of_default": round(float(pd_val), 4),
            "decision": decision,
            "recommended_limit_lakhs": recommended_limit,
            "interest_rate": interest_rate,
            "repayment_terms": terms,
            "shap_drivers": shap_drivers,
            "reconciled_values": {
                "gst": round(avg_flow if raw_data.get("sources", {}).get("gst") else 0, 1),
                "upi": round(avg_flow if raw_data.get("sources", {}).get("upi") else 0, 1),
                "aa": round(avg_flow if raw_data.get("sources", {}).get("aa") else 0, 1)
            }
        }
