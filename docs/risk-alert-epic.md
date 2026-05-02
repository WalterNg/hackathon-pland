# Epic: Risk Alert & Notification System — Production Grade

**Product Area:** Risk Management  
**Created:** 2026-04-29  
**Status:** Planning  

---

## Background & Motivation

The current risk alert system evaluates three rule types (drawdown, position concentration, daily loss), generates severity-weighted alerts with deduplication, and delivers them via in-app polling + toast notifications.

Through design review and benchmarking against production trading platforms (Alpaca, Interactive Brokers, Binance) and alerting platforms (PagerDuty, Grafana, Datadog), we identified six key gaps:

1. **No out-of-app delivery** — users miss alerts when the tab is closed
2. **No conscious override** — users who intentionally hold a violating position have no way to express that intent; they get spammed
3. **Snooze is missing** — "acknowledged" is semantically overloaded; there's no way to say "remind me later"
4. **No delivery audit trail** — we log violations, not whether the user actually received the alert
5. **No escalation engine** — critical unacknowledged alerts don't re-notify or escalate
6. **No rule conflict awareness** — rules are evaluated independently; the system has no concept that satisfying one rule may inherently violate another

---

## Epics Overview

| # | Epic | Priority | Complexity |
|---|------|----------|------------|
| E1 | Conscious Risk Override | P0 | Medium |
| E2 | Snooze & Alert Fatigue Prevention | P0 | Low |
| E3 | Notification Channel Management | P1 | High |
| E4 | Alert Delivery Reliability & Audit Trail | P1 | Medium |
| E5 | Escalation & Re-notification Engine | P2 | High |
| E6 | Rule Conflict Detection & Resolution | P1 | High |

---

---

# E1 — Conscious Risk Override

**Goal:** Allow users to explicitly accept a known risk violation and suppress future alerts on that violation, while the app retains a safety net for meaningful escalation.

**Problem statement:** A user holding BTC at 80% allocation with a 60% rule set — and sitting on 30% profit — has no way to tell the app "I know, I'm choosing to hold." They must either dismiss every alert (alert fatigue) or acknowledge it repeatedly. Neither captures intent.

---

### Story E1-S1: Override action on an active alert

**As a** trader  
**I want** an "Override — I'm holding" action on any active alert  
**So that** I can tell the app I'm aware of the violation and choosing not to act

**Acceptance Criteria:**
- Active alerts show three action buttons: `Snooze`, `Override`, `Resolve`
- Clicking Override opens a modal with:
  - Optional reason picker: `Taking profit soon / Intentional overweight / Other`
  - Duration picker: `24h / 3 days / 7 days / Until I manually revoke`
- On confirm, alert status transitions to `overridden`
- Alert no longer appears in the active alerts feed
- Confirmation toast: "Override active until [expiry date]"

**Technical Notes:**
- Add `status = 'overridden'` to the alert status enum
- New fields on `risk_alerts`: `override_reason`, `override_expires_at`, `override_value` (observed value at time of override), `override_at`
- API: `PATCH /api/risk-rules/alerts/{id}` accepts `{ status: "overridden", reason, expires_in_hours }`

---

### Story E1-S2: Suppress re-alerts while override is active

**As a** trader who set an override  
**I want** the app to stop alerting me on the same violation  
**So that** I'm not spammed while consciously holding my position

**Acceptance Criteria:**
- During alert evaluation, skip generating new alerts for any violation whose signature matches an active override
- Toast notifications do not fire for overridden alerts
- Hook polling does not count overridden alerts in the active alert badge count

**Technical Notes:**
- In `_log_event_if_changed()`: check for existing `overridden` alert with matching signature before creating new alert
- If override is active → skip event creation, return early

---

### Story E1-S3: Escalation band — re-alert when violation worsens significantly

**As a** trader with an active override  
**I want** the app to re-alert me if the violation worsens materially beyond what I accepted  
**So that** my override doesn't give me a false sense of safety at much higher risk levels

**Acceptance Criteria:**
- If observed value exceeds `override_value × 1.15` (configurable), the override is automatically revoked
- Alert status resets to `active`, a new alert fires with severity `critical`
- Alert message includes context: "This violation has worsened beyond your override threshold (was 80%, now 94%)"

**Technical Notes:**
- Add check in evaluation loop: if override active and `observed > override_value * ESCALATION_BAND`, call `_revoke_override(alert_id)`
- `ESCALATION_BAND` default `1.15`, configurable per risk profile

---

### Story E1-S4: Override expiry and auto-reactivation

**As a** trader  
**I want** overrides to automatically expire after the duration I set  
**So that** I don't forget I'm operating outside my own rules indefinitely

**Acceptance Criteria:**
- When `override_expires_at` is in the past, alert reactivates on next evaluation cycle
- Re-activation fires a new toast: "Your override on [rule] has expired. Rule is now active again."
- User can revoke an override early from the alerts panel

**Technical Notes:**
- In evaluation loop: check `override_expires_at < now()` → reset status to `active`
- Add `DELETE /api/risk-rules/alerts/{id}/override` endpoint for manual revocation

---

### Story E1-S5: Override visibility badge on portfolio

**As a** trader  
**I want** to see a visual indicator on positions that have active overrides  
**So that** I never forget I'm consciously outside my own rules

**Acceptance Criteria:**
- Positions with an active risk override show a yellow shield badge in the portfolio holdings view
- Tooltip on badge: "Risk override active: [reason] — expires [date]"
- Override count shown in the risk panel summary: "2 active overrides"

---

### Story E1-S6: Override audit log

**As a** trader (or compliance reviewer)  
**I want** all override actions logged with reason, value, and expiry  
**So that** I can review past decisions and understand my risk behavior

**Acceptance Criteria:**
- `risk_events` table logs an event of type `override_set` with payload: `{ rule_type, observed_value, threshold, reason, expires_at }`
- `risk_events` logs `override_revoked` (manual or auto-expiry or escalation band breach)
- Override history visible in alert detail view

---

---

# E2 — Snooze & Alert Fatigue Prevention

**Goal:** Give users granular control over alert timing without polluting the resolved/overridden state, and prevent alert storms on repeated low-severity violations.

---

### Story E2-S1: Snooze an alert for a fixed duration

**As a** trader  
**I want** to snooze an alert for 15, 30, or 60 minutes  
**So that** I can defer it without dismissing it permanently

**Acceptance Criteria:**
- "Snooze" button on active alerts with duration options: `15m / 30m / 1h`
- Alert status transitions to `snoozed` with `snoozed_until` timestamp
- Alert disappears from active feed during snooze window
- At snooze expiry, alert reactivates and re-fires toast if rule still violated
- Snoozed alerts shown in a separate "Snoozed" section in the alerts panel

**Technical Notes:**
- Add `status = 'snoozed'` and `snoozed_until timestamptz` to `risk_alerts`
- Evaluation loop: if `snoozed_until > now()` → skip notification, else reactivate

---

### Story E2-S2: Alert digest for low-severity violations

**As a** trader  
**I want** low-severity (info/warning) alerts to be batched into a summary rather than firing individual toasts  
**So that** my screen isn't overwhelmed during volatile market conditions

**Acceptance Criteria:**
- Warning alerts do not fire immediate toasts; instead they are batched
- A digest toast fires max once every 30 minutes: "You have 4 new warning-level alerts"
- Critical alerts always fire immediately, regardless of digest setting
- User can configure: `Immediate toasts: Critical only / Critical + Warning / All`

**Technical Notes:**
- Add `notification_mode` to user preferences: `critical_only | critical_warning | all`
- Toast component checks preference before firing; batches warnings into digest queue

---

### Story E2-S3: Quiet hours configuration

**As a** trader  
**I want** to set quiet hours during which non-critical alerts are suppressed  
**So that** I'm not disturbed outside trading hours

**Acceptance Criteria:**
- User can set quiet hours in notification settings (e.g., 10pm–8am)
- During quiet hours, warning/info toasts are suppressed
- Critical alerts always fire regardless of quiet hours
- Suppressed alerts are queued and shown as a digest when quiet hours end

**Technical Notes:**
- `notification_preferences` table: `quiet_hours_start`, `quiet_hours_end`, `quiet_hours_timezone`
- Toast component and server-side dispatcher both check quiet hours before delivery

---

---

# E3 — Notification Channel Management

**Goal:** Deliver alerts outside the app via webhook and email so users are notified even when the browser tab is closed.

---

### Story E3-S1: User notification preferences

**As a** trader  
**I want** to configure which channels receive which severity of alerts  
**So that** I get critical alerts on my phone but warnings only in-app

**Acceptance Criteria:**
- Settings page has a "Notifications" section
- User can configure per-severity delivery: `In-app / Email / Webhook`
- Default: Critical → email + in-app; Warning → in-app only; Info → in-app only
- Test button: "Send test notification" fires a sample alert to all configured channels

**Technical Notes:**
- New table `notification_preferences`: `user_id`, `severity`, `channels[]` (jsonb array), `quiet_hours_start`, `quiet_hours_end`
- Seed defaults on user creation

---

### Story E3-S2: Email delivery for critical alerts

**As a** trader  
**I want** to receive an email when a critical alert fires  
**So that** I'm notified even when I'm not looking at the app

**Acceptance Criteria:**
- Email sent within 60 seconds of critical alert being generated
- Email contains: alert type, current value, threshold, portfolio name, timestamp, link to alerts page
- Email footer includes: "Manage notification preferences" link
- Email not sent if an email for the same alert signature was sent within the last hour

**Technical Notes:**
- Use SendGrid or Resend via async background job
- `notification_deliveries` table: `alert_id`, `channel`, `status` (sent/failed/delivered), `sent_at`
- Dedup check: no duplicate email if same `alert_id + channel` exists within 1h

---

### Story E3-S3: Webhook delivery for all alert events

**As a** developer/power user  
**I want** to register a webhook URL that receives all alert events  
**So that** I can pipe alerts into my own systems (Slack, Telegram, custom bot)

**Acceptance Criteria:**
- User can register a webhook URL in settings
- Webhook fires on: alert created, alert escalated, alert resolved, override set/revoked
- Payload includes: `{ event_type, alert_id, severity, rule_type, observed_value, threshold, portfolio_id, timestamp }`
- Delivery uses exponential backoff retry: 1s, 2s, 4s, 8s (max 4 attempts)
- Delivery status visible in settings: last delivery time, success/failure

**Technical Notes:**
- New table `webhook_configs`: `user_id`, `url`, `secret` (for HMAC signing), `is_active`, `last_delivery_at`, `last_delivery_status`
- HMAC-SHA256 sign each payload with secret; receiver can verify
- Async job queue (e.g., background task or Celery)

---

### Story E3-S4: Webhook signature verification

**As a** developer  
**I want** webhook payloads to be signed with HMAC  
**So that** I can verify they genuinely come from the app

**Acceptance Criteria:**
- Each webhook delivery includes header: `X-Signature: sha256=<hmac>`
- Docs page shows how to verify the signature
- User can rotate their webhook secret from settings

---

---

# E4 — Alert Delivery Reliability & Audit Trail

**Goal:** Know with certainty whether an alert was delivered, seen, and acted on. Fix the fragile localStorage deduplication.

---

### Story E4-S1: Server-side delivery tracking

**As a** system  
**I want** to track every notification delivery attempt and outcome  
**So that** we have a reliable audit trail and can debug missed alerts

**Acceptance Criteria:**
- Every alert delivery (in-app, email, webhook) creates a `notification_deliveries` record
- Record contains: `alert_id`, `channel`, `user_id`, `status` (pending/sent/delivered/failed), `sent_at`, `delivered_at`, `error_message`
- In-app delivery marked as `delivered` when user loads the alerts panel
- Failed deliveries visible in an admin/debug view

**Technical Notes:**
- Replace localStorage dedup in `risk-alert-toast.tsx` with server-side `delivered_at` check
- Toast component marks delivery on render via `PATCH /api/risk-rules/alerts/{id}/delivered`

---

### Story E4-S2: Replace localStorage deduplication with server-side

**As a** trader  
**I want** toast deduplication to work across devices and browser sessions  
**So that** I don't see duplicate toasts when I switch between laptop and desktop

**Acceptance Criteria:**
- Toast component no longer uses localStorage for dedup
- Dedup is based on `notification_deliveries.delivered_at` from server
- Alerts already delivered in the last 24h do not re-fire toasts on page reload

---

### Story E4-S3: Alert delivery metrics dashboard (internal)

**As a** product/engineering team  
**I want** to see alert delivery metrics  
**So that** we can monitor alert health and detect delivery failures

**Acceptance Criteria:**
- Internal metrics endpoint: total alerts fired, delivery success rate per channel, avg delivery latency, unacknowledged critical alert count
- Alerts that remain unacknowledged for >30min are flagged in metrics

---

---

# E5 — Escalation & Re-notification Engine

**Goal:** Ensure critical alerts that go unacknowledged are re-surfaced with increasing urgency, rather than silently sitting in the panel.

---

### Story E5-S1: TTL-based re-notification for unacknowledged critical alerts

**As a** trader  
**I want** to be re-notified if a critical alert goes unacknowledged for more than 5 minutes  
**So that** I don't miss a critical breach because I didn't see the first notification

**Acceptance Criteria:**
- Critical alerts unacknowledged after 5 minutes fire a second notification (toast + email if enabled)
- Second notification message: "Reminder: Critical risk alert still unacknowledged — [rule type]"
- After 15 minutes still unacknowledged, a third and final escalated notification fires
- Escalation stops after 3 cycles to prevent spam

**Technical Notes:**
- Background job polls for `status = 'active' AND severity = 'critical' AND created_at < now() - interval '5 min' AND last_notified_at < now() - interval '5 min'`
- `risk_alerts`: add `last_notified_at`, `notification_count` fields
- Max `notification_count = 3` for escalation

---

### Story E5-S2: Escalation stops when alert is acknowledged or overridden

**As a** trader  
**I want** escalation to stop the moment I acknowledge or override an alert  
**So that** I'm not still getting reminders after I've taken action

**Acceptance Criteria:**
- Acknowledging or overriding an alert immediately stops the escalation cycle
- No further re-notifications sent after status changes from `active`

---

### Story E5-S3: Escalation history in alert detail

**As a** trader  
**I want** to see a timeline of when I was notified about an alert  
**So that** I can understand when the breach first occurred and how many reminders I received

**Acceptance Criteria:**
- Alert detail view shows a timeline: "First notified 14:23 → Re-notified 14:28 → Acknowledged 14:31"
- Timeline sourced from `notification_deliveries` records

---

---

---

# E6 — Rule Conflict Detection & Resolution

**Goal:** Make the system aware that rules can conflict — that satisfying one rule may inherently require violating another — and give users the tools to understand and manage those conflicts.

**Problem statement:** Rules are evaluated independently. If Rule A (max drawdown ≤ 10%) and Rule B (min positions ≥ 5) both fire simultaneously in a bear market, the user gets two alerts with no guidance that acting on one makes the other worse. In some cases, the rule set is mathematically irreconcilable — there is no portfolio state that satisfies both rules simultaneously.

**Known conflict archetypes:**
- **Concentration vs. Diversification** — max position size % is too low relative to min position count and portfolio size
- **Drawdown vs. Stop-Loss** — per-trade stop-loss × number of open positions can exceed daily loss limit
- **Leverage vs. Hedging** — opening a required hedge consumes leverage, breaching the leverage limit

---

### Story E6-S1: Conflict detection at rule save time

**As a** trader  
**I want** to be warned when I save a rule set that contains conflicting rules  
**So that** I catch irreconcilable constraints before they cause confusing alerts in live trading

**Acceptance Criteria:**
- When the user saves a risk profile, backend runs a static conflict check
- Known conflict pairs are checked (see technical notes)
- If a conflict is detected, a warning is shown before save: *"Rule A and Rule B may conflict under certain portfolio conditions. Consider adjusting thresholds or setting one as lower priority."*
- User can choose: fix the rules, or save anyway (conflict is acknowledged and logged)
- Non-conflicting saves proceed without any friction

**Technical Notes:**
- Conflict checker runs as a pure function: `detect_conflicts(rule_configs) → List[ConflictWarning]`
- Initial conflict pairs to implement:
  - `max_position_size_pct` + `min_position_count` → conflict when `max_position_size_pct < 100 / min_position_count`
  - `max_daily_loss_usd` + stop-loss rule → conflict when `stop_loss_pct × avg_position_size × max_open_trades > max_daily_loss_usd`
  - `max_drawdown_pct` + `max_leverage` → flag when leverage amplifies drawdown beyond threshold under normal volatility
- Conflict warnings stored in `risk_rule_conflicts` table for audit trail

---

### Story E6-S2: Rule priority setting

**As a** trader  
**I want** to assign a priority (Hard / Soft) to each rule  
**So that** the system knows which rule to defer when a conflict occurs at runtime

**Acceptance Criteria:**
- Each rule in the settings UI has a priority toggle: `Hard limit` (never violate) vs. `Soft target` (best effort)
- Default: all rules start as Hard
- When two rules conflict at evaluation time and one is Soft, only the Hard rule fires an alert; the Soft rule is suppressed with a note: *"Rule B was not enforced because it conflicts with higher-priority Rule A"*
- When both conflicting rules are Hard, both alerts fire with a conflict badge: ⚠️ *"This alert conflicts with another active alert"*

**Technical Notes:**
- Add `priority` field to `risk_rule_configs`: `hard | soft`
- Evaluation loop: after collecting all violations, run conflict resolution pass before generating alerts
- Conflict resolution: if `(rule_A, rule_B)` is a known conflict pair and both violated → suppress lower-priority rule's alert, log suppression event

---

### Story E6-S3: Conflict badge on simultaneous alerts

**As a** trader  
**I want** to see a visual indicator when two active alerts are known to conflict  
**So that** I understand why acting on one will worsen the other before I make a decision

**Acceptance Criteria:**
- When two active alerts are a known conflict pair, both show a conflict badge in the alerts panel
- Conflict badge tooltip: *"Acting on this alert may worsen [linked alert name]. Review both before deciding."*
- Alerts panel shows a conflict summary section: "1 rule conflict detected" with a link to both alerts
- Conflict badge is shown regardless of priority setting (even if one is suppressed, explain why)

---

### Story E6-S4: Conflict-aware grouped override

**As a** trader  
**I want** to override conflicting alerts together  
**So that** I don't have to override each one individually when they're caused by the same underlying condition

**Acceptance Criteria:**
- When overriding an alert that has a known conflict pair, the override modal asks: *"Rule B also conflicts with this. Override both?"*
- User can choose: override just this alert, or override both as a group
- Grouped overrides share the same expiry and reason
- Revoking one override in a group prompts: *"This is part of a grouped override. Revoke all?"*

**Technical Notes:**
- Add `conflict_group_id` to `risk_alerts` — alerts in the same conflict group share this ID
- Override flow checks for conflict group membership before confirming

---

### Story E6-S5: Conflict history and explainability

**As a** trader  
**I want** to see a log of past rule conflicts and how they were resolved  
**So that** I can tune my rules over time to reduce structural conflicts

**Acceptance Criteria:**
- Risk settings page shows a "Conflict History" section
- Lists past conflict events: which rules, when, how resolved (overridden / priority deferred / manually fixed)
- Provides actionable suggestion per conflict type: *"This conflict occurred 4 times. Consider raising your max_position_size_pct from 20% to 25%, or lowering min_position_count from 5 to 4."*

**Technical Notes:**
- `risk_rule_conflicts` table: `rule_a_type`, `rule_b_type`, `detected_at`, `resolution` (override_grouped / priority_deferred / user_fixed), `portfolio_id`
- Suggestion engine is a simple rule-based lookup per conflict archetype (not ML)

---

## Dependency Map

```
E2-S1 (Snooze)             ──► E5-S1 (Escalation TTL)
E1-S1 (Override modal)     ──► E1-S2 (Suppress re-alerts)
                                ──► E1-S3 (Escalation band)
                                ──► E1-S4 (Expiry)
E3-S1 (Preferences)        ──► E3-S2 (Email)
                                ──► E3-S3 (Webhook)
E4-S1 (Delivery table)     ──► E4-S2 (Replace localStorage)
                                ──► E5-S3 (Escalation history)
E6-S1 (Conflict detection) ──► E6-S2 (Rule priority)
                                ──► E6-S3 (Conflict badge)
E6-S2 (Rule priority)      ──► E6-S4 (Grouped override)
E1-S1 (Override modal)     ──► E6-S4 (Grouped override)
E6-S1 (Conflict detection) ──► E6-S5 (Conflict history)
```

---

## Schema Changes Summary

```sql
-- Alert status enum additions
-- active | snoozed | acknowledged | overridden | resolved

ALTER TABLE risk_alerts ADD COLUMN
  override_reason       text,
  override_expires_at   timestamptz,
  override_value        float,
  override_at           timestamptz,
  snoozed_until         timestamptz,
  last_notified_at      timestamptz,
  notification_count    int DEFAULT 0;

-- New tables
CREATE TABLE notification_preferences (
  user_id               uuid REFERENCES auth.users,
  severity              text,           -- critical | warning | info
  channels              jsonb,          -- ["in_app", "email", "webhook"]
  quiet_hours_start     time,
  quiet_hours_end       time,
  quiet_hours_timezone  text,
  notification_mode     text DEFAULT 'critical_only'
);

CREATE TABLE notification_deliveries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id      uuid REFERENCES risk_alerts,
  user_id       uuid REFERENCES auth.users,
  channel       text,           -- in_app | email | webhook
  status        text,           -- pending | sent | delivered | failed
  sent_at       timestamptz,
  delivered_at  timestamptz,
  error_message text
);

CREATE TABLE webhook_configs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users,
  url                   text NOT NULL,
  secret                text NOT NULL,
  is_active             boolean DEFAULT true,
  last_delivery_at      timestamptz,
  last_delivery_status  text
);

-- E6: Rule conflict tracking
CREATE TABLE risk_rule_conflicts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users,
  portfolio_id  uuid,
  rule_a_type   text NOT NULL,
  rule_b_type   text NOT NULL,
  detected_at   timestamptz DEFAULT now(),
  resolution    text,   -- override_grouped | priority_deferred | user_fixed | acknowledged
  resolved_at   timestamptz
);

-- E6: Conflict group linkage on alerts
ALTER TABLE risk_alerts ADD COLUMN
  conflict_group_id   uuid;

-- E6: Rule priority on risk_rule_configs (or risk_limits)
ALTER TABLE risk_limits ADD COLUMN
  priority  text DEFAULT 'hard';  -- hard | soft
```

---

## Suggested Sprint Allocation

| Sprint | Stories | Goal |
|--------|---------|------|
| Sprint 1 | E1-S1, E1-S2, E1-S3, E1-S4 | Ship Conscious Override end-to-end |
| Sprint 2 | E1-S5, E1-S6, E2-S1, E2-S2 | Override visibility + Snooze |
| Sprint 3 (revised) | E6-S1, E6-S2, E6-S3, E4-S1 | Rule conflict detection + delivery tracking foundation |
| Sprint 4 | E6-S4, E6-S5, E4-S2, E3-S1 | Grouped override + conflict history + preferences setup |
| Sprint 5 | E3-S2, E3-S3, E3-S4 | Email + Webhook channels |
| Sprint 6 | E5-S1, E5-S2, E5-S3, E2-S3 | Escalation engine + Quiet hours |
| Sprint 3 | E4-S1, E4-S2, E3-S1 | Delivery tracking + Preferences setup |
| Sprint 4 | E3-S2, E3-S3, E3-S4 | Email + Webhook channels |
| Sprint 5 | E5-S1, E5-S2, E5-S3, E2-S3 | Escalation engine + Quiet hours |
