from pydantic import BaseModel, Field, constr
from typing import List, Optional
from datetime import datetime

class SourceChecklist(BaseModel):
    gst: bool = True
    upi: bool = True
    aa: bool = True
    epfo: bool = True
    utility: bool = False

class UnderwriteRequest(BaseModel):
    company_name: str = Field(..., min_length=2, description="Registered legal name of business")
    pan: constr(pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$") = Field(..., description="10-digit Indian Permanent Account Number")
    gstin: Optional[str] = Field(None, description="15-digit GSTIN ID")
    
    # Financial Inputs
    cibil: int = Field(720, ge=300, le=900, description="Traditional CIBIL bureau score")
    cibil_unavailable: bool = Field(False, description="Flag if NTC / Credit-invisible")
    gst_sales: float = Field(..., ge=0, description="Average monthly GST billing in Lakhs")
    upi_receipts: float = Field(..., ge=0, description="Average monthly merchant UPI inflows in Lakhs")
    aa_deposits: float = Field(..., ge=0, description="Average monthly bank statement deposits in Lakhs")
    growth_trend: float = Field(0.0, description="Revenue growth percentage over last 3 months")
    employees: int = Field(0, ge=0, description="Number of active payroll employees reported on EPFO")
    
    # Checklists & Flags
    sources: SourceChecklist
    vendor_delays: bool = Field(False, description="Flag for supplier payment delays (>30 days)")
    circular_signals: bool = Field(False, description="Flag representing circular invoice trading indicators")
    
    # New Commercial Current Account Risk Features
    bounce_rate: int = Field(0, ge=0, description="Cheque/EMI debit bounces in the last 90 days")
    customer_concentration: float = Field(25.0, ge=0.0, le=100.0, description="Percentage of sales concentration in top 3 clients")
    gst_delay_days: int = Field(0, ge=0, description="Average GST return filing delay in days")
    od_utilization: float = Field(0.0, ge=0.0, le=100.0, description="Overdraft/CC limit average utilization percentage")
    adb_ratio: float = Field(15.0, ge=0.0, le=100.0, description="Average daily balance ratio percentage relative to monthly turnover")

class ShapDriver(BaseModel):
    feature: str
    label: str
    impact: int

class ReconciledValues(BaseModel):
    gst: float
    upi: float
    aa: float

class UnderwriteResponse(BaseModel):
    id: int
    company_name: str
    pan: str
    health_score: int
    reliability_index: int
    risk_tier: str
    probability_of_default: float
    decision: str
    recommended_limit_lakhs: float
    interest_rate: float
    repayment_terms: str
    shap_drivers: List[ShapDriver]
    reconciled_values: ReconciledValues
    bounce_rate: int
    customer_concentration: float
    gst_delay_days: int
    od_utilization: float
    adb_ratio: float
    engineered_features: dict
    created_at: datetime

    class Config:
        from_attributes = True

class OverrideRequest(BaseModel):
    underwriter_name: str = Field(..., min_length=2)
    action_taken: str = Field(..., description="Must be APPROVE, DECLINE, or REFER")
    approved_limit_lakhs: float = Field(..., ge=0)
    override_reason: str = Field(..., min_length=10, description="Mandatory detailed reason for overriding AI limits")

class AuditTrailResponse(BaseModel):
    id: int
    applicant_id: int
    underwriter_name: str
    action_taken: str
    original_limit_lakhs: float
    approved_limit_lakhs: float
    override_reason: str
    timestamp: datetime

    class Config:
        from_attributes = True
