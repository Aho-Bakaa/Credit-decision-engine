from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import datetime

from .database import engine, get_db, Base, SessionLocal
from .models import MSMEApplicant, UnderwritingAuditTrail
from .schemas import UnderwriteRequest, UnderwriteResponse, OverrideRequest, AuditTrailResponse
from .engine import UnderwritingEngine

# Initialize SQLAlchemy Database Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Valkyrie Risk Intel - Underwriting Core",
    description="Trustworthy AI Credit Decision Engine for IDB Innovate Track 3.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def seed_database():
    """
    Seeds the SQLite database with 4 default presets representing authentic dummy data
    for the hackathon case studies, if the table is empty.
    """
    db = SessionLocal()
    try:
        if db.query(MSMEApplicant).count() == 0:
            presets = [
                {
                    "company_name": "S.R. Textiles",
                    "pan": "AAAPW9928M",
                    "cibil": 720,
                    "cibil_unavailable": True,
                    "gst_sales": 24.5,
                    "upi_receipts": 25.2,
                    "aa_deposits": 24.8,
                    "growth_trend": 5.0,
                    "employees": 12,
                    "sources": { "gst": True, "upi": True, "aa": True, "epfo": True, "utility": False },
                    "vendor_delays": False,
                    "circular_signals": False,
                    "bounce_rate": 0,
                    "customer_concentration": 18.0,
                    "gst_delay_days": 1,
                    "od_utilization": 0.0,
                    "adb_ratio": 24.0
                },
                {
                    "company_name": "Gopal Retailers Ltd",
                    "pan": "BCCPG8837K",
                    "cibil": 770,
                    "cibil_unavailable": False,
                    "gst_sales": 7.2,
                    "upi_receipts": 7.8,
                    "aa_deposits": 7.5,
                    "growth_trend": -40.0,
                    "employees": 9,
                    "sources": { "gst": True, "upi": True, "aa": True, "epfo": True, "utility": False },
                    "vendor_delays": True,
                    "circular_signals": False,
                    "bounce_rate": 4,
                    "customer_concentration": 45.0,
                    "gst_delay_days": 18,
                    "od_utilization": 88.0,
                    "adb_ratio": 2.0
                },
                {
                    "company_name": "AgroFarms Innovate",
                    "pan": "DDFPS4492A",
                    "cibil": 680,
                    "cibil_unavailable": False,
                    "gst_sales": 22.0,
                    "upi_receipts": 31.0,
                    "aa_deposits": 26.0,
                    "growth_trend": 15.0,
                    "employees": 4,
                    "sources": { "gst": True, "upi": True, "aa": True, "epfo": False, "utility": True },
                    "vendor_delays": False,
                    "circular_signals": False,
                    "bounce_rate": 1,
                    "customer_concentration": 32.0,
                    "gst_delay_days": 2,
                    "od_utilization": 35.0,
                    "adb_ratio": 12.0
                },
                {
                    "company_name": "Apex Trading Shell",
                    "pan": "EEEPX1002G",
                    "cibil": 710,
                    "cibil_unavailable": False,
                    "gst_sales": 14.8,
                    "upi_receipts": 1.2,
                    "aa_deposits": 14.6,
                    "growth_trend": 2.0,
                    "employees": 2,
                    "sources": { "gst": True, "upi": True, "aa": True, "epfo": False, "utility": False },
                    "vendor_delays": False,
                    "circular_signals": True,
                    "bounce_rate": 0,
                    "customer_concentration": 95.0,
                    "gst_delay_days": 0,
                    "od_utilization": 10.0,
                    "adb_ratio": 50.0
                }
            ]

            for p in presets:
                res = UnderwritingEngine.evaluate_risk(p)
                db_app = MSMEApplicant(
                    company_name=p["company_name"],
                    pan=p["pan"],
                    cibil=p["cibil"],
                    cibil_unavailable=p["cibil_unavailable"],
                    gst_sales=p["gst_sales"],
                    upi_receipts=p["upi_receipts"],
                    aa_deposits=p["aa_deposits"],
                    growth_trend=p["growth_trend"],
                    employees=p["employees"],
                    sources_gst=p["sources"]["gst"],
                    sources_upi=p["sources"]["upi"],
                    sources_aa=p["sources"]["aa"],
                    sources_epfo=p["sources"]["epfo"],
                    sources_utility=p["sources"]["utility"],
                    vendor_delays=p["vendor_delays"],
                    circular_signals=p["circular_signals"],
                    bounce_rate=p["bounce_rate"],
                    customer_concentration=p["customer_concentration"],
                    gst_delay_days=p["gst_delay_days"],
                    od_utilization=p["od_utilization"],
                    adb_ratio=p["adb_ratio"],
                    
                    health_score=res["health_score"],
                    reliability_index=res["reliability_index"],
                    risk_tier=res["risk_tier"],
                    probability_of_default=res["probability_of_default"],
                    decision=res["decision"],
                    recommended_limit_lakhs=res["recommended_limit_lakhs"],
                    interest_rate=res["interest_rate"],
                    repayment_terms=res["repayment_terms"]
                )
                db.add(db_app)
            db.commit()
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

# Run database seed procedure
seed_database()

@app.post("/api/underwrite", response_model=UnderwriteResponse, status_code=status.HTTP_201_CREATED)
def underwrite_applicant(request: UnderwriteRequest, db: Session = Depends(get_db)):
    """
    Core Underwriting endpoint. Takes raw operational indicators, executes 
    dynamic feature normalization, evaluates risk tiers via the logistic engine, 
    persists results to the database, and returns calculations.
    """
    try:
        # Run mathematical scoring engine (no hardcoded filters/rules)
        raw_dict = request.model_dump()
        result = UnderwritingEngine.evaluate_risk(raw_dict)
        
        # Save to database
        db_applicant = MSMEApplicant(
            company_name=request.company_name,
            pan=request.pan,
            gstin=request.gstin,
            cibil=request.cibil,
            cibil_unavailable=request.cibil_unavailable,
            gst_sales=request.gst_sales,
            upi_receipts=request.upi_receipts,
            aa_deposits=request.aa_deposits,
            growth_trend=request.growth_trend,
            employees=request.employees,
            sources_gst=request.sources.gst,
            sources_upi=request.sources.upi,
            sources_aa=request.sources.aa,
            sources_epfo=request.sources.epfo,
            sources_utility=request.sources.utility,
            vendor_delays=request.vendor_delays,
            circular_signals=request.circular_signals,
            bounce_rate=request.bounce_rate,
            customer_concentration=request.customer_concentration,
            gst_delay_days=request.gst_delay_days,
            od_utilization=request.od_utilization,
            adb_ratio=request.adb_ratio,
            
            # Scores & Outputs
            health_score=result["health_score"],
            reliability_index=result["reliability_index"],
            risk_tier=result["risk_tier"],
            probability_of_default=result["probability_of_default"],
            decision=result["decision"],
            recommended_limit_lakhs=result["recommended_limit_lakhs"],
            interest_rate=result["interest_rate"],
            repayment_terms=result["repayment_terms"]
        )
        
        db.add(db_applicant)
        db.commit()
        db.refresh(db_applicant)
        
        # Build Response model matching Pydantic schema
        return UnderwriteResponse(
            id=db_applicant.id,
            company_name=db_applicant.company_name,
            pan=db_applicant.pan,
            health_score=db_applicant.health_score,
            reliability_index=db_applicant.reliability_index,
            risk_tier=db_applicant.risk_tier,
            probability_of_default=db_applicant.probability_of_default,
            decision=db_applicant.decision,
            recommended_limit_lakhs=db_applicant.recommended_limit_lakhs,
            interest_rate=db_applicant.interest_rate,
            repayment_terms=db_applicant.repayment_terms,
            shap_drivers=result["shap_drivers"],
            reconciled_values=result["reconciled_values"],
            bounce_rate=db_applicant.bounce_rate,
            customer_concentration=db_applicant.customer_concentration,
            gst_delay_days=db_applicant.gst_delay_days,
            od_utilization=db_applicant.od_utilization,
            adb_ratio=db_applicant.adb_ratio,
            created_at=db_applicant.created_at
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Underwriting engine error: {str(e)}"
        )

@app.get("/api/applications", response_model=List[UnderwriteResponse])
def get_all_applications(db: Session = Depends(get_db)):
    """
    Fetches the history of all processed MSME underwriting files.
    """
    applicants = db.query(MSMEApplicant).order_by(MSMEApplicant.created_at.desc()).all()
    
    responses = []
    for app in applicants:
        raw_dict = {
            "gst_sales": app.gst_sales,
            "upi_receipts": app.upi_receipts,
            "aa_deposits": app.aa_deposits,
            "growth_trend": app.growth_trend,
            "employees": app.employees,
            "cibil": app.cibil,
            "cibil_unavailable": app.cibil_unavailable,
            "circular_signals": app.circular_signals,
            "vendor_delays": app.vendor_delays,
            "bounce_rate": app.bounce_rate,
            "customer_concentration": app.customer_concentration,
            "gst_delay_days": app.gst_delay_days,
            "od_utilization": app.od_utilization,
            "adb_ratio": app.adb_ratio,
            "sources": {
                "gst": app.sources_gst,
                "upi": app.sources_upi,
                "aa": app.sources_aa,
                "epfo": app.sources_epfo,
                "utility": app.sources_utility
            }
        }
        eval_res = UnderwritingEngine.evaluate_risk(raw_dict)
        
        responses.append(UnderwriteResponse(
            id=app.id,
            company_name=app.company_name,
            pan=app.pan,
            health_score=app.health_score,
            reliability_index=app.reliability_index,
            risk_tier=app.risk_tier,
            probability_of_default=app.probability_of_default,
            decision=app.decision,
            recommended_limit_lakhs=app.recommended_limit_lakhs,
            interest_rate=app.interest_rate,
            repayment_terms=app.repayment_terms,
            shap_drivers=eval_res["shap_drivers"],
            reconciled_values=eval_res["reconciled_values"],
            bounce_rate=app.bounce_rate,
            customer_concentration=app.customer_concentration,
            gst_delay_days=app.gst_delay_days,
            od_utilization=app.od_utilization,
            adb_ratio=app.adb_ratio,
            created_at=app.created_at
        ))
    return responses

@app.get("/api/applications/{id}", response_model=UnderwriteResponse)
def get_application_details(id: int, db: Session = Depends(get_db)):
    """
    Fetches the details of a single underwriting application.
    """
    app = db.query(MSMEApplicant).filter(MSMEApplicant.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application record not found")
        
    raw_dict = {
        "gst_sales": app.gst_sales,
        "upi_receipts": app.upi_receipts,
        "aa_deposits": app.aa_deposits,
        "growth_trend": app.growth_trend,
        "employees": app.employees,
        "cibil": app.cibil,
        "cibil_unavailable": app.cibil_unavailable,
        "circular_signals": app.circular_signals,
        "vendor_delays": app.vendor_delays,
        "bounce_rate": app.bounce_rate,
        "customer_concentration": app.customer_concentration,
        "gst_delay_days": app.gst_delay_days,
        "od_utilization": app.od_utilization,
        "adb_ratio": app.adb_ratio,
        "sources": {
            "gst": app.sources_gst,
            "upi": app.sources_upi,
            "aa": app.sources_aa,
            "epfo": app.sources_epfo,
            "utility": app.sources_utility
        }
    }
    eval_res = UnderwritingEngine.evaluate_risk(raw_dict)
    
    return UnderwriteResponse(
        id=app.id,
        company_name=app.company_name,
        pan=app.pan,
        health_score=app.health_score,
        reliability_index=app.reliability_index,
        risk_tier=app.risk_tier,
        probability_of_default=app.probability_of_default,
        decision=app.decision,
        recommended_limit_lakhs=app.recommended_limit_lakhs,
        interest_rate=app.interest_rate,
        repayment_terms=app.repayment_terms,
        shap_drivers=eval_res["shap_drivers"],
        reconciled_values=eval_res["reconciled_values"],
        bounce_rate=app.bounce_rate,
        customer_concentration=app.customer_concentration,
        gst_delay_days=app.gst_delay_days,
        od_utilization=app.od_utilization,
        adb_ratio=app.adb_ratio,
        created_at=app.created_at
    )

@app.post("/api/applications/{id}/override", response_model=AuditTrailResponse)
def override_credit_decision(id: int, request: OverrideRequest, db: Session = Depends(get_db)):
    """
    Human-in-the-Loop Override endpoint. Allows certified underwriters to adjust 
    limits or decisions. Requires mandatory detailed audit logging.
    """
    app = db.query(MSMEApplicant).filter(MSMEApplicant.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application record not found")
        
    try:
        original_limit = app.recommended_limit_lakhs
        
        # Save Audit record
        audit_log = UnderwritingAuditTrail(
            applicant_id=app.id,
            underwriter_name=request.underwriter_name,
            action_taken=request.action_taken,
            original_limit_lakhs=original_limit,
            approved_limit_lakhs=request.approved_limit_lakhs,
            override_reason=request.override_reason
        )
        
        app.recommended_limit_lakhs = request.approved_limit_lakhs
        app.decision = request.action_taken
        
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        
        return AuditTrailResponse(
            id=audit_log.id,
            applicant_id=audit_log.applicant_id,
            underwriter_name=audit_log.underwriter_name,
            action_taken=audit_log.action_taken,
            original_limit_lakhs=audit_log.original_limit_lakhs,
            approved_limit_lakhs=audit_log.approved_limit_lakhs,
            override_reason=audit_log.override_reason,
            timestamp=audit_log.timestamp
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database logging error: {str(e)}")

@app.get("/api/applications/{id}/audit", response_model=List[AuditTrailResponse])
def get_audit_trail(id: int, db: Session = Depends(get_db)):
    """
    Fetches the history of all manual override edits performed on this application.
    """
    audits = db.query(UnderwritingAuditTrail).filter(UnderwritingAuditTrail.applicant_id == id).order_by(UnderwritingAuditTrail.timestamp.desc()).all()
    return audits
