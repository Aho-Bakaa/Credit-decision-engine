import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score
import joblib
import os

# Paths configuration
CURRENT_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(CURRENT_DIR, "bankruptcy_data.csv")
MODEL_PATH = os.path.join(CURRENT_DIR, "credit_model.joblib")

def execute_feature_engineering_pipeline():
    print("=== STARTING FEATURE ENGINEERING PIPELINE ===")
    
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Source dataset not found at {DATA_PATH}. Run eda_sandbox.py first.")
        
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded raw dataset with shape: {df.shape}")
    
    # 1. Target Column Check
    y = df["Bankrupt?"]
    
    # 2. Custom Feature Engineering & Transformation
    X_engineered = pd.DataFrame()
    
    print("\n[Step 1/3] Extracting & Normalizing Financial Features...")
    
    # Feature 1 & 2: ROA & Operating Margins (Values are pre-scaled 0.0-1.0 in source)
    X_engineered["roa"] = df[" ROA(C) before interest and depreciation before interest"]
    X_engineered["operating_margin"] = df[" Operating Gross Margin"]
    
    # Feature 3: Net Value Growth Rate (Contains massive outlier skewness)
    # Applying clip-scaling based on the 95th percentile (0.001) as identified in EDA
    raw_growth = df[" Net Value Growth Rate"]
    upper_clip = 0.001
    min_growth = raw_growth.min()
    
    print(f"  Cleaning Net Value Growth Rate (Min: {min_growth:.6f}, Max: {raw_growth.max():.1f})")
    clipped_growth = raw_growth.clip(upper=upper_clip)
    # Scale between 0.0 and 1.0
    X_engineered["net_growth_rate"] = (clipped_growth - min_growth) / (upper_clip - min_growth)
    print(f"  Growth rate successfully transformed. Engineered Range: [{X_engineered['net_growth_rate'].min():.1f}, {X_engineered['net_growth_rate'].max():.1f}]")
    
    # Feature 4, 5, 6, 7: Leverage and Liquidity metrics
    X_engineered["debt_ratio"] = df[" Debt ratio %"]
    X_engineered["borrowing_dependency"] = df[" Borrowing dependency"]
    X_engineered["cash_to_assets"] = df[" Cash/Total Assets"]
    X_engineered["cash_flow_rate"] = df[" Cash flow rate"]
    
    print("\n[Step 2/3] Preparing Training and Testing Splits...")
    # Train-test split (Stratified on target due to 3.2% class imbalance)
    X_train, X_test, y_train, y_test = train_test_split(
        X_engineered, y, test_size=0.25, random_state=42, stratify=y
    )
    
    print(f"  Training Set: {X_train.shape[0]} samples (Defaulted: {y_train.sum()})")
    print(f"  Testing Set:  {X_test.shape[0]} samples (Defaulted: {y_test.sum()})")
    
    print("\n[Step 3/3] Training Logistic Regression Classifier (Balanced Class Weights)...")
    # Training
    model = LogisticRegression(class_weight="balanced", solver="liblinear", random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluation
    train_preds = model.predict(X_train)
    test_preds = model.predict(X_test)
    test_probs = model.predict_proba(X_test)[:, 1]
    
    train_acc = accuracy_score(y_train, train_preds)
    test_acc = accuracy_score(y_test, test_preds)
    auc_score = roc_auc_score(y_test, test_probs)
    
    print("\n=== PIPELINE FITTING METRICS ===")
    print(f"Model Intercept: {model.intercept_[0]:.4f}")
    print("Feature Coefficients:")
    for col, coef in zip(X_engineered.columns, model.coef_[0]):
        print(f"  {col:<20} : {coef:.4f}")
        
    print(f"\nValidation Accuracy: {test_acc:.4f} (Baseline: {accuracy_score(y_test, np.zeros_like(y_test)):.4f})")
    print(f"Validation ROC-AUC:  {auc_score:.4f}")
    
    # Save Pipeline file containing both model and baselines
    model_bundle = {
        "model": model,
        "feature_cols": list(X_engineered.columns),
        "feature_baselines": X_engineered.mean().to_dict(),
        "coefs": {col: float(coef) for col, coef in zip(X_engineered.columns, model.coef_[0])},
        "intercept": float(model.intercept_[0]),
        "metrics": {
            "train_accuracy": float(train_acc),
            "test_accuracy": float(test_acc),
            "test_auc": float(auc_score)
        }
    }
    joblib.dump(model_bundle, MODEL_PATH)
    print(f"\nCleaned model pipeline saved to: {MODEL_PATH}")
    print("=== FEATURE ENGINEERING PIPELINE COMPLETED ===")

if __name__ == "__main__":
    execute_feature_engineering_pipeline()
