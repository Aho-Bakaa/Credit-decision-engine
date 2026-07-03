import pandas as pd
import numpy as np
import urllib.request
import os
import json

DATA_URLS = [
    "https://raw.githubusercontent.com/SayamAlt/Company-Bankruptcy-Prediction/main/data.csv",
    "https://raw.githubusercontent.com/Nehagarg816/Company-Bankruptcy-Prediction/master/data.csv",
    "https://raw.githubusercontent.com/ajayganti3/Company-Bankruptcy-Prediction/master/data.csv",
    "https://raw.githubusercontent.com/FedeCana00/Bankruptcy-prediction/main/data.csv"
]

# Columns map from UCI Taiwanese Bankruptcy dataset:
# Target: "Bankrupt?"
# Selected columns:
# 1. " ROA(C) before interest and depreciation before interest" -> ROA
# 2. " Operating Gross Margin" -> Margin
# 3. " Net Value Growth Rate" -> Growth
# 4. " Debt ratio %" -> Debt Ratio
# 5. " Borrowing dependency" -> Borrowing Dependency
# 6. " Cash/Total Assets" -> Liquidity
# 7. " Cash flow rate" -> Cash Flow

def run_eda():
    local_csv = os.path.join(os.path.dirname(__file__), "bankruptcy_data.csv")
    report_path = os.path.join(os.path.dirname(__file__), "eda_report.json")
    
    # 1. Download Dataset with Fallback
    downloaded = False
    if not os.path.exists(local_csv):
        for url in DATA_URLS:
            try:
                print(f"Attempting download from: {url}")
                urllib.request.urlretrieve(url, local_csv)
                print("Download complete.")
                downloaded = True
                break
            except Exception as e:
                print(f"Failed to download from {url}: {e}")
        if not downloaded:
            print("ERROR: All dataset download links failed.")
            return
    else:
        print("Using cached CSV file.")
    
    df = pd.read_csv(local_csv)
    
    # 2. Basic Shape and Missing Values
    rows, cols = df.shape
    missing_values = int(df.isnull().sum().sum())
    
    # 3. Target Distribution
    target_col = "Bankrupt?"
    bankrupt_counts = df[target_col].value_counts().to_dict()
    bankrupt_rate = float(df[target_col].mean())
    
    # 4. Correlations with Target
    correlations = df.corr()[target_col].drop(target_col)
    
    # Top 10 indicators positively correlated with Bankruptcy (risk factors)
    top_pos_corr = correlations.sort_values(ascending=False).head(10).to_dict()
    
    # Top 10 indicators negatively correlated with Bankruptcy (safety buffers)
    top_neg_corr = correlations.sort_values(ascending=True).head(10).to_dict()
    
    # 5. Core descriptive stats of selected features we plan to map
    selected_cols = [
        " ROA(C) before interest and depreciation before interest",
        " Operating Gross Margin",
        " Net Value Growth Rate",
        " Debt ratio %",
        " Borrowing dependency",
        " Cash/Total Assets",
        " Cash flow rate"
    ]
    
    stats_dict = {}
    for col in selected_cols:
        if col in df.columns:
            stats = df[col].describe().to_dict()
            stats_dict[col] = stats

    # Compile report
    report = {
        "dataset_shape": [rows, cols],
        "missing_values": missing_values,
        "default_rate": bankrupt_rate,
        "default_distribution": bankrupt_counts,
        "top_risk_correlations": top_pos_corr,
        "top_safety_correlations": top_neg_corr,
        "selected_features_descriptive": stats_dict
    }
    
    with open(report_path, "w") as f:
        json.dump(report, f, indent=4)
        
    print(f"EDA successfully completed. Report written to: {report_path}")

if __name__ == "__main__":
    run_eda()
