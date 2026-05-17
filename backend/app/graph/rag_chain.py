import fitz  # PyMuPDF
from neo4j import Session
from app.graph.esco_mapper import map_text_to_esco_skills
from app.graph.neo4j_client import get_session
from typing import Optional

SCORING_CYPHER = """
WITH $candidate_skill_codes AS candidate_skills,
     $occupation_code AS job_occ

MATCH (job_occ_node:Occupation {escoCode: job_occ})-[r:REQUIRES]->(required_skill:Skill)
WITH collect({skill: required_skill, importance: r.importance}) AS required,
     candidate_skills

UNWIND required AS req
WITH req.skill AS rs, req.importance AS imp, candidate_skills

OPTIONAL MATCH (direct:Skill)
WHERE direct.escoCode IN candidate_skills
  AND direct.escoCode = rs.escoCode

OPTIONAL MATCH (hop1:Skill)-[:BROADER|RELATED_TO]->(rs)
WHERE hop1.escoCode IN candidate_skills

OPTIONAL MATCH (hop2:Skill)-[:BROADER*2]->(rs)
WHERE hop2.escoCode IN candidate_skills

RETURN
  rs.escoCode AS required_code,
  rs.label AS required_skill,
  imp AS importance,
  CASE
    WHEN direct IS NOT NULL THEN 3.0
    WHEN hop1 IS NOT NULL THEN 1.5
    WHEN hop2 IS NOT NULL THEN 0.75
    ELSE 0.0
  END AS score,
  CASE
    WHEN direct IS NOT NULL THEN direct.label
    WHEN hop1 IS NOT NULL THEN hop1.label
    WHEN hop2 IS NOT NULL THEN hop2.label
    ELSE null
  END AS matched_via
"""

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text

def normalize_score(raw_results: list[dict]) -> float:
    essential_results = [r for r in raw_results if r["importance"] == "essential"]
    optional_results = [r for r in raw_results if r["importance"] == "optional"]

    if not raw_results:
        return 0.0

    max_possible = (len(essential_results) * 3.0) + (len(optional_results) * 1.0)
    if max_possible == 0:
        return 0.0

    actual = sum(
        r["score"] if r["importance"] == "essential" else r["score"] * 0.33
        for r in raw_results
    )

    return round(min((actual / max_possible) * 100, 100.0), 2)

def score_candidate(resume_bytes: bytes, occupation_code: str) -> dict:
    try:
        text = extract_text_from_pdf(resume_bytes)
        if not text.strip():
            return { "score": 0.0, "matched_skills": [], "gap_skills": [],
                     "candidate_skills_found": [], "error": "Could not extract text from PDF" }

        with get_session() as session:
            candidate_skills = map_text_to_esco_skills(text, session)

        if not candidate_skills:
            return { "score": 0.0, "matched_skills": [], "gap_skills": [],
                     "candidate_skills_found": [], "error": "No ESCO skills found in resume" }

        candidate_codes = [s["escoCode"] for s in candidate_skills]

        with get_session() as session:
            results = session.run(SCORING_CYPHER, {
                "candidate_skill_codes": candidate_codes,
                "occupation_code": occupation_code
            }).data()

        if not results:
            return { "score": 0.0, "matched_skills": [], "gap_skills": [],
                     "candidate_skills_found": candidate_skills,
                     "error": "No required skills found for this occupation in graph" }

        score = normalize_score(results)

        matched_skills = [
            { "required_skill": r["required_skill"],
              "matched_via": r["matched_via"],
              "score": r["score"],
              "importance": r["importance"] }
            for r in results if r["score"] > 0
        ]
        
        gap_skills = [
            r["required_skill"]
            for r in results
            if r["score"] == 0 and r["importance"] == "essential"
        ]

        return {
            "score": score,
            "matched_skills": matched_skills,
            "gap_skills": gap_skills,
            "candidate_skills_found": candidate_skills,
            "error": None
        }

    except Exception as e:
        return { "score": 0.0, "matched_skills": [], "gap_skills": [],
                 "candidate_skills_found": [], "error": str(e) }
