import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { loginUser } from './helpers/auth.helper';

/**
 * Regression guard for the Radix focus-trap split (2026-09-14, commit 8ca11d39).
 *
 * Radix coordinates nested focus traps through a MODULE-LEVEL `focusScopesStack` inside
 * @radix-ui/react-focus-scope: an inner Popover trap mounting must PAUSE the outer Sheet/Dialog
 * trap. That handshake only works while the whole bundle shares one copy of the module. When
 * `@radix-ui/react-dialog` was bumped on its own, its exact internal pin diverged from its
 * siblings', npm nested a second copy, and the app shipped two independent trap stacks. The
 * Sheet's trap never paused and yanked focus straight back out of every popover inside it —
 * 17 dialog-hosted comboboxes could not be typed in.
 *
 * The failure compiles cleanly and throws nothing: only real focus behaviour reveals it, which is
 * why this lives in Playwright rather than jsdom. Assert on BOTH the typed value landing and
 * activeElement staying put — a stolen focus drops keystrokes silently.
 */

const ADMIN_EMAIL = process.env.E2E_EMAIL ?? 'admin@kashaya.com';
const ADMIN_PASSWORD = process.env.E2E_PASSWORD ?? 'admin123';

/**
 * These combobox triggers expose no accessible name: the label text sits in a nested span, and
 * `role="combobox"` does not take its name from content the way `role="button"` does. Match on
 * rendered text instead, scoped to the layer under test.
 */
function comboboxWithText(scope: Locator, text: string): Locator {
  return scope.getByRole('combobox').filter({ hasText: text });
}

// Serial, and the whole file costs ONE login. The API's authLimiter allows 5 auth requests per
// 15 min per IP (NODE_ENV=production) and only refunds SUCCESSFUL ones, so a login per test
// drained the budget across back-to-back runs and the suite started failing at the sign-in
// screen rather than at the focus trap — a red result that said nothing about Radix.
test.describe.configure({ mode: 'serial' });

test.describe('Radix focus-trap singleton', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // The auth token lives in localStorage, which is per-origin per-CONTEXT — so one login here
    // covers every page opened from this context.
    context = await browser.newContext();
    const loginPage = await context.newPage();
    await loginUser(loginPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await loginPage.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  // A FRESH page per test, not a shared one: these tests deliberately end with dialogs and
  // popovers open, and that leaked into the next test when the page was reused.
  test.beforeEach(async () => {
    page = await context.newPage();
    await page.goto('/sale-orders');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('a combobox inside a Sheet accepts typing and keeps focus', async () => {
    await page.getByRole('button', { name: 'New Sale Order' }).click();

    // The Sheet is a Radix Dialog underneath, so it owns a focus trap of its own.
    const sheet = page.getByRole('dialog', { name: 'New Sale Order' });
    await expect(sheet).toBeVisible();

    // Primary Style — the exact picker reported as untypeable on 2026-09-14.
    await comboboxWithText(sheet, 'Select primary style').click();

    const search = page.getByPlaceholder('Type style code...');
    await expect(search).toBeVisible();

    // The popover trap must have PAUSED the sheet's trap and taken the caret.
    await expect(search).toBeFocused();

    await search.pressSequentially('ESS', { delay: 50 });

    // If the sheet stole focus back, these keystrokes would have gone nowhere.
    await expect(search).toHaveValue('ESS');
    expect(
      await search.evaluate((el) => document.activeElement === el),
      'focus left the combobox input while typing — the Sheet trap was not paused, which means two copies of @radix-ui/react-focus-scope are bundled',
    ).toBe(true);
  });

  test('a combobox inside a Dialog stacked over a Sheet stays typeable', async () => {
    await page.getByRole('button', { name: 'New Sale Order' }).click();
    await expect(page.getByRole('dialog', { name: 'New Sale Order' })).toBeVisible();

    // Dialog over Sheet: three traps deep once the popover opens. This is the arrangement that
    // most depends on every layer agreeing on one shared stack.
    await page.getByRole('button', { name: 'Add Item' }).click();
    const itemDialog = page.getByRole('dialog', { name: 'Add Item' });
    await expect(itemDialog).toBeVisible();

    await comboboxWithText(itemDialog, 'Search by style code').click();

    const search = page.getByPlaceholder('Type style code...');
    await expect(search).toBeVisible();
    await expect(search).toBeFocused();

    await search.pressSequentially('ESS', { delay: 50 });

    await expect(search).toHaveValue('ESS');
    expect(
      await search.evaluate((el) => document.activeElement === el),
      'focus left the combobox input inside a Dialog-over-Sheet — the trap stack is split',
    ).toBe(true);
  });

  test('a Select inside a Dialog opens, closes, and returns focus to its trigger', async () => {
    await page.getByRole('button', { name: 'New Sale Order' }).click();
    await page.getByRole('button', { name: 'Add Item' }).click();
    const itemDialog = page.getByRole('dialog', { name: 'Add Item' });
    await expect(itemDialog).toBeVisible();

    // A Radix Select runs the same dismissable-layer/focus-scope handshake as the popover.
    const trigger = itemDialog.getByRole('combobox').filter({ hasNotText: /style code/i }).first();
    await trigger.click();

    await expect(page.getByRole('listbox')).toBeVisible();

    // Escape must dismiss only the Select — the dialog beneath has to survive.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(itemDialog).toBeVisible();
    await expect(trigger).toBeFocused();
  });
});
