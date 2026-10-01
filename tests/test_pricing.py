import pytest

from api import pricing


@pytest.mark.parametrize(
    ("kobo", "expected"),
    [(0, "₦0"), (350_000, "₦3,500"), (1_850_000, "₦18,500"), (26_400_000, "₦264,000"), (1_850_050, "₦18,500.50")],
)
def test_format_naira(kobo, expected):
    assert pricing.format_naira(kobo) == expected


def test_lagos_standard_costs_2500_below_the_free_threshold():
    assert pricing.delivery_fee_kobo("Lagos", "standard", 4_999_999) == 250_000


def test_lagos_standard_is_free_at_exactly_50000():
    assert pricing.delivery_fee_kobo("Lagos", "standard", 5_000_000) == 0


def test_lagos_standard_is_free_above_50000():
    assert pricing.delivery_fee_kobo("Lagos", "standard", 11_600_000) == 0


def test_lagos_express_is_5000_even_over_the_free_threshold():
    assert pricing.delivery_fee_kobo("Lagos", "express", 100_000) == 500_000
    assert pricing.delivery_fee_kobo("Lagos", "express", 9_000_000) == 500_000


def test_state_name_is_matched_ignoring_case_and_spaces():
    assert pricing.delivery_fee_kobo("  lagos ", "standard", 100_000) == 250_000


def test_other_states_standard_is_4500_whatever_the_subtotal():
    assert pricing.delivery_fee_kobo("Kano", "standard", 100_000) == 450_000
    assert pricing.delivery_fee_kobo("Kano", "standard", 9_000_000) == 450_000


def test_express_is_not_available_outside_lagos():
    with pytest.raises(ValueError, match="only available in Lagos"):
        pricing.delivery_fee_kobo("Kano", "express", 100_000)


def test_unknown_delivery_speed_is_rejected():
    with pytest.raises(ValueError, match="Unknown delivery speed"):
        pricing.delivery_fee_kobo("Lagos", "drone", 100_000)


def test_free_delivery_remaining():
    assert pricing.free_delivery_remaining_kobo(3_800_000) == 1_200_000
    assert pricing.free_delivery_remaining_kobo(5_000_000) == 0
    assert pricing.free_delivery_remaining_kobo(9_000_000) == 0


def test_order_number_is_10000_plus_the_id():
    assert pricing.order_number(482) == "OJA-10482"
