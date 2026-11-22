"""Check the exact locally generated transcript without a server or credentials.

Install playwright==1.62.0 and its Chromium headless shell, then run:
    python test/campfire-browser.py
"""
from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os
import subprocess
from tempfile import TemporaryDirectory

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
WIDTHS = (320, 390, 1440)
TOTAL = 12


def local_page(browser, fixture, width, javascript_enabled=True):
    context = browser.new_context(
        viewport={"width": width, "height": 800},
        java_script_enabled=javascript_enabled,
        service_workers="block",
    )
    attempted = []
    context.on("request", lambda request: attempted.append(request.url))
    context.route("http://**/*", lambda route: route.abort())
    context.route("https://**/*", lambda route: route.abort())
    page = context.new_page()
    if javascript_enabled:
        anchor = datetime(2026, 7, 28, 12, tzinfo=timezone.utc)
        page.clock.install(time=anchor)
        page.clock.pause_at(anchor + timedelta(seconds=1))
    page.goto(fixture.as_uri())
    return context, page, attempted


def assert_no_network(fixture, attempted):
    # A local file navigation is fine; even an aborted outbound attempt fails.
    assert all(url == fixture.as_uri() for url in attempted), attempted


def verify_keyboard(browser, fixture, width):
    context, page, attempted = local_page(browser, fixture, width)
    try:
        visible = page.locator("#tape li:visible")
        next_message = page.get_by_role("button", name="Next message")
        play = page.get_by_role("button", name="Play chat")
        restart = page.get_by_role("button", name="Restart")
        state = page.locator("#state")
        expect(visible).to_have_count(1)
        page.keyboard.press("Tab")
        expect(next_message).to_be_focused()
        page.keyboard.press("Enter")
        expect(visible).to_have_count(2)
        page.keyboard.press("Tab")
        expect(play).to_be_focused()
        page.keyboard.press("Enter")
        expect(state).to_have_text("Playing")
        page.clock.run_for(900)
        expect(visible).to_have_count(3)
        page.keyboard.press("Escape")
        # Check immediately so the deliberately broken fixture fails specifically here.
        assert state.inner_text() == "Paused", "Escape did not stop playback"
        page.clock.run_for(1800)
        expect(visible).to_have_count(3)
        page.keyboard.press("Enter")
        expect(state).to_have_text("Playing")
        page.clock.run_for(900 * (TOTAL - 3))
        expect(visible).to_have_count(TOTAL)
        expect(state).to_have_text("End of tape")
        expect(restart).to_be_focused()
        expect(page.locator("#tape")).to_contain_text("AI questions are offline")
        document_width, viewport_width, tape_width, tape_view = page.evaluate(
            """() => [document.documentElement.scrollWidth, innerWidth,
                      document.querySelector('#tape').scrollWidth,
                      document.querySelector('#tape').clientWidth]"""
        )
        assert document_width == viewport_width == width, (document_width, viewport_width)
        assert tape_width == tape_view, (tape_width, tape_view)
        page.keyboard.press("Enter")
        expect(visible).to_have_count(1)
        expect(state).to_have_text("Rewound")
        assert_no_network(fixture, attempted)
    finally:
        context.close()


def verify_static(browser, fixture, width):
    context, page, attempted = local_page(browser, fixture, width, javascript_enabled=False)
    try:
        expect(page.locator("#controls")).to_be_hidden()
        expect(page.locator("#tape li:visible")).to_have_count(TOTAL)
        expect(page.locator("#tape")).to_contain_text("AI questions are offline")
        assert_no_network(fixture, attempted)
    finally:
        context.close()


def main():
    parser = ArgumentParser()
    parser.add_argument("--chromium", help="Optional local Chromium executable")
    options = parser.parse_args()
    allowed_env = {key: os.environ[key] for key in ("PATH", "SystemRoot") if key in os.environ}
    with TemporaryDirectory(prefix="offline-campfire-") as tmp, sync_playwright() as p:
        fixture = Path(tmp) / "campfire.html"
        fixture.write_bytes(subprocess.check_output(
            ["node", "scripts/demo.mjs", "--html"], cwd=ROOT, env=allowed_env, timeout=10,
        ))
        browser = p.chromium.launch(executable_path=options.chromium)
        try:
            for width in WIDTHS:
                verify_keyboard(browser, fixture, width)
                verify_static(browser, fixture, width)
                print(f"PASS: {width}px keyboard playback, no-JS fallback, no outbound requests")
            source = fixture.read_text(encoding="utf-8")
            target = 'event.key==="Escape"'
            assert source.count(target) == 1, "Escape red-control selector drifted"
            broken = Path(tmp) / "red-control.html"
            broken.write_text(source.replace(target, 'event.key==="F9"'), encoding="utf-8")
            try:
                verify_keyboard(browser, broken, WIDTHS[0])
            except AssertionError as error:
                if str(error) != "Escape did not stop playback":
                    raise
                print("PASS: deliberately broken Escape control was rejected")
            else:
                raise AssertionError("Negative control should have failed")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
