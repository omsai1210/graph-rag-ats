"""
Eligibility service.

check_eligibility(application, filters) → (passed: bool, reason: str)

Checks candidate metadata against a job's eligibility filter row.
"""

from __future__ import annotations


def check_eligibility(application: dict, filters: dict) -> tuple[bool, str]:
    """
    Checks if a candidate meets the job eligibility criteria.

    Args:
        application: dict with keys gender, branch, cgpa, graduation_year
        filters:     dict from the job_eligibility table row

    Returns:
        (True, "")                   – all checks passed
        (False, "<human message>")   – first failing check with reason
    """

    # 1. Gender check
    gender_allowed = filters.get("gender_allowed")
    if gender_allowed and len(gender_allowed) > 0:
        if application["gender"].lower() not in [g.lower() for g in gender_allowed]:
            return False, f"This role is open to: {', '.join(gender_allowed)}"

    # 2. Branch check
    branches_allowed = filters.get("branches_allowed")
    if branches_allowed and len(branches_allowed) > 0:
        if application["branch"] not in branches_allowed:
            return False, f"Required branches: {', '.join(branches_allowed)}"

    # 3. CGPA check
    min_cgpa = filters.get("min_cgpa")
    if min_cgpa is not None:
        if application["cgpa"] < min_cgpa:
            return False, f"Minimum CGPA required: {min_cgpa}"

    # 4. Graduation year check
    graduation_years = filters.get("graduation_years")
    if graduation_years and len(graduation_years) > 0:
        if application["graduation_year"] not in graduation_years:
            return False, f"Open to graduation years: {', '.join(map(str, graduation_years))}"

    # 5. All checks passed
    return True, ""
