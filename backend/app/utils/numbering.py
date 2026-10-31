"""
Gap-free sequential number generation for invoices and subscriptions.

Rules (from playbook)
----------------------
- Invoice numbers  : INV/YYYY/000001 — sequential per calendar year, gap-free
- Subscription numbers: SUB/YYYY/0001 — sequential per calendar year, gap-free
- The number is allocated in the SAME database transaction that inserts the
  record — if the transaction rolls back, the counter is NOT decremented and
  a gap is accepted (standard practice; auditors care about duplicates, not gaps).
- Counters live in a dedicated `sequence_counters` table, incremented with a
  SELECT ... FOR UPDATE (row-level lock) so concurrent processes never collide.
"""
from __future__ import annotations

import datetime
from sqlalchemy import Integer, String, UniqueConstraint, func, select, text
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.database import Base


# ---------------------------------------------------------------------------
# SequenceCounter model
# ---------------------------------------------------------------------------

class SequenceCounter(Base):
    """
    Persistent counter table — one row per (series, year).

    series  : 'INV' or 'SUB'
    year    : calendar year (e.g. 2026)
    counter : last issued number (starts at 0)
    """

    __tablename__ = "sequence_counters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    series: Mapped[str] = mapped_column(String(10), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    counter: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("series", "year", name="uq_seq_series_year"),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def next_invoice_number(db: Session, issue_date: datetime.date) -> str:
    """
    Allocate and return the next invoice number for the given year.
    Format: INV/2026/000001
    Must be called inside an open transaction (caller commits).
    """
    n = _next(db, "INV", issue_date.year)
    return f"INV/{issue_date.year}/{n:06d}"


def next_subscription_number(db: Session, start_date: datetime.date) -> str:
    """
    Allocate and return the next subscription number for the given year.
    Format: SUB/2026/0001
    Must be called inside an open transaction (caller commits).
    """
    n = _next(db, "SUB", start_date.year)
    return f"SUB/{start_date.year}/{n:04d}"


def next_payment_number(db: Session, payment_date: datetime.date) -> str:
    """
    Allocate and return the next payment number for the given year.
    Format: PAY/2026/000001
    Must be called inside an open transaction (caller commits).
    """
    n = _next(db, "PAY", payment_date.year)
    return f"PAY/{payment_date.year}/{n:06d}"


# ---------------------------------------------------------------------------
# Internal: locked counter increment
# ---------------------------------------------------------------------------

def _next(db: Session, series: str, year: int) -> int:
    """
    Atomically increment and return the next counter value for (series, year).

    Uses SELECT ... FOR UPDATE to prevent concurrent double-allocation.
    """
    # Try to fetch existing row with a row-level lock
    stmt = (
        select(SequenceCounter)
        .where(SequenceCounter.series == series, SequenceCounter.year == year)
        .with_for_update()
    )
    row = db.execute(stmt).scalar_one_or_none()

    if row is None:
        # First allocation for this series/year — create the counter row
        row = SequenceCounter(series=series, year=year, counter=1)
        db.add(row)
        db.flush()   # write so subsequent calls in same tx see it
        return 1
    else:
        row.counter += 1
        db.flush()
        return row.counter

