"""
RetOps — outbound notification helpers (Resend email + Slack webhook).

All sends are best-effort and non-blocking — a transient failure in the email or
Slack provider should NEVER break the auth flow or the click handler that
called us.

Public API:
  notify_admin_email(subject, html_body)           → coroutine; sends to ADMIN_NOTIFY_EMAIL
  notify_slack(text, blocks=None)                  → coroutine; posts to SLACK_WEBHOOK_URL
  build_signup_email_html(user_dict)               → str
  build_login_email_html(user_dict, ip="")         → str
  build_book_demo_slack_text(referrer="", ua="")   → str

Configured entirely via env vars: RESEND_API_KEY, ADMIN_NOTIFY_EMAIL,
SENDER_EMAIL, SLACK_WEBHOOK_URL.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("retops.notifications")

# Lazy-init so importing this module doesn't blow up if resend SDK is absent.
_resend_imported = False
def _resend():
    global _resend_imported
    if not _resend_imported:
        import resend  # noqa: PLC0415
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        _resend_imported = True
    import resend  # noqa: PLC0415
    return resend


# ───────────────────────────── Email ─────────────────────────────

async def notify_admin_email(subject: str, html_body: str) -> None:
    """Send a transactional admin alert. Silently no-ops if RESEND_API_KEY is
    missing. Runs the sync SDK in a worker thread so the FastAPI event loop
    is not blocked."""
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    admin_email = os.environ.get("ADMIN_NOTIFY_EMAIL", "").strip()
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev").strip()
    if not (api_key and admin_email):
        logger.info("notify_admin_email skipped: missing RESEND_API_KEY or ADMIN_NOTIFY_EMAIL")
        return
    try:
        resend = _resend()
        params = {
            "from": sender,
            "to": [admin_email],
            "subject": subject,
            "html": html_body,
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"admin email sent → {admin_email}: {subject}")
    except Exception as e:
        # Most common: free-tier sandbox rejects sends to unverified domains.
        logger.warning(f"admin email failed (subject={subject!r}): {e}")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def build_signup_email_html(user: Dict[str, Any]) -> str:
    return f"""
    <table style="font-family:system-ui,Inter,sans-serif;color:#0b1f3b;max-width:560px;margin:0 auto;border-collapse:collapse;">
      <tr><td style="padding:24px 0;border-bottom:1px solid #e6e8ec;">
        <p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin:0;">RetOps notifications</p>
        <h1 style="font-size:22px;margin:8px 0 0 0;font-weight:700;">New account registered</h1>
      </td></tr>
      <tr><td style="padding:20px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#64748b;width:120px;">Name</td><td><b>{(user.get('name') or '—')}</b></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Email</td><td><b>{user.get('email','—')}</b></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Workspace</td><td>{user.get('workspace_id','—')}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">User&nbsp;ID</td><td><code style="font-size:12px;">{user.get('user_id','—')}</code></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">When</td><td>{_now_iso()}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 0;border-top:1px solid #e6e8ec;color:#94a3b8;font-size:12px;">
        Sent automatically from retops.ai · <a href="https://retops.ai/dashboard/settings" style="color:#14b8a6;">Manage notifications</a>
      </td></tr>
    </table>
    """


def build_login_email_html(user: Dict[str, Any], ip: str = "") -> str:
    return f"""
    <table style="font-family:system-ui,Inter,sans-serif;color:#0b1f3b;max-width:560px;margin:0 auto;border-collapse:collapse;">
      <tr><td style="padding:24px 0;border-bottom:1px solid #e6e8ec;">
        <p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin:0;">RetOps notifications</p>
        <h1 style="font-size:22px;margin:8px 0 0 0;font-weight:700;">User signed in</h1>
      </td></tr>
      <tr><td style="padding:20px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#64748b;width:120px;">Name</td><td><b>{user.get('name','—')}</b></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Email</td><td><b>{user.get('email','—')}</b></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Workspace</td><td>{user.get('workspace_id','—')}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">IP</td><td>{ip or '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">When</td><td>{_now_iso()}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 0;border-top:1px solid #e6e8ec;color:#94a3b8;font-size:12px;">
        Sent automatically from retops.ai · If this wasn't expected, <a href="https://retops.ai/dashboard/settings" style="color:#14b8a6;">review sessions</a>.
      </td></tr>
    </table>
    """


# ───────────────────────────── Slack ─────────────────────────────

async def notify_slack(text: str, blocks: Optional[List[Dict[str, Any]]] = None) -> None:
    """Post a message to the configured Slack incoming webhook. Silent no-op
    if SLACK_WEBHOOK_URL is empty."""
    url = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    if not url:
        logger.info("notify_slack skipped: SLACK_WEBHOOK_URL not set")
        return
    try:
        payload: Dict[str, Any] = {"text": text}
        if blocks:
            payload["blocks"] = blocks
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.post(url, json=payload)
            if r.status_code >= 300:
                logger.warning(f"slack post returned {r.status_code}: {r.text[:200]}")
    except Exception as e:
        logger.warning(f"slack post failed: {e}")


def build_book_demo_slack_blocks(*, referrer: str = "", user_agent: str = "", source_path: str = "") -> List[Dict[str, Any]]:
    return [
        {"type": "header", "text": {"type": "plain_text", "text": "🎯 New Book-a-Demo click"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Source*\n{source_path or '—'}"},
            {"type": "mrkdwn", "text": f"*When*\n{_now_iso()}"},
        ]},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Referrer*\n{referrer or '—'}"},
            {"type": "mrkdwn", "text": f"*User agent*\n`{(user_agent or '—')[:80]}`"},
        ]},
        {"type": "context", "elements": [
            {"type": "mrkdwn", "text": "Visitor opened the Quicklyster booking widget."},
        ]},
    ]
