import re
from pydantic import BaseModel, Field, field_validator

SUPPORTED_CITIES = [
    "Bengaluru", "Chennai", "Mumbai", "Delhi", "Gurgaon",
    "Hyderabad", "Vizag", "Pune", "Kolkata", "Ahmedabad"
]
SUPPORTED_PLATFORMS = ["Zomato", "Swiggy"]


class OtpRequest(BaseModel):
    phone_number: str = Field(..., pattern=r"^\+91\d{10}$")


class OtpVerify(BaseModel):
    phone_number: str = Field(..., pattern=r"^\+91\d{10}$")
    otp_code: str = Field(..., min_length=6, max_length=6)


class RiderCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone_number: str = Field(..., pattern=r"^\+91\d{10}$")
    otp_code: str = Field(..., min_length=6, max_length=6)
    password: str = Field(..., min_length=8)
    platform: str
    city: str
    zone_id: int | None = None
    shift_start: str = Field(..., example="09:00")
    shift_end: str = Field(..., example="21:00")
    upi_id: str = Field(..., example="9876543210@upi")

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, v):
        if v not in SUPPORTED_PLATFORMS:
            raise ValueError(f"Platform must be one of {SUPPORTED_PLATFORMS}")
        return v

    @field_validator("city")
    @classmethod
    def validate_city(cls, v):
        v = v.strip().title()
        if v not in SUPPORTED_CITIES:
            raise ValueError(f"City must be one of {SUPPORTED_CITIES}")
        return v


class RiderLogin(BaseModel):
    phone_number: str = Field(..., pattern=r"^\+91\d{10}$")
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    profile_id: str
    name: str
    city: str
    zone_id: int
    platform: str
    reliability_score: float
    coverage_pct: float
    premium: float
    weekly_cap: float
    policy_id: str
    policy_status: str
    policy_activates_in_seconds: int
    is_new_user: bool


class PremiumQuote(BaseModel):
    city: str
    zone_id: int
    zone_name: str
    zone_risk_multiplier: float
    reliability_score: float
    coverage_pct: float
    premium: float
    weekly_cap: float
    is_new_user: bool


# ── DPDP 2023 UPI KYC Penny-Drop (test mode) ─────────────────────────────────

_UPI_FORMAT = re.compile(r"^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$")


class UpiVerifyRequest(BaseModel):
    upi_id: str

    @field_validator("upi_id")
    @classmethod
    def validate_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not _UPI_FORMAT.match(v):
            raise ValueError("Invalid UPI ID. Expected format: username@handle (e.g. 9876543210@upi)")
        return v


class UpiVerifyResponse(BaseModel):
    status: str
    upi_id: str
    account_holder: str
    bank: str
    deducted_inr: float
    transaction_ref: str
    mode: str
    note: str
