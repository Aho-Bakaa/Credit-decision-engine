import pandas as pd
import numpy as np
import urllib.request
import os

# Config paths
CURRENT_DIR = os.path.dirname(__file__)
RAW_DATA_URL = "https://raw.githubusercontent.com/yugjagtap/Taiwanese-Bankruptcy-Prediction/main/Taiwanese%20Bankruptcy%20Prediction.csv"
RAW_DATA_PATH = os.path.join(CURRENT_DIR, "bankruptcy_data.csv")
ENGINEERED_DATA_PATH = os.path.join(CURRENT_DIR, "engineered_credit_dataset.csv")

def fetch_and_engineer():
    print("=== STARTING STANDALONE DATA INGESTION & FEATURE ENGINEERING FLOW ===")
    
    # 1. Fetch data from the web (download if not cached)
    if not os.path.exists(RAW_DATA_PATH):
        print(f"Downloading raw dataset from public repository link:\n  {RAW_DATA_URL}")
        try:
            urllib.request.urlretrieve(RAW_DATA_URL, RAW_DATA_PATH)
            print("  Raw dataset downloaded successfully.")
        except Exception as e:
            print(f"  Error downloading data: {e}")
            return
    else:
        print("Raw dataset found in local cache.")

    # Load raw data
    df = pd.read_csv(RAW_DATA_PATH)
    print(f"Loaded raw dataset with {df.shape[0]} rows and {df.shape[1]} columns.")

    # 2. Extract target features and engineer them
    print("\nEngineering the 7 selected financial ratio features...")
    engineered_df = pd.DataFrame()
    
    # Copy target
    engineered_df["Bankrupt?"] = df["Bankrupt?"]

    # Feature 1: ROA (Return on Assets)
    engineered_df["roa"] = df[" ROA(C) before interest and depreciation before interest"]

    # Feature 2: Operating Margin
    engineered_df["operating_margin"] = df[" Operating Gross Margin"]

    # Feature 3: Net Growth Rate (With Outlier Clipping)
    raw_growth = df[" Net Value Growth Rate"]
    upper_clip = 0.001  # 95th percentile
    min_growth = raw_growth.min()
    
    print(f"  Transforming 'Net Value Growth Rate'...")
    print(f"    Raw stats -> Min: {min_growth:.6f}, Max: {raw_growth.max():.1f}, Mean: {raw_growth.mean():.4f}")
    
    # Apply clipping
    clipped_growth = raw_growth.clip(upper=upper_clip)
    # Apply min-max scaling to scale to 0.0 - 1.0
    engineered_df["net_growth_rate"] = (clipped_growth - min_growth) / (upper_clip - min_growth)
    
    print(f"    Engineered stats -> Min: {engineered_df['net_growth_rate'].min():.1f}, Max: {engineered_df['net_growth_rate'].max():.1f}, Mean: {engineered_df['net_growth_rate'].mean():.4f}")

    # Feature 4: Debt Ratio
    engineered_df["debt_ratio"] = df[" Debt ratio %"]

    # Feature 5: Borrowing Dependency
    engineered_df["borrowing_dependency"] = df[" Borrowing dependency"]

    # Feature 6: Cash to Total Assets
    engineered_df["cash_to_assets"] = df[" Cash/Total Assets"]

    # Feature 7: Cash Flow Rate
    engineered_df["cash_flow_rate"] = df[" Cash flow rate"]

    # 3. Save engineered training dataset
    print(f"\nSaving preprocessed and engineered dataset to:\n  {ENGINEERED_DATA_PATH}")
    engineered_df.to_csv(ENGINEERED_DATA_PATH, index=False)
    
    # Print engineered dataset description
    print("\nEngineered Dataset Summary Statistics:")
    print(engineered_df.describe().to_string())
    
    print("\nPreview of first 5 rows of engineered features:")
    print(engineered_df.head(5).to_string())
    
    print("\n=== DATA ENGINEERING FLOW COMPLETED ===")

if __name__ == "__main__":
    fetch_and_engineer()
