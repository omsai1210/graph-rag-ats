import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

def send_email(to_email: str, subject: str, html_body: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"ATS System <{settings.gmail_user}>"
        msg["To"] = to_email

        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.gmail_user, settings.gmail_app_password)
            server.sendmail(settings.gmail_user, to_email, msg.as_string())

        print(f"SUCCESS: Email sent to {to_email}")

    except Exception as e:
        print(f"ERROR: Email send failed for {to_email}: {e}")


def send_selection_email(to_email: str, candidate_name: str,
                          job_title: str, explanation: str, score: float):
    subject = f"🎉 You've been shortlisted for {job_title}"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <div style="background: #f0fdf4; border-left: 4px solid #16a34a;
                    padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <h2 style="color: #15803d; margin: 0;">Congratulations, {candidate_name}!</h2>
        </div>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            You have been shortlisted for the position of <strong>{job_title}</strong>.
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">{explanation}</p>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Match Score: <strong style="color: #16a34a;">{score}/100</strong>
            </p>
        </div>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Our team will be in touch with next steps shortly.
        </p>
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The Recruitment Team</p>
    </div>
    """
    send_email(to_email, subject, html_body)


def send_rejection_email(to_email: str, candidate_name: str,
                          job_title: str, explanation: str, score: float):
    subject = f"Your application for {job_title}"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1f2937;">Thank you for applying, {candidate_name}</h2>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Thank you for your interest in the <strong>{job_title}</strong> position.
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">{explanation}</p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            We encourage you to keep developing your skills and apply for future openings.
        </p>
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The Recruitment Team</p>
    </div>
    """
    send_email(to_email, subject, html_body)