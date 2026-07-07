import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score
import joblib
import os

def generate_synthetic_data(n_samples=2000):
    np.random.seed(42)
    
    # 1. Data Coverage
    data_coverage = np.random.uniform(0.2, 1.0, n_samples)
    
    # 2. Source Variance
    source_variance = np.clip(np.random.normal(0.15, 0.12, n_samples), 0.0, 1.0)
    
    # 3. Revenue Trend
    revenue_trend = np.clip(np.random.normal(0.05, 0.15, n_samples), -0.5, 0.5)
    
    # 4. Payroll Intensity
    payroll_intensity = np.random.uniform(0.0, 1.0, n_samples)
    
    # 5. CIBIL Bureau Records
    cibil_missing = np.random.choice([0.0, 1.0], size=n_samples, p=[0.85, 0.15])
    cibil_score = np.zeros(n_samples)
    for i in range(n_samples):
        if cibil_missing[i] == 1.0:
            cibil_score[i] = 0.5
        else:
            cibil_score[i] = np.random.uniform(0.2, 1.0)
            
    # 6. Operational Flags
    circular_trading = np.random.choice([0.0, 1.0], size=n_samples, p=[0.96, 0.04])
    vendor_delay = np.random.choice([0.0, 1.0], size=n_samples, p=[0.88, 0.12])
    
    # Target Generation (Probability of Default log-odds representation)
    # Weights match commercial lending risk factors
    z = (
        -1.5 
        - 1.2 * data_coverage 
        + 2.6 * source_variance 
        - 1.8 * revenue_trend 
        - 0.8 * payroll_intensity 
        - 2.4 * cibil_score 
        + 0.5 * cibil_missing 
        + 4.6 * circular_trading 
        + 1.5 * vendor_delay
    )
    
    # Add random noise
    noise = np.random.normal(0.0, 0.5, n_samples)
    prob_default = 1.0 / (1.0 + np.exp(-(z + noise)))
    defaulted = (prob_default > 0.5).astype(int)
    
    df = pd.DataFrame({
        "data_coverage": data_coverage,
        "source_variance": source_variance,
        "revenue_trend": revenue_trend,
        "payroll_intensity": payroll_intensity,
        "cibil_score": cibil_score,
        "cibil_missing": cibil_missing,
        "circular_trading": circular_trading,
        "vendor_delay": vendor_delay,
        "defaulted": defaulted
    })
    
    return df

def train_and_save():
    df = generate_synthetic_data(2000)
    
    X = df.drop(columns=["defaulted"])
    y = df["defaulted"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    
    # Fit Logistic Regression model with balanced class weight for commercial defaults
    model = LogisticRegression(class_weight='balanced', solver='liblinear', random_state=42)
    model.fit(X_train, y_train)
    
    train_preds = model.predict(X_train)
    test_preds = model.predict(X_test)
    test_probs = model.predict_proba(X_test)[:, 1]
    
    train_acc = accuracy_score(y_train, train_preds)
    test_acc = accuracy_score(y_test, test_preds)
    auc_score = roc_auc_score(y_test, test_probs)
    
    print("=== MODEL TRAINING COMPLETED ===")
    print(f"Train Accuracy: {train_acc:.4f}")
    print(f"Test Accuracy:  {test_acc:.4f}")
    print(f"Test ROC-AUC:   {auc_score:.4f}")
    print(f"Model Intercept: {model.intercept_[0]:.4f}")
    print("Model Coefficients:")
    for feature, coef in zip(X.columns, model.coef_[0]):
        print(f"  {feature}: {coef:.4f}")
        
    # Serialize the trained model containing both model and baselines
    model_bundle = {
        "model": model,
        "feature_cols": list(X.columns),
        "feature_baselines": X.mean().to_dict(),
        "coefs": {col: float(coef) for col, coef in zip(X.columns, model.coef_[0])},
        "intercept": float(model.intercept_[0]),
        "metrics": {
            "train_accuracy": float(train_acc),
            "test_accuracy": float(test_acc),
            "test_auc": float(auc_score)
        }
    }
    save_path = os.path.join(os.path.dirname(__file__), "credit_model.joblib")
    joblib.dump(model_bundle, save_path)
    print(f"Model successfully saved to: {save_path}")

if __name__ == "__main__":
    train_and_save()
