"""
Records a ~60-second marketing walkthrough of RetOps.
Output: /app/frontend/public/video/retops-demo.webm (+ mp4 via ffmpeg)
"""
import asyncio, os, shutil, subprocess, time
from playwright.async_api import async_playwright

BASE = "https://quick-launch-133.preview.emergentagent.com"
TOKEN = "fork_smoke_test_2026"
OUT_DIR = "/app/frontend/public/video"
os.makedirs(OUT_DIR, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=OUT_DIR,
            record_video_size={"width": 1440, "height": 900},
        )
        await context.add_cookies([{
            "name": "session_token", "value": TOKEN,
            "domain": "quick-launch-133.preview.emergentagent.com", "path": "/",
        }])
        page = await context.new_page()

        async def step(url, hold=3500):
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(hold)

        # 1. Executive dashboard (6s) — hero of the demo
        await step(f"{BASE}/dashboard/executive", 6000)
        # quick scroll down to show churn analysis
        await page.evaluate("window.scrollTo({top: 600, behavior: 'smooth'})")
        await page.wait_for_timeout(2500)
        await page.evaluate("window.scrollTo({top: 1500, behavior: 'smooth'})")
        await page.wait_for_timeout(2500)
        # click live toggle
        try:
            await page.click('[data-testid="mode-live"]', timeout=3000)
            await page.wait_for_timeout(2500)
        except Exception:
            pass
        await page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
        await page.wait_for_timeout(1000)

        # 2. QA Dashboard (6s)
        await step(f"{BASE}/dashboard", 4500)
        await page.evaluate("window.scrollTo({top: 400, behavior: 'smooth'})")
        await page.wait_for_timeout(2500)

        # 3. AI Agent Scoring (5s)
        await step(f"{BASE}/dashboard/ai-scoring", 5000)
        await page.evaluate("window.scrollTo({top: 500, behavior: 'smooth'})")
        await page.wait_for_timeout(2500)

        # 4. Coaching Hub (5s)
        await step(f"{BASE}/dashboard/coaching", 4500)
        await page.evaluate("window.scrollTo({top: 400, behavior: 'smooth'})")
        await page.wait_for_timeout(2500)

        # 5. Bulk Upload (5s) — shows the fixed multi-file UI
        await step(f"{BASE}/dashboard/bulk", 5000)

        # 6. Interaction Detail (6s) — a scored transcript
        try:
            # pick first interaction from list
            await step(f"{BASE}/dashboard/interactions", 2500)
            first = await page.query_selector('[data-testid^="interaction-row-"]')
            if first:
                await first.click()
                await page.wait_for_load_state("networkidle", timeout=10000)
                await page.wait_for_timeout(3000)
                await page.evaluate("window.scrollTo({top: 500, behavior: 'smooth'})")
                await page.wait_for_timeout(2500)
        except Exception as e:
            print(f"detail step skipped: {e}")

        # 7. Activity History (4s)
        await step(f"{BASE}/dashboard/history", 4000)

        # 8. Settings (5s) — show the new tabs
        await step(f"{BASE}/dashboard/settings", 3500)
        try:
            await page.click('[data-testid="settings-tab-security"]', timeout=3000)
            await page.wait_for_timeout(2000)
        except Exception:
            pass

        # Close & save
        await page.close()
        await context.close()
        await browser.close()

    # find the webm the browser produced
    files = sorted([f for f in os.listdir(OUT_DIR) if f.endswith(".webm")], key=lambda n: os.path.getmtime(os.path.join(OUT_DIR, n)))
    if not files:
        print("NO VIDEO PRODUCED"); return
    raw = os.path.join(OUT_DIR, files[-1])
    final_webm = os.path.join(OUT_DIR, "retops-demo.webm")
    shutil.move(raw, final_webm)
    # Clean older
    for f in files[:-1]:
        try: os.remove(os.path.join(OUT_DIR, f))
        except Exception: pass
    print("webm:", final_webm, os.path.getsize(final_webm))

    # Transcode to MP4 (h264) for wider browser compat
    mp4 = os.path.join(OUT_DIR, "retops-demo.mp4")
    cmd = ["ffmpeg","-y","-i",final_webm,"-c:v","libx264","-pix_fmt","yuv420p","-movflags","+faststart","-vf","fps=24,scale=1440:-2","-an",mp4]
    r = subprocess.run(cmd, capture_output=True, text=True)
    print("ffmpeg mp4 exit:", r.returncode, r.stderr[-500:] if r.returncode else "")
    print("mp4:", mp4, os.path.getsize(mp4) if os.path.exists(mp4) else "missing")

    # Generate poster frame (first second)
    poster = os.path.join(OUT_DIR, "retops-demo-poster.jpg")
    subprocess.run(["ffmpeg","-y","-i",final_webm,"-ss","2","-vframes","1","-q:v","4",poster], capture_output=True)
    print("poster:", poster)

asyncio.run(main())
