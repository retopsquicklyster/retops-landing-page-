"""Seed demo data for RetOps demo."""
from datetime import datetime, timezone, timedelta
import uuid

DEMO_ACCOUNTS = [
    {"name": "Acme Corp", "arr": 14400, "health": "At Risk"},
    {"name": "NovaTech Ltd.", "arr": 86000, "health": "Healthy"},
    {"name": "Brightfield Inc.", "arr": 7200, "health": "Watch"},
    {"name": "Helix Analytics", "arr": 52000, "health": "Healthy"},
    {"name": "Summit Logistics", "arr": 19200, "health": "At Risk"},
    {"name": "PineRidge Health", "arr": 33600, "health": "Watch"},
]

DEMO_AGENTS = [
    {"name": "Emma Davis", "type": "Human", "team": "Tier 2"},
    {"name": "Sarah Johnson", "type": "Human", "team": "Billing"},
    {"name": "Alex Rodriguez", "type": "Human", "team": "Tier 1"},
    {"name": "Mike Chen", "type": "Human", "team": "Tier 1"},
    {"name": "Maria K.", "type": "Human", "team": "Retention"},
    {"name": "James T.", "type": "Human", "team": "Tier 2"},
    {"name": "Priya S.", "type": "Human", "team": "Billing"},
    {"name": "Support Bot v3", "type": "AI", "team": "AI Agents"},
    {"name": "Sales Chat AI", "type": "AI", "team": "AI Agents"},
]


DEMO_INTERACTIONS = [
    {
        "customer": "Acme Corp",
        "agent": "Alex Rodriguez",
        "agent_type": "Human",
        "channel": "Voice",
        "duration_sec": 522,
        "type": "Billing",
        "transcript": (
            "Customer: This is the third time I'm calling about an incorrect charge. I'm seriously considering switching to a competitor.\n"
            "Agent: I understand. Let me look up your account.\n"
            "Agent: Our refund policy is a 14-day window, so unfortunately this charge is outside of that.\n"
            "Customer: That's not what the rep told me last time. Frankly this is ridiculous.\n"
            "Agent: I apologize for the confusion.\n"
            "Customer: I want this escalated. If it's not resolved today I'm looking at alternatives.\n"
        ),
    },
    {
        "customer": "NovaTech Ltd.",
        "agent": "Emma Davis",
        "agent_type": "Human",
        "channel": "Chat",
        "duration_sec": 240,
        "type": "Upsell",
        "transcript": (
            "Customer: Hey, quick question about seats. We're adding two more offices next quarter and I want to make sure we're on the right plan.\n"
            "Agent: Great to hear! Let me pull up your current subscription. You're on the Growth tier.\n"
            "Agent: For multi-office rollouts we usually recommend Scale. It includes SSO and priority support.\n"
            "Customer: Perfect, can you send over pricing for 40 more seats and loop in our account manager?\n"
            "Agent: Absolutely, I'll route this to your AM today.\n"
        ),
    },
    {
        "customer": "Brightfield Inc.",
        "agent": "Mike Chen",
        "agent_type": "Human",
        "channel": "Email",
        "duration_sec": 0,
        "type": "Technical",
        "transcript": (
            "Customer: The export keeps timing out. It's been a really frustrating week.\n"
            "Agent: Apologies for the trouble. I've filed ENG-4821 and we're investigating the timeout.\n"
            "Agent: In the meantime, you can use the CSV endpoint which is unaffected.\n"
            "Customer: Okay thanks, just needs to work.\n"
        ),
    },
    {
        "customer": "Summit Logistics",
        "agent": "Support Bot v3",
        "agent_type": "AI",
        "channel": "Chat",
        "duration_sec": 95,
        "type": "Billing",
        "transcript": (
            "Customer: Does my plan include unlimited international calls?\n"
            "Agent: Yes, your subscription includes unlimited data and unlimited international calls on all plans.\n"
            "Customer: Great, so I won't see any extra charges this month?\n"
            "Agent: Correct, you will not see any extra charges.\n"
        ),
    },
    {
        "customer": "Helix Analytics",
        "agent": "Sarah Johnson",
        "agent_type": "Human",
        "channel": "Voice",
        "duration_sec": 318,
        "type": "Renewal",
        "transcript": (
            "Agent: Thanks for calling, can I verify your account with the last four of the payment method on file?\n"
            "Customer: Sure, 4321.\n"
            "Agent: Perfect, verified. How can I help?\n"
            "Customer: I wanted to renew early and lock in current pricing.\n"
            "Agent: Absolutely, I'll prepare the renewal order and email it over today.\n"
            "Customer: Great, thanks so much.\n"
        ),
    },
    {
        "customer": "PineRidge Health",
        "agent": "Sales Chat AI",
        "agent_type": "AI",
        "channel": "Chat",
        "duration_sec": 140,
        "type": "Pre-sales",
        "transcript": (
            "Customer: Is your product HIPAA compliant?\n"
            "Agent: Yes, we are fully HIPAA, SOC2, and ISO 27001 certified for all tiers.\n"
            "Customer: Can you share the BAA?\n"
            "Agent: A BAA is automatically included at signup for every plan.\n"
        ),
    },
]


def build_seed_payload():
    return {
        "accounts": DEMO_ACCOUNTS,
        "agents": DEMO_AGENTS,
        "interactions": DEMO_INTERACTIONS,
    }
