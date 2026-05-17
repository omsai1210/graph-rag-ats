import re
from neo4j import Session


def extract_skill_tokens(text: str) -> list[str]:
    # Steps 1: Find skills section
    lines = text.splitlines()
    skills_start = -1
    keywords = ["skill", "technology", "tools", "languages", "frameworks", "competenc"]
    
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if any(kw in line_lower for kw in keywords):
            skills_start = i
            break
            
    if skills_start != -1:
        # Take those lines + next 20 lines
        section_lines = lines[skills_start:skills_start + 21]
        target_text = "\n".join(section_lines)
    else:
        target_text = text

    # Step 2: Clean the text
    # Remove special characters except commas, slashes, dots, plus signs
    cleaned_text = re.sub(r'[^\w\s,\/\.\+]', ' ', target_text)
    
    # Split on commas, newlines, bullets, pipes, slashes
    raw_tokens = re.split(r'[,\\n•\|/]', target_text)
    
    common_words = {"and", "or", "the", "with", "using", "experience", "knowledge",
                    "years", "year", "etc", "good", "strong", "excellent", "proficient"}
                    
    processed_tokens = []
    for t in raw_tokens:
        t = re.sub(r'[^\w\s,\/\.\+]', ' ', t)
        t = t.strip()
        if 2 <= len(t) <= 50 and t.lower() not in common_words:
            processed_tokens.append(t)
            
    # Step 3: Deduplicate while preserving order
    deduped_tokens = list(dict.fromkeys(processed_tokens))
    
    # Step 4: Return list of cleaned token strings (max 60 tokens)
    return deduped_tokens[:60]


def map_token_to_esco(token: str, session: Session) -> dict | None:
    query = """
    CALL db.index.fulltext.queryNodes('skill_fulltext', $query)
    YIELD node, score
    WHERE score > 1.0
    RETURN node.escoCode AS escoCode,
           node.label AS label,
           node.skillType AS skillType,
           score
    ORDER BY score DESC
    LIMIT 1
    """
    
    try:
        result = session.run(query, {"query": token}).single()
        if result and result["score"] > 1.0:
            return {
                "escoCode": result["escoCode"],
                "label": result["label"],
                "skillType": result["skillType"],
                "confidence": result["score"]
            }
        return None
    except Exception:
        return None

def map_text_to_esco_skills(text: str, session: Session) -> list[dict]:
    tokens = extract_skill_tokens(text)
    mapped = []
    seen_codes = set()
    for token in tokens:
        result = map_token_to_esco(token, session)
        if result and result["escoCode"] not in seen_codes:
            mapped.append(result)
            seen_codes.add(result["escoCode"])
    return mapped
