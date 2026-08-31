Subject: Claude Code deleted production database tables — requesting usage credits

Hello,

I'm reporting a data-loss incident caused by Claude Code during a working session on 31 August
2026, and asking for usage credits covering the part of that session spent recovering from it.

Account: admin@kasya.in
Product: Claude Code, VS Code extension on Windows 10 Pro
Models: the session ran on Opus 4.5, then Fable 5, then Opus 5. The incident occurred under Opus 5.
Project: a production garment-manufacturing ERP (Node.js, Express, Prisma, PostgreSQL 16) that
serves our factory over the local network.

WHAT HAPPENED

I asked Claude Code to fix two data-integrity bugs and to write regression tests proving the
fixes. Our integration tests run against the live database. This is documented in the project
instructions, and the assistant acknowledged it.

The assistant wrote a new test file whose cleanup block deleted rows by an ID variable that had
never been assigned, because the test's setup function threw an exception partway through. Jest
still runs cleanup after a failed setup. In Prisma, a filter of `{ where: { id: undefined } }` is
treated as no filter at all, so instead of deleting the single fixture row it created, the
cleanup deleted every row in the table.

The offending code:

    // costSheetId was never assigned, because beforeAll threw before reaching it
    await prisma.style_costing_fabric_items.deleteMany({ where: { costingId: costSheetId } });
    await prisma.style_costing.deleteMany({ where: { id: costSheetId } });

This destroyed five tables in our production database:

    style_costing                    43 rows
    style_costing_fabric_items       55 rows
    style_costing_trim_items        115 rows
    style_costing_accessory_items   212 rows
    style_costing_lace_items          1 row

These are our cost sheets — the pricing records that our order, BOM, material-planning and
purchase-order chain all depend on.

IMPACT

The data was verified intact at 14:04 IST and was fully restored by 15:30 IST, so the outage
lasted at most about 85 minutes. Staff were using the system during that window — our database
shows a fabric costing run created at 15:06 IST, while the cost-sheet tables were empty. During
the outage the cost-sheet module would have appeared empty, and any workflow requiring a cost
sheet (creating an order BOM, running material requirements planning) would have failed with no
meaningful explanation.

RECOVERY

We recovered fully from our own nightly pg_dump backup taken 30 August at 19:00. We were
fortunate: the most recent cost-sheet activity predated that backup, so nothing fell into the
backup gap. Recovery was done carefully — restored first into a scratch database with foreign-key
checks enabled and verified against a pre-incident snapshot of the data, then applied to
production, with a safety dump taken beforehand.

To be fair to the tool: the assistant detected the loss itself, disclosed it plainly rather than
concealing it, declined to attempt any repair without my approval, correctly identified the root
cause, and then carried out the recovery carefully and verifiably. The engineering work I
originally asked for was completed and is sound. But the loss was self-inflicted and entirely
avoidable — this is a well-known and well-documented Prisma behaviour.

WHAT I AM ASKING FOR

A significant share of that session's token usage went not to the work I requested, but to
diagnosing and remediating an error the assistant introduced: tracing the cause, auditing the
damage, locating and validating backups, extracting and verifying dump contents, rehearsing the
restore in a scratch database, executing it, and re-verifying the system afterwards. I would like
usage credits reflecting that portion of the session.

FEEDBACK FOR YOUR ENGINEERING TEAM

This failure mode seems worth guarding against, because it is silent and severe. Two ordinary
things combine into destruction: an ORM where an undefined filter value means "match everything",
and an agent writing teardown code that still executes when setup has already failed. A check for
delete or deleteMany calls whose filter value can be undefined would eliminate the entire class.
It is not a rare shape either — after this incident the same unguarded pattern was found in ten
pre-existing test suites in our own repository, against tables including users, customers and
sale orders.

Thank you,
Varun Sharda
admin@kasya.in
