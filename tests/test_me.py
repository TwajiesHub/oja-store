import pytest

from api import nigeria

VALID = {
    "full_name": "Amina Bello",
    "phone": "0803 000 0000",
    "address": "12 Herbert Macaulay Way",
    "area": "Yaba",
    "state": "lagos",
}


def test_first_call_creates_the_profile_from_the_token(client, auth):
    response = client.get("/api/me", headers=auth())

    assert response.status_code == 200
    assert response.json() == {
        "user_id": "user-a", "email": "amina@example.com", "full_name": "Amina Bello",
        "phone": "", "address": "", "area": "", "state": "",
    }


def test_get_me_requires_sign_in(client):
    assert client.get("/api/me").status_code == 401


def test_put_me_requires_sign_in(client):
    assert client.put("/api/me", json=VALID).status_code == 401


def test_put_me_saves_and_cleans_the_details(client, auth):
    response = client.put("/api/me", json=VALID, headers=auth())

    assert response.status_code == 200
    body = response.json()
    assert body["phone"] == "+2348030000000"
    assert body["state"] == "Lagos"
    assert client.get("/api/me", headers=auth()).json()["address"] == "12 Herbert Macaulay Way"


def test_put_me_trims_whitespace(client, auth):
    response = client.put("/api/me", json={**VALID, "full_name": "  Amina Bello  ", "area": " Yaba "}, headers=auth())

    assert response.json()["full_name"] == "Amina Bello"
    assert response.json()["area"] == "Yaba"


def test_put_me_before_get_me_creates_the_profile(client, auth):
    assert client.put("/api/me", json=VALID, headers=auth("user-new", "new@example.com")).status_code == 200
    assert client.get("/api/me", headers=auth("user-new", "new@example.com")).json()["email"] == "new@example.com"


def test_profiles_are_private_to_each_user(client, auth):
    client.put("/api/me", json=VALID, headers=auth("user-a"))

    other = client.get("/api/me", headers=auth("user-b", "bola@example.com")).json()

    assert other["user_id"] == "user-b"
    assert other["address"] == ""
    assert other["phone"] == ""


def test_changed_email_in_the_token_updates_the_profile(client, auth):
    client.get("/api/me", headers=auth("user-a", "old@example.com"))

    response = client.get("/api/me", headers=auth("user-a", "new@example.com"))

    assert response.json()["email"] == "new@example.com"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("full_name", "A"),
        ("full_name", ""),
        ("full_name", "x" * 101),
        ("phone", "12345"),
        ("phone", "+1 202 555 0100"),
        ("phone", "0603 000 0000"),
        ("address", "12"),
        ("area", ""),
        ("state", "Wakanda"),
        ("state", ""),
    ],
)
def test_put_me_rejects_invalid_details(client, auth, field, value):
    response = client.put("/api/me", json={**VALID, field: value}, headers=auth())

    assert response.status_code == 422


def test_put_me_requires_every_field(client, auth):
    incomplete = {key: value for key, value in VALID.items() if key != "phone"}

    assert client.put("/api/me", json=incomplete, headers=auth()).status_code == 422


@pytest.mark.parametrize(
    "number",
    ["08030000000", "0803 000 0000", "+234 803 000 0000", "2348030000000", "0803-000-0000", "(0803) 000 0000"],
)
def test_phone_numbers_in_common_spellings_are_normalised(number):
    assert nigeria.normalise_phone(number) == "+2348030000000"


@pytest.mark.parametrize(
    ("phone", "shown"),
    [("+2348030000000", "+234 803 000 0000"), ("08030000000", "08030000000"), ("", "")],
)
def test_phone_is_shown_with_spaces(phone, shown):
    assert nigeria.format_phone(phone) == shown


def test_there_are_37_states_including_fct():
    assert len(nigeria.STATES) == 37
    assert nigeria.canonical_state("fct") == "FCT"
    assert nigeria.canonical_state("akwa ibom") == "Akwa Ibom"
