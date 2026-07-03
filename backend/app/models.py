from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class MSMEApplicant(Base):
    """
    Core ORM Model representing an MSME Credit Profile.
    Stores both raw operational data fetched via APIs and calculated AI indicators.
    """
    __tablename__ = "msme_applicants"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, index=True, nullable=False)
    pan = Column(String, unique=True, index=True, nullable=False)
    gstin = Column(String, nullable=True)
    
    # Raw Inputs (from Registries / APIs)
    cibil = Column(Integer, default=300)
    cibil_unavailable = Column(Boolean, default=False)
    gst_sales = Column(Float, default=0.0)
    upi_receipts = Column(Float, default=0.0)
    aa_deposits = Column(Float, default=0.0)
    growth_trend = Column(Float, default=0.0)
    employees = Column(Integer, default=0)
    
    # Source Availability Checklist
    sources_gst = Column(Boolean, default=False)
    sources_upi = Column(Boolean, default=False)
    sources_aa = Column(Boolean, default=False)
    sources_epfo = Column(Boolean, default=False)
    sources_utility = Column(Boolean, default=False)
    
    # Anomaly/Operational Flags
    vendor_delays = Column(Boolean, default=False)
    circular_signals = Column(Boolean, default=False)
    
    # New Commercial Current Account Risk Features
    bounce_rate = Column(Integer, default=0)
    customer_concentration = Column(Float, default=25.0)
    gst_delay_days = Column(Integer, default=0)
    od_utilization = Column(Float, default=0.0)
    adb_ratio = Column(Float, default=15.0)

    # Calculated Output Fields from Underwriting Engine (Saved for Audits)
    health_score = Column(Integer, nullable=True)
    reliability_index = Column(Integer, nullable=True)
    risk_tier = Column(String, nullable=True)
    probability_of_default = Column(Float, nullable=True)
    decision = Column(String, nullable=True)
    recommended_limit_lakhs = Column(Float, nullable=True)
    interest_rate = Column(Float, nullable=True)
    repayment_terms = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Human-in-the-Loop Audit Trails
    audit_trails = relationship("UnderwritingAuditTrail", back_populates="applicant", cascade="all, delete-orphan")


class UnderwritingAuditTrail(Base):
    """
    ORM Model for logging underwriter actions, custom limit overrides, 
    and general notes for credit committees.
    """
    __tablename__ = "underwriting_audit_trails"

    id = Column(Integer, primary_key=True, index=True)
    applicant_id = Column(Integer, ForeignKey("msme_applicants.id"), nullable=False)
    
    underwriter_name = Column(String, nullable=False)
    action_taken = Column(String, nullable=False) # e.g. "APPROVED", "OVERRIDDEN", "DECLINED"
    original_limit_lakhs = Column(Float, nullable=False)
    approved_limit_lakhs = Column(Float, nullable=False)
    override_reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    applicant = relationship("MSMEApplicant", back_populates="audit_trails")
