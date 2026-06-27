from api.routes.risk_rules import _normalize_daily_loss_usd


def test_normalize_daily_loss_usd_clamps_negative_values():
    assert _normalize_daily_loss_usd(-15.5) == 0.0


def test_normalize_daily_loss_usd_preserves_positive_values():
    assert _normalize_daily_loss_usd(42.25) == 42.25


def test_normalize_daily_loss_usd_allows_missing_value():
    assert _normalize_daily_loss_usd(None) is None
