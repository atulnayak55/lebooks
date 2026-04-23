import argparse
import random
from typing import Sequence

from database.database import SessionLocal
from database import models


ADJECTIVES = [
    "Advanced",
    "Compact",
    "Essential",
    "Complete",
    "Illustrated",
    "Practical",
    "Modern",
    "Interactive",
    "Guided",
    "Annotated",
]

TOPICS = [
    "Calculus",
    "Linear Algebra",
    "Physics",
    "Organic Chemistry",
    "Microeconomics",
    "Macroeconomics",
    "Data Structures",
    "Algorithms",
    "Operating Systems",
    "Databases",
    "Computer Networks",
    "Machine Learning",
    "Statistics",
    "Discrete Mathematics",
    "Signal Processing",
    "Control Systems",
    "English Grammar",
    "Italian Literature",
    "Constitutional Law",
    "Psychology",
    "Cell Biology",
    "Genetics",
    "Accounting",
    "Marketing",
    "Thermodynamics",
    "Electromagnetism",
    "Embedded Systems",
    "Software Engineering",
    "Numerical Methods",
    "Project Management",
]

FORMATS = [
    "Exam Prep",
    "Workbook",
    "Lecture Notes Companion",
    "Solved Problems",
    "Reference Guide",
    "Crash Course",
    "Handbook",
    "Practice Set",
    "Study Manual",
    "Lab Companion",
]

DESCRIPTORS = [
    "Minimal highlighting, clean pages, good for exam season.",
    "Used for one semester and still in very solid condition.",
    "Some notes in pencil, but everything is fully readable.",
    "Great if you want to avoid paying full bookstore price.",
    "Has sticky tabs on key chapters and a few margin notes.",
    "Bought new, barely opened, selling after course change.",
    "Perfect for students who just need a reliable study copy.",
    "Cover shows light wear, inside pages are in excellent shape.",
    "Useful summary tables and worked examples throughout.",
    "Handled carefully and stored indoors, no torn pages.",
]

CONDITIONS = ["new", "good", "fair", "used"]


def build_title(index: int) -> str:
    adjective = random.choice(ADJECTIVES)
    topic = random.choice(TOPICS)
    fmt = random.choice(FORMATS)
    edition = random.choice(["2nd", "3rd", "4th", "2023", "2024", "2025"])
    return f"{adjective} {topic} {fmt} ({edition} ed.) #{index + 1}"


def build_description(subject_name: str) -> str:
    opening = random.choice(
        [
            f"Used for {subject_name} at UniPd.",
            f"Great companion text for {subject_name}.",
            f"Selling my copy from {subject_name}.",
            f"Reliable study book for {subject_name}.",
        ]
    )
    middle = random.choice(DESCRIPTORS)
    closing = random.choice(
        [
            "Can hand over on campus.",
            "Pickup in Padova city center works for me.",
            "Message me if you want more photos.",
            "Happy to coordinate around lectures.",
        ]
    )
    return f"{opening} {middle} {closing}"


def choose_price(condition: str) -> float:
    ranges = {
        "new": (28, 70),
        "good": (18, 48),
        "fair": (10, 28),
        "used": (12, 35),
    }
    low, high = ranges[condition]
    price = random.uniform(low, high)
    return round(price, 2)


def seed_mock_listings(count: int, seller_id: int, seller_email: str) -> None:
    db = SessionLocal()
    try:
        seller = db.query(models.User).filter(models.User.id == seller_id).first()
        if seller is None:
            raise SystemExit(f"User with id={seller_id} does not exist.")

        if seller.email != seller_email:
            raise SystemExit(
                f"User id={seller_id} exists, but email is {seller.email!r}, not {seller_email!r}."
            )

        subjects: Sequence[models.Subject] = db.query(models.Subject).all()
        if not subjects:
            raise SystemExit("No subjects found. Seed taxonomy first before creating mock listings.")

        created = []
        for index in range(count):
            subject = random.choice(subjects)
            condition = random.choice(CONDITIONS)
            listing = models.Listing(
                title=build_title(index),
                price=choose_price(condition),
                condition=condition,
                description=build_description(subject.name),
                seller_id=seller_id,
                subject_id=subject.id,
            )
            db.add(listing)
            created.append(listing)

        db.commit()
        print(
            f"Created {len(created)} mock listings for user id={seller_id} ({seller_email}) "
            f"across {len(subjects)} available subjects."
        )
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed mock marketplace listings.")
    parser.add_argument("--count", type=int, default=100, help="How many mock listings to create.")
    parser.add_argument("--seller-id", type=int, default=7, help="Seller user id.")
    parser.add_argument(
        "--seller-email",
        default="top@top.com",
        help="Expected seller email used as a safety check.",
    )
    args = parser.parse_args()
    seed_mock_listings(args.count, args.seller_id, args.seller_email)


if __name__ == "__main__":
    main()
