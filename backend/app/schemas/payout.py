from pydantic import BaseModel
import uuid
from typing import Optional

class PayoutResponse(BaseModel):
    payout_id: uuid.UUID
    policy_id: uuid.UUID
    amount: float
    status: str
    processed_at: str
