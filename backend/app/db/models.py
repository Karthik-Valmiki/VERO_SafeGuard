from sqlalchemy import Column, String, Boolean, DateTime, Integer, Numeric, ForeignKey, BigInteger, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from .database import Base


class CityBenchmark(Base):
    __tablename__ = "city_benchmarks"
    city_id = Column(Integer, primary_key=True)
    city_name = Column(String(50), unique=True)
    baseline_weekly_income = Column(Numeric(10, 2))
    baseline_active_hours = Column(Numeric(5, 2))
    default_risk_multiplier = Column(Numeric(5, 2), default=1.0)


class GeoZone(Base):
    __tablename__ = "geo_zones"
    zone_id = Column(Integer, primary_key=True)
    city_id = Column(Integer, ForeignKey('city_benchmarks.city_id'))
    zone_name = Column(String(100))
    base_risk_multiplier = Column(Numeric(5, 2), default=1.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OtpStore(Base):
    """Simulated OTP — no real SMS. OTP returned in response for demo."""
    __tablename__ = "otp_store"
    phone_number = Column(String(15), primary_key=True)
    otp_code = Column(String(6))
    expires_at = Column(DateTime(timezone=True))
    is_used = Column(Boolean, default=False)


class RiderProfile(Base):
    __tablename__ = "rider_profiles"
    profile_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(100))
    phone_number = Column(String(15), unique=True)
    hashed_password = Column(String)
    platform = Column(String(50))
    city_id = Column(Integer, ForeignKey('city_benchmarks.city_id'))
    shift_hours = Column(JSONB)
    reliability_score = Column(Numeric(3, 2), default=0.00)
    is_verified = Column(Boolean, default=False)
    upi_id = Column(String(100))
    total_payouts_received = Column(Numeric(10, 2), default=0.00)
    total_premium_paid = Column(Numeric(10, 2), default=0.00)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RiderZone(Base):
    __tablename__ = "rider_zones"
    profile_id = Column(UUID(as_uuid=True), ForeignKey('rider_profiles.profile_id'), primary_key=True)
    zone_id = Column(Integer, ForeignKey('geo_zones.zone_id'), primary_key=True)
    is_primary = Column(Boolean, default=False)


class RiderPerformanceHistory(Base):
    __tablename__ = "rider_performance_history"
    history_id = Column(BigInteger, primary_key=True, autoincrement=True)
    profile_id = Column(UUID(as_uuid=True), ForeignKey('rider_profiles.profile_id'))
    week_start_date = Column(Date)
    time_utilization = Column(Numeric(3, 2))
    delivery_efficiency = Column(Numeric(3, 2))
    completion_rate = Column(Numeric(3, 2))
    final_r_score = Column(Numeric(3, 2))


class Policy(Base):
    __tablename__ = "policies"
    policy_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey('rider_profiles.profile_id'))
    premium_amount = Column(Numeric(10, 2))
    coverage_ratio = Column(Numeric(3, 2))
    r_factor_at_purchase = Column(Numeric(3, 2))
    purchased_at = Column(DateTime(timezone=True), server_default=func.now())
    activated_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    status = Column(String(20), default='PENDING')
    is_surcharge_applied = Column(Boolean, default=False)


class TriggerEvent(Base):
    __tablename__ = "trigger_events"
    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(Integer, ForeignKey('geo_zones.zone_id'))
    metric_type = Column(String(30))
    event_metadata = Column(JSONB)
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)


class Payout(Base):
    __tablename__ = "payouts"
    payout_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id = Column(UUID(as_uuid=True), ForeignKey('policies.policy_id'))
    event_id = Column(UUID(as_uuid=True), ForeignKey('trigger_events.event_id'))
    amount = Column(Numeric(10, 2))
    status = Column(String(20), default='SUCCESS')
    processed_at = Column(DateTime(timezone=True), server_default=func.now())


class RiderActivityLog(Base):
    __tablename__ = "rider_activity_logs"
    log_id = Column(BigInteger, primary_key=True, autoincrement=True)
    profile_id = Column(UUID(as_uuid=True), ForeignKey('rider_profiles.profile_id'))
    activity_type = Column(String(20))
    zone_id = Column(Integer, ForeignKey('geo_zones.zone_id'))
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
