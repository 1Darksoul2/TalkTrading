import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.reel import Reel, ReelStatus
from app.models.moderation import ReelReport, ModerationLog, ReportReason, ReportStatus
from app.schemas.moderation import ReportCreate, ModerationAction


class ModerationService:
    # Basic word list for automatic profanity flag
    BLOCKED_KEYWORDS = ["scam_token_url", "illegal_substance_market", "violent_threat_keyword"]

    @classmethod
    def check_text_for_violations(cls, text: Optional[str]) -> bool:
        if not text:
            return False
        lower_text = text.lower()
        for kw in cls.BLOCKED_KEYWORDS:
            if kw in lower_text:
                return True
        return False

    @staticmethod
    def report_reel(db: Session, reel_id: str, reporter_id: str, report_in: ReportCreate) -> ReelReport:
        reel = db.query(Reel).filter(Reel.id == reel_id).first()
        if not reel:
            raise HTTPException(status_code=404, detail="Reel not found")

        # Check if already reported by this user
        existing = db.query(ReelReport).filter_by(
            reel_id=reel_id,
            reporter_user_id=reporter_id,
            status=ReportStatus.PENDING
        ).first()
        if existing:
            return existing

        report = ReelReport(
            id=str(uuid.uuid4()),
            reel_id=reel_id,
            reporter_user_id=reporter_id,
            reason=report_in.reason,
            description=report_in.description,
            status=ReportStatus.PENDING
        )
        db.add(report)

        # Count pending reports to auto-flag if threshold exceeded
        report_count = db.query(ReelReport).filter_by(reel_id=reel_id, status=ReportStatus.PENDING).count()
        if report_count >= 5 and reel.status == ReelStatus.ACTIVE:
            reel.status = ReelStatus.UNDER_REVIEW

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_reports(db: Session, status_filter: Optional[str] = None, limit: int = 50) -> List[ReelReport]:
        query = db.query(ReelReport)
        if status_filter:
            query = query.filter(ReelReport.status == status_filter)
        return query.order_by(ReelReport.created_at.desc()).limit(limit).all()

    @staticmethod
    def apply_moderation_action(db: Session, reel_id: str, moderator_id: str, action_in: ModerationAction) -> Reel:
        reel = db.query(Reel).filter(Reel.id == reel_id).first()
        if not reel:
            raise HTTPException(status_code=404, detail="Reel not found")

        reel.status = action_in.new_reel_status

        # Create audit log
        log = ModerationLog(
            id=str(uuid.uuid4()),
            reel_id=reel_id,
            moderator_id=moderator_id,
            action=action_in.action,
            reason=action_in.reason
        )
        db.add(log)

        # Mark pending reports as resolved
        reports = db.query(ReelReport).filter_by(reel_id=reel_id, status=ReportStatus.PENDING).all()
        for r in reports:
            r.status = ReportStatus.RESOLVED
            r.resolved_at = datetime.utcnow()
            r.reviewed_by = moderator_id
            r.resolution_notes = f"Action taken: {action_in.action}"

        db.commit()
        db.refresh(reel)
        return reel
