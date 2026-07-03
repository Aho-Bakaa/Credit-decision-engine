import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score
import joblib
import os
import urllib.request

DATA_URL = "https://raw.githubusercontent.com/FedeCana00/Bankruptcy-prediction/master/data.csv"

# Columns map from UCI Taiwanese Bankruptcy dataset:
# Target: "Bankrupt?"
# Feature columns:
# 1. " ROA(C) before interest and depreciation before interest" -> ROA
# 2. " Operating Gross Margin" -> Margin
# 3. " Net Value Growth Rate" -> Net Value Growth
# 4. " Debt ratio %" -> Debt Ratio
# 5. " Borrowing dependency" -> Borrowing Dependency
# 6. " Cash/Total Assets" -> Liquidity
# 7. " Cash flow rate" -> Cash Flow

COLUMN_MAPPING = {
    "Bankrupt?": "bankrupt",
    " ROA(C) before interest and depreciation before interest": "roa",
    " Operating Gross Margin": "operating_margin",
    " Net Value Growth Rate": "net_growth_rate",
    " Debt ratio %": "debt_ratio",
    " Borrowing dependency": "borrowing_dependency",
    " Cash/Total Assets": "cash_to_assets",
    " Cash flow rate": "cash_flow_rate"
}

def train_model():
    print(f"Downloading corporate credit risk dataset from: {DATA_URL}")
    local_csv = os.path.join(os.path.dirname(__file__), "bankruptcy_data.csv")
    
    try:
        # Download data if not already cached
        if not os.path.exists(local_csv):
            urllib.request.urlretrieve(DATA_URL, local_csv)
            print("Download complete.")
        else:
            print("Using cached CSV file.")
            
        df = pd.read_csv(local_csv)
        print(f"Dataset loaded: {df.shape[0]} rows, {df.shape[1]} columns.")
        
        # Verify columns exist
        missing_cols = [c for c in COLUMN_MAPPING.keys() if c not in df.columns]
        if missing_cols:
            raise KeyError(f"Missing required columns in dataset: {missing_cols}")
            
        # Select and rename columns
        df_sub = df[list(COLUMN_MAPPING.keys())].rename(columns=COLUMN_MAPPING)
        
        # Split features and target
        X = df_sub.drop(columns=["bankrupt"])
        y = df_sub["bankrupt"]
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42, stratify=y
        )
        
        # Fit model using balanced class weights (bankruptcy is rare, ~3%)
        model = LogisticRegression(class_weight="balanced", solver="liblinear", random_state=42)
        model.fit(X_train, y_train)
        
        # Validate model
        train_preds = model.predict(X_train)
        test_preds = model.predict(X_test)
        test_probs = model.predict_proba(X_test)[:, 1]
        
        train_acc = accuracy_score(y_train, train_preds)
        test_acc = accuracy_score(y_test, test_preds)
        auc_score = roc_auc_score(y_test, test_probs)
        
        print("\n=== MODEL METRICS (Trained on Real Corporate Data) ===")
        print(f"Train Accuracy: {train_acc:.4f}")
        print(f"Test Accuracy:  {test_acc:.4f}")
        print(f"Test ROC-AUC:   {auc_score:.4f}")
        print(f"Intercept:      {model.intercept_[0]:.4f}")
        print("Coefficients:")
        for feature, coef in zip(X.columns, model.coef_[0]):
            print(f"  {feature}: {coef:.4f}")
            
        # Serialize model
        save_path = os.path.join(os.path.dirname(__file__), "credit_model.joblib")
        joblib.dump(model, save_path)
        print(f"\nModel successfully saved to: {save_path}")
        
    except Exception as e:
        print(f"Error during training pipeline: {e}")

if __name__ == "__main__":
    train_model()
