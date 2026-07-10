"""
Rolling Permits — reminder engine.

Meant to run once a day (cron job, Supabase Edge Function on a
schedule, or a simple scheduled GitHub Action — any of those work
for v1). It is idempotent: re-running it the same day will not
send duplicate reminders, because every send is logged in
`reminder_log` under a unique (permit_id, threshold, channel) key.

Required environment variables:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY   (service role, not the anon key —
                                this script needs to read across
                                all vendors, bypassing RLS)
  RESEND_API_KEY
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_FROM_NUMBER          (E.164, e.g. +14155550100)
"""

import os
from datetime import date

import httpx
from supabase import create_client, Client

THRESHOLDS = (60, 30, 14, 3)

PERMIT_TYPE_LABELS = {
    "health": "Health Permit",
    "fire": "Fire Inspection",
    "business_license": "Business License",
    "commissary": "Commissary Agreement",
    "propane": "Propane/LP-Gas Certification",
    "insurance": "Insurance (COI)",
    "vehicle_registration": "Vehicle Registration",
    "staff_certification": "Staff Certification",
}


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def fetch_due_permits(supabase: Client, threshold: int):
    """
    Permits whose expiration_date is exactly `threshold` days from
    today. Using an exact match (rather than <=) means each permit
    only ever matches one threshold per day, which keeps the logic
    simple — if the job fails to run on the exact day, see the
    backfill note at the bottom of this file.
    """
    target_date = date.today().toordinal()  # placeholder, replaced below
    resp = (
        supabase.table("permits")
        .select(
            "id, permit_type, expiration_date, document_url, issuer_name,"
            "vendor_id, truck_id,"
            "vendors(business_name, email, phone, plan_tier),"
            "trucks(name),"
            "employees(name),"
            "jurisdictions(name, state)"
        )
        .eq("expiration_date", _date_n_days_from_today(threshold))
        .execute()
    )
    return resp.data or []


def _issued_by_text(permit: dict) -> str:
    """
    Permits are issued either by a government jurisdiction (city/county/
    state) or, for things like insurance, by a private issuer (e.g. a
    carrier name). Exactly one of these is guaranteed to be set — see
    the permits_issuer_or_jurisdiction_check constraint in schema.sql.
    """
    jurisdiction = permit.get("jurisdictions")
    if jurisdiction:
        return f"{jurisdiction['name']}, {jurisdiction['state']}"
    return permit.get("issuer_name") or "an unspecified issuer"


def _who_for_text(permit: dict) -> str:
    """
    Most permits belong to the business as a whole. Vehicle registration
    belongs to a specific truck; staff certifications belong to a
    specific employee. Returns a " for X" suffix, or "" if neither
    applies (e.g. a business license).
    """
    truck = permit.get("trucks") or {}
    employee = permit.get("employees") or {}
    if employee.get("name"):
        return f" for {employee['name']}"
    if truck.get("name"):
        return f" for {truck['name']}"
    return ""


def _date_n_days_from_today(n: int) -> str:
    from datetime import timedelta

    return (date.today() + timedelta(days=n)).isoformat()


def already_sent(supabase: Client, permit_id: str, threshold: int, channel: str) -> bool:
    resp = (
        supabase.table("reminder_log")
        .select("id")
        .eq("permit_id", permit_id)
        .eq("threshold", threshold)
        .eq("channel", channel)
        .execute()
    )
    return len(resp.data or []) > 0


def log_reminder(supabase: Client, permit_id: str, threshold: int, channel: str):
    supabase.table("reminder_log").insert(
        {"permit_id": permit_id, "threshold": threshold, "channel": channel}
    ).execute()


def send_email(to_email: str, subject: str, text_body: str, html_body: str):
    resend_key = os.environ["RESEND_API_KEY"]
    httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {resend_key}"},
        json={"from": "Rolling Permits <alerts@rollingpermits.com>",
            "to": [to_email],
            "subject": subject,
            "text": text_body,
            "html": html_body,
        },
        timeout=10,
    ).raise_for_status()


def send_sms(to_phone: str, body: str):
    sid = os.environ["TWILIO_ACCOUNT_SID"]
    token = os.environ["TWILIO_AUTH_TOKEN"]
    from_number = os.environ["TWILIO_FROM_NUMBER"]
    httpx.post(
        f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
        auth=(sid, token),
        data={"From": from_number, "To": to_phone, "Body": body},
        timeout=10,
    ).raise_for_status()


def build_message(permit: dict, threshold: int) -> tuple[str, str]:
    """Returns (subject, text_body) for the reminder."""
    vendor = permit["vendors"]
    issued_by = _issued_by_text(permit)
    permit_label = PERMIT_TYPE_LABELS.get(permit["permit_type"], permit["permit_type"])
    where = _who_for_text(permit)

    subject = f"Rolling Permits: {permit_label} expires in {threshold} days"
    body = (
        f"Hi {vendor['business_name']},\n\n"
        f"Your {permit_label}{where} ({issued_by}) expires on "
        f"{permit['expiration_date']} ({threshold} days from now).\n\n"
        f"Renew it now to avoid a gap in coverage. "
        f"Log in to Rolling Permits to view the current document or update "
        f"the renewal once it's filed.\n\n"
        f"— Rolling Permits"
    )
    return subject, body


# Brand tokens, mirrored from the frontend's styles.css. Email clients
# don't reliably load Google Fonts or CSS custom properties, so these
# are inlined as plain hex values and web-safe font stacks rather than
# referencing the real Oswald/IBM Plex Mono setup.
_CHAR = "#211c16"
_STEEL = "#5b6470"
_RED = "#c8472f"
_TILE = "#f3f0e8"
_LINE = "#e3ddd0"
_AMBER_BG = "#fbf1e2"
_AMBER_TEXT = "#8a5c10"
_SANS = "Helvetica, Arial, sans-serif"
_MONO = "'Courier New', Courier, monospace"


def build_html_message(permit: dict, threshold: int) -> str:
    """Returns the HTML body for the reminder email."""
    vendor = permit["vendors"]
    issued_by = _issued_by_text(permit)
    permit_label = PERMIT_TYPE_LABELS.get(permit["permit_type"], permit["permit_type"])
    where = _who_for_text(permit)

    return f"""\
<!DOCTYPE html>
<html>
<body style="margin:0; padding:24px 16px; background:{_TILE}; font-family:{_SANS};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; margin:0 auto; background:#ffffff; border:1px solid {_LINE}; border-radius:10px; overflow:hidden;">
    <tr>
      <td style="padding:32px 28px;">

        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="width:18px; height:18px; border:2px solid {_RED}; border-radius:50%; font-size:0; line-height:0;">&nbsp;</td>
            <td style="padding-left:9px; font-family:{_SANS}; font-weight:700; font-size:16px; text-transform:uppercase; letter-spacing:0.02em; color:{_CHAR};">Rolling Permits</td>
          </tr>
        </table>

        <div style="display:inline-block; background:{_AMBER_BG}; color:{_AMBER_TEXT}; font-family:{_MONO}; font-size:12px; font-weight:bold; padding:5px 11px; border-radius:20px; margin-bottom:18px;">
          &#9200; Renewal due in {threshold} days
        </div>

        <h1 style="font-family:{_SANS}; text-transform:uppercase; font-size:20px; font-weight:700; margin:0 0 16px; color:{_CHAR}; line-height:1.3;">
          Time to renew your {permit_label}
        </h1>

        <p style="font-size:14.5px; line-height:1.7; color:{_CHAR}; margin:0 0 14px;">
          Hi {vendor['business_name']},
        </p>
        <p style="font-size:14.5px; line-height:1.7; color:{_CHAR}; margin:0 0 16px;">
          Your <strong>{permit_label}</strong>{where} ({issued_by})
          expires soon. Renew it now to avoid a gap in coverage.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_TILE}; border-radius:6px; margin:20px 0; padding:4px 0;">
          <tr>
            <td style="padding:10px 18px; font-family:{_MONO}; font-size:11px; text-transform:uppercase; color:{_STEEL};">Permit</td>
            <td style="padding:10px 18px; font-family:{_MONO}; font-size:13px; font-weight:bold; color:{_CHAR}; text-align:right;">{permit_label}</td>
          </tr>
          <tr>
            <td style="padding:10px 18px; font-family:{_MONO}; font-size:11px; text-transform:uppercase; color:{_STEEL}; border-top:1px dashed {_LINE};">Issued by</td>
            <td style="padding:10px 18px; font-family:{_MONO}; font-size:13px; font-weight:bold; color:{_CHAR}; text-align:right; border-top:1px dashed {_LINE};">{issued_by}</td>
          </tr>
          <tr>
            <td style="padding:10px 18px; font-family:{_MONO}; font-size:11px; text-transform:uppercase; color:{_STEEL}; border-top:1px dashed {_LINE};">Expires</td>
            <td style="padding:10px 18px; font-family:{_MONO}; font-size:13px; font-weight:bold; color:{_CHAR}; text-align:right; border-top:1px dashed {_LINE};">{permit['expiration_date']}</td>
          </tr>
          <tr>
            <td style="padding:10px 18px; font-family:{_MONO}; font-size:11px; text-transform:uppercase; color:{_STEEL}; border-top:1px dashed {_LINE};">Days left</td>
            <td style="padding:10px 18px; font-family:{_MONO}; font-size:13px; font-weight:bold; color:{_CHAR}; text-align:right; border-top:1px dashed {_LINE};">{threshold}</td>
          </tr>
        </table>

        <a href="https://rollingpermits.com" style="display:inline-block; background:{_RED}; color:#ffffff; text-decoration:none; padding:13px 26px; border-radius:4px; font-family:{_SANS}; text-transform:uppercase; font-weight:bold; font-size:13.5px; letter-spacing:0.02em; margin:8px 0 24px;">
          View in Rolling Permits
        </a>

        <p style="font-size:14.5px; line-height:1.7; color:{_CHAR}; margin:0 0 8px;">
          Log in to view the current document or update the renewal once it's filed.
        </p>

        <div style="border-top:1px solid {_LINE}; padding-top:18px; margin-top:16px; font-size:12px; color:{_STEEL}; line-height:1.6;">
          Rolling Permits &middot; You're receiving this because you have an active permit</body>
</html>
"""


COI_REMINDER_DAYS = 7  # send one reminder this many days before needed_by_date


def fetch_due_coi_reminders(supabase: Client):
    """
    COI recipients whose needed_by_date is within COI_REMINDER_DAYS,
    that haven't been sent yet, and haven't already gotten a reminder.
    Uses <= rather than an exact match (unlike permit reminders) since
    there's only one reminder per recipient, not four thresholds — a
    missed cron run just means it fires a day late instead of
