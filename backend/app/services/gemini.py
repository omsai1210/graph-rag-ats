import google.generativeai as genai
from app.core.config import settings

genai.configure(api_key=settings.gemini_api_key)
model = genai.GenerativeModel("gemini-flash-latest")

def generate_selection_explanation(candidate_name: str, job_title: str,
                                   score: float, matched_skills: list) -> str:
    try:
        matched_labels = [s["required_skill"] for s in matched_skills if s["score"] >= 1.5][:6]
        
        prompt = f"""
        You are an HR assistant writing a professional shortlisting explanation.
        
        Candidate: {candidate_name}
        Role: {job_title}
        Graph RAG Match Score: {score}/100
        Skills matched: {', '.join(matched_labels) if matched_labels else 'general profile match'}
        
        Write exactly 2 sentences explaining why this candidate was shortlisted.
        Be specific about matched skills. Be warm and professional.
        Do not use bullet points. Do not start with "I".
        """
        
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return ""

def generate_rejection_explanation(candidate_name: str, job_title: str,
                                   score: float, gap_skills: list) -> str:
    try:
        gap_labels = gap_skills[:5]
        
        prompt = f"""
        You are an HR assistant writing a constructive rejection message paragraph.
        
        Candidate: {candidate_name}
        Role: {job_title}
        Graph RAG Match Score: {score}/100
        Key skill gaps: {', '.join(gap_labels) if gap_labels else 'overall experience level'}
        
        Write exactly 2 sentences. Acknowledge their application warmly.
        Mention 1-2 specific skills from the gap list they could develop.
        Be empathetic and encouraging. Do not use bullet points. Do not start with "I".
        """
        
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return ""
