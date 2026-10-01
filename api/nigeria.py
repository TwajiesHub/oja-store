"""Nigerian places and phone numbers, for validating delivery details."""
import re

# The 36 states and the Federal Capital Territory.
STATES = (
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River",
    "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano",
    "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
    "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
)

# 0803..., 234803... or +234803...: a mobile number is 10 digits after the country code.
_PHONE = re.compile(r"^(?:\+?234|0)([789][01]\d{8})$")
_PHONE_SEPARATORS = re.compile(r"[\s\-().]")


def canonical_state(value: str) -> str | None:
    """The state's proper spelling, or None if it is not a Nigerian state."""
    wanted = value.strip().lower()
    return next((state for state in STATES if state.lower() == wanted), None)


def normalise_phone(value: str) -> str | None:
    """+234XXXXXXXXXX for any accepted spelling of a Nigerian mobile number, else None."""
    match = _PHONE.match(_PHONE_SEPARATORS.sub("", value))
    return f"+234{match.group(1)}" if match else None
