import os
import sys
import pandas as pd
from neo4j import GraphDatabase
from tqdm import tqdm
from pathlib import Path

# Add backend to path so we can import app modules
sys.path.append(str(Path(__file__).parent.parent))
from app.core.config import settings

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent.parent.parent / "docs" / "esco"

OCCUPATIONS_FILE = DATA_DIR / "occupations_en.csv"
SKILLS_FILE = DATA_DIR / "skills_en.csv"
SKILL_HIERARCHY_FILE = DATA_DIR / "broaderRelationsSkillPillar_en.csv"
OCCUPATION_SKILL_RELATIONS_FILE = DATA_DIR / "occupationSkillRelations_en.csv"

BATCH_SIZE = 500

# ---------------------------------------------------------------------------
# HELPER FUNCTION
# ---------------------------------------------------------------------------
def run_in_batches(session, query: str, data: list, batch_size: int = BATCH_SIZE, desc: str = ""):
    """Runs a Cypher query in batches using tqdm progress bar."""
    total_batches = (len(data) + batch_size - 1) // batch_size
    with tqdm(total=total_batches, desc=desc) as pbar:
        for i in range(0, len(data), batch_size):
            batch = data[i:i+batch_size]
            session.run(query, {"batch": batch})
            pbar.update(1)

# ---------------------------------------------------------------------------
# FUNCTION 1
# ---------------------------------------------------------------------------
def create_indexes(session):
    queries = [
        "CREATE INDEX occupation_code IF NOT EXISTS FOR (o:Occupation) ON (o.escoCode)",
        "CREATE INDEX skill_code IF NOT EXISTS FOR (s:Skill) ON (s.escoCode)",
        "CREATE INDEX skill_label IF NOT EXISTS FOR (s:Skill) ON (s.label)",
        "CREATE FULLTEXT INDEX skill_fulltext IF NOT EXISTS FOR (s:Skill) ON EACH [s.label, s.description]"
    ]
    for q in queries:
        session.run(q)
    print("✅ Indexes created")

# ---------------------------------------------------------------------------
# FUNCTION 2
# ---------------------------------------------------------------------------
def import_occupations(session):
    df = pd.read_csv(OCCUPATIONS_FILE, sep=",")
    
    records = df[["conceptUri", "preferredLabel", "description", "iscoGroup"]].rename(columns={
        "conceptUri": "escoCode",
        "preferredLabel": "label",
        "description": "description",
        "iscoGroup": "iscoGroup"
    }).fillna("").to_dict("records")

    query = """
    UNWIND $batch AS row
    MERGE (o:Occupation {escoCode: row.escoCode})
    SET o.label = row.label,
        o.description = row.description,
        o.iscoGroup = row.iscoGroup
    """
    run_in_batches(session, query, records, desc="Importing Occupations")
    print(f"✅ Imported {len(records)} occupations")

# ---------------------------------------------------------------------------
# FUNCTION 3
# ---------------------------------------------------------------------------
def import_skills(session):
    df = pd.read_csv(SKILLS_FILE, sep=",")
    
    records = df[["conceptUri", "preferredLabel", "description", "skillType"]].rename(columns={
        "conceptUri": "escoCode",
        "preferredLabel": "label",
        "description": "description",
        "skillType": "skillType"
    }).fillna("").to_dict("records")

    query = """
    UNWIND $batch AS row
    MERGE (s:Skill {escoCode: row.escoCode})
    SET s.label = row.label,
        s.description = row.description,
        s.skillType = row.skillType
    """
    run_in_batches(session, query, records, desc="Importing Skills")
    print(f"✅ Imported {len(records)} skills")

# ---------------------------------------------------------------------------
# FUNCTION 4
# ---------------------------------------------------------------------------
def import_skill_hierarchy(session):
    df = pd.read_csv(SKILL_HIERARCHY_FILE, sep=",")
    df = df.dropna(subset=["conceptUri", "broaderUri"])
    
    records = df[["conceptUri", "broaderUri"]].rename(columns={
        "conceptUri": "childCode",
        "broaderUri": "parentCode"
    }).to_dict("records")

    query = """
    UNWIND $batch AS row
    MATCH (child:Skill {escoCode: row.childCode})
    MATCH (parent:Skill {escoCode: row.parentCode})
    MERGE (child)-[:BROADER]->(parent)
    """
    run_in_batches(session, query, records, desc="Importing Skill Hierarchy")
    print(f"✅ Imported {len(records)} skill hierarchy relationships")

# ---------------------------------------------------------------------------
# FUNCTION 5
# ---------------------------------------------------------------------------
def import_occupation_skill_relations(session):
    df = pd.read_csv(OCCUPATION_SKILL_RELATIONS_FILE, sep=",")
    
    df["importance"] = df["relationType"].apply(
        lambda x: "essential" if "essential" in str(x).lower() else "optional"
    )
    df = df.dropna(subset=["occupationUri", "skillUri"])
    
    records = df[["occupationUri", "skillUri", "importance"]].rename(columns={
        "occupationUri": "occupationCode",
        "skillUri": "skillCode"
    }).to_dict("records")

    query = """
    UNWIND $batch AS row
    MATCH (o:Occupation {escoCode: row.occupationCode})
    MATCH (s:Skill {escoCode: row.skillCode})
    MERGE (o)-[r:REQUIRES {importance: row.importance}]->(s)
    """
    run_in_batches(session, query, records, desc="Importing Occupation-Skill Relations")
    print(f"✅ Imported {len(records)} occupation-skill relationships")

# ---------------------------------------------------------------------------
# FUNCTION 6
# ---------------------------------------------------------------------------
def verify_import(session):
    occ_count = session.run("MATCH (o:Occupation) RETURN count(o) AS c").single()["c"]
    skill_count = session.run("MATCH (s:Skill) RETURN count(s) AS c").single()["c"]
    req_count = session.run("MATCH ()-[r:REQUIRES]->() RETURN count(r) AS c").single()["c"]
    broader_count = session.run("MATCH ()-[r:BROADER]->() RETURN count(r) AS c").single()["c"]

    print(f"""
📊 Import Summary:
   Occupations : {occ_count}
   Skills      : {skill_count}
   REQUIRES    : {req_count}
   BROADER     : {broader_count}
""")

# ---------------------------------------------------------------------------
# MAIN BLOCK
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("🚀 Starting ESCO taxonomy import...")
    print(f"   Data directory: {DATA_DIR}")

    # Check all files exist
    for f in [OCCUPATIONS_FILE, SKILLS_FILE, SKILL_HIERARCHY_FILE, OCCUPATION_SKILL_RELATIONS_FILE]:
        if not f.exists():
            print(f"❌ Missing file: {f}")
            print("   Download ESCO v1.2 CSV from https://esco.ec.europa.eu/en/use-esco/download")
            sys.exit(1)

    print("✅ All ESCO CSV files found")

    driver = GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password)
    )

    try:
        with driver.session() as session:
            print("\n📌 Step 1/6: Creating indexes...")
            create_indexes(session)

            print("\n📌 Step 2/6: Importing occupations...")
            import_occupations(session)

            print("\n📌 Step 3/6: Importing skills...")
            import_skills(session)

            print("\n📌 Step 4/6: Importing skill hierarchy...")
            import_skill_hierarchy(session)

            print("\n📌 Step 5/6: Importing occupation-skill relations...")
            import_occupation_skill_relations(session)

            print("\n📌 Step 6/6: Verifying import...")
            verify_import(session)

    finally:
        driver.close()

    print("\n🎉 ESCO import complete! Your Neo4j graph is ready.")
