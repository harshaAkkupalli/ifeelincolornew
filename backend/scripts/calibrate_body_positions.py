"""Calibrate body-part dot positions to the new somatic-body.png art.

Run: cd /app/backend && python3 scripts/calibrate_body_positions.py

Image is 218×503 (aspect 0.433). Container ViewBox aspect matches. Positions
are stored as 0–100 percentages of the container; since aspect matches the
image, x/y % map directly onto the image pixels.

Calibration was done by inspecting where each anatomical region sits in the
cropped reference photo.
"""
import asyncio, os, sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

POSITIONS = {
    # name (case-insensitive match) → (x%, y%)
    "Head":               (50, 10),   # center of skull
    "Eyes/Face":          (54, 14),   # eye area, slightly right of center
    "Jaw/Mouth":          (50, 19),   # jawline / lower face
    "Throat":             (50, 22),   # neck
    "Shoulders/Neck":     (34, 24),   # left deltoid
    "Chest/Heart":        (50, 33),   # sternum / mid-chest
    "Back":               (64, 38),   # upper torso right (front-view representation)
    "Skin/Whole Body":    (78, 46),   # outside torso to the right
    "Stomach/Gut":        (50, 51),   # navel
    "Whole Body/Energy":  (50, 60),   # solar plexus / lower abdomen energy center
    "Arms/Hands":         (12, 62),   # left hand at side
    "Legs/Feet":          (40, 92),   # left lower calf / foot
}

async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    updated = 0
    async for bp in db.checkin_body_parts.find({}):
        name = bp.get("name", "")
        if name in POSITIONS:
            x, y = POSITIONS[name]
            r = await db.checkin_body_parts.update_one(
                {"_id": bp["_id"]},
                {"$set": {"position_x": x, "position_y": y}},
            )
            updated += r.modified_count
            print(f"  {name:<22} -> x={x:>3} y={y:>3}")
        else:
            print(f"  {name:<22} -> no calibration entry (skipped)")
    print(f"\n✅ Updated {updated} body parts")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
