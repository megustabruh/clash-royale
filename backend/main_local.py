# main_local.py - Clash Royale Backend API (Local Development)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from functools import cmp_to_key
import os

from clash_royale import (
    Config, DeckSelector, create_comparator, calculate_achievement_lefts,
    CRCardType, Rarity, HIGH_PRIORITY_UPGRADE_CARDS, SECONDARY_PRIORITY_UPGRADE_CARDS
)

# Local Development API Token
# You can set CLASH_API_TOKEN environment variable or replace this with your token
# Get your token from: https://developer.clashroyale.com
API_TOKEN = os.environ.get("CLASH_API_TOKEN", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6ImFhYmMyNmI0LWRjNTQtNDc1ZC05MjQwLTMzMmMwYTc3Mzg5NiIsImlhdCI6MTc3MzQyMTY4MCwic3ViIjoiZGV2ZWxvcGVyL2VhYjQ5OTQ3LWNiYjMtZWJlZC1mNzViLTgzNGFlODliMGFmZiIsInNjb3BlcyI6WyJyb3lhbGUiXSwibGltaXRzIjpbeyJ0aWVyIjoiZGV2ZWxvcGVyL3NpbHZlciIsInR5cGUiOiJ0aHJvdHRsaW5nIn0seyJjaWRycyI6WyI2NS4yLjgyLjYwIl0sInR5cGUiOiJjbGllbnQifV19.Doj4jiELAtrA43rs_AdjkiG8H7vp2BN28u7arDzCjuqVZx6gGHiBvL9OZd7Lh9ZX06MtzsNwnDVpt-73hN2VGQ")

app = FastAPI(
    title="Clash Royale Backend API",
    description="Local development server for Clash Royale deck analysis",
    version="1.0.0"
)

# CORS settings for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_config():
    return Config(token=API_TOKEN, boosted_cards=("megaminion", "zap"))

def card_to_dict(c):
    return {
        "name": c.name,
        "badge_level": c.badge_level,
        "badge_max_level": c.badge_max_level,
        "badge_progress": c.badge_progress,
        "badge_target": c.badge_target,
        "level": c.level,
        "temp_level": c.temp_level,
        "card_type": c.card_type.name if c.card_type else None,
        "cr_card_type": c.clash_royale_card_type.name if c.clash_royale_card_type else None,
        "rarity": c.rarity.name if c.rarity else None,
        "elixirs": c.elixirs,
        "has_evolution": c.has_evolution,
        "count": c.count,
        "id": c.id,
        "achievement_lefts": c.achievement_lefts,
        "is_high_priority": c.name in HIGH_PRIORITY_UPGRADE_CARDS,
        "is_secondary_priority": c.name in SECONDARY_PRIORITY_UPGRADE_CARDS,
    }

@app.get("/")
def root():
    return {"message": "Clash Royale Backend API running locally", "docs": "/docs"}

@app.get("/api/data")
def get_all_data():
    """Fetch all Clash Royale data with all analysis options."""
    config = get_config()
    selector = DeckSelector(config)
    if not selector.load_cards():
        return JSONResponse({"error": "Failed to fetch player data. Check your API token."}, status_code=500)

    # Basic cards data
    cards = [card_to_dict(c) for c in selector.cards]

    # Option 1: Normal Deck
    comparator = create_comparator('achievements_rarity_level')
    sorted_cards = selector.get_sorted_cards(comparator, include_low_achievements=True)
    normal_deck = [c.name for c in selector.select_deck(sorted_cards, 6)]

    # Option 3: Clan War 4 Decks
    clan_war_decks = get_clan_war_decks(selector)

    # Option 5: Analysis (all cards sorted)
    analysis_cards = get_analysis_cards(selector)

    # Option 8: Achievement Analysis by card type
    achievement_stats = get_achievement_stats(selector)

    # Option 9: Cards to Upgrade
    upgrade_recommendations = get_upgrade_recommendations(selector)

    # Option 10: Upgrade Priority List
    upgrade_priority = get_upgrade_priority_list(selector)

    # Option 11: Upgrade Priority by Rarity
    upgrade_by_rarity = get_upgrade_by_rarity(selector)

    # Option 12: Clan War Custom
    clan_war_custom = get_clan_war_custom(selector)

    return JSONResponse({
        "cards": cards,
        "normal_deck": normal_deck,
        "clan_war_decks": clan_war_decks,
        "analysis_cards": analysis_cards,
        "achievement_stats": achievement_stats,
        "upgrade_recommendations": upgrade_recommendations,
        "upgrade_priority": upgrade_priority,
        "upgrade_by_rarity": upgrade_by_rarity,
        "clan_war_custom": clan_war_custom,
    })


def get_clan_war_decks(selector):
    """Option 3: Generate 4 clan war decks."""
    selector.config.is_clan_war = True
    comparator = create_comparator('achievements_rarity_level')
    
    decks = []
    all_selected = []
    for i in range(4):
        sorted_cards = selector.get_sorted_cards(comparator, include_low_achievements=True)
        sorted_cards = [c for c in sorted_cards if c not in all_selected]
        deck = selector.select_deck(sorted_cards, 5)
        decks.append([card_to_dict(c) for c in deck])
        all_selected.extend(deck)
    
    selector.config.is_clan_war = False
    return decks


def get_analysis_cards(selector):
    """Option 5: All cards analysis sorted."""
    for card in selector.cards:
        card.level = 14
    comparator = create_comparator('achievements_rarity_level')
    sorted_cards = selector.get_sorted_cards(comparator, include_low_achievements=False)
    return [card_to_dict(c) for c in sorted_cards]


def get_achievement_stats(selector):
    """Option 8: Achievement stats by card type."""
    stats = {}
    for card in selector.cards:
        if card.clash_royale_card_type and card.achievement_lefts > 0:
            type_name = card.clash_royale_card_type.name
            stats[type_name] = stats.get(type_name, 0) + card.achievement_lefts
    return dict(sorted(stats.items(), key=lambda x: -x[1]))


def get_upgrade_recommendations(selector):
    """Option 9: Cards to upgrade recommendations."""
    comparator = create_comparator('level_achievements_rarity')
    current_cards = selector.get_sorted_cards(comparator, include_low_achievements=False)
    current_total = sum(c.achievement_lefts for c in selector.cards)

    max_cards = [c.copy() for c in current_cards]
    for card in max_cards:
        card.level = 14
        card.achievement_lefts = calculate_achievement_lefts(card)
    max_total = sum(c.achievement_lefts for c in max_cards)

    current_map = {c.name: c for c in current_cards}
    recommendations = {}

    for max_card in max_cards:
        curr = current_map.get(max_card.name)
        if curr and max_card.rarity:
            diff = max_card.achievement_lefts - curr.achievement_lefts
            if diff > 0:
                rarity_name = max_card.rarity.name
                if rarity_name not in recommendations:
                    recommendations[rarity_name] = []
                recommendations[rarity_name].append({
                    "name": max_card.name,
                    "current_level": curr.level,
                    "achievement_gain": diff,
                    "max_achievements": max_card.achievement_lefts,
                })

    for rarity in recommendations:
        recommendations[rarity].sort(key=lambda x: (-x["achievement_gain"], -x["max_achievements"]))
        recommendations[rarity] = recommendations[rarity][:10]

    return {
        "current_total": current_total,
        "max_total": max_total,
        "by_rarity": recommendations,
    }


def get_upgrade_priority_list(selector):
    """Option 10: Upgrade priority list."""
    def upgrade_priority_comparator(a, b):
        a_high = a.name in HIGH_PRIORITY_UPGRADE_CARDS
        b_high = b.name in HIGH_PRIORITY_UPGRADE_CARDS
        if a_high != b_high:
            return -1 if a_high else 1
        if a_high and b_high:
            a_idx = HIGH_PRIORITY_UPGRADE_CARDS.index(a.name)
            b_idx = HIGH_PRIORITY_UPGRADE_CARDS.index(b.name)
            if a_idx != b_idx:
                return a_idx - b_idx

        a_secondary = a.name in SECONDARY_PRIORITY_UPGRADE_CARDS
        b_secondary = b.name in SECONDARY_PRIORITY_UPGRADE_CARDS
        if a_secondary != b_secondary:
            return -1 if a_secondary else 1
        if a_secondary and b_secondary:
            a_idx = SECONDARY_PRIORITY_UPGRADE_CARDS.index(a.name)
            b_idx = SECONDARY_PRIORITY_UPGRADE_CARDS.index(b.name)
            if a_idx != b_idx:
                return a_idx - b_idx

        if a.level != b.level:
            return a.level - b.level
        if b.achievement_lefts != a.achievement_lefts:
            return b.achievement_lefts - a.achievement_lefts

        a_special = (a.rarity == Rarity.CHAMPION) or a.has_evolution
        b_special = (b.rarity == Rarity.CHAMPION) or b.has_evolution
        if a_special != b_special:
            return -1 if a_special else 1

        a_rarity = a.rarity.value if a.rarity else -1
        b_rarity = b.rarity.value if b.rarity else -1
        if b_rarity != a_rarity:
            return b_rarity - a_rarity
        if b.elixirs != a.elixirs:
            return b.elixirs - a.elixirs
        return 0

    sorted_cards = sorted(selector.cards, key=cmp_to_key(upgrade_priority_comparator))
    return [card_to_dict(c) for c in sorted_cards]


def get_upgrade_by_rarity(selector):
    """Option 11: Upgrade priority grouped by rarity."""
    def upgrade_priority_comparator(a, b):
        a_high = a.name in HIGH_PRIORITY_UPGRADE_CARDS
        b_high = b.name in HIGH_PRIORITY_UPGRADE_CARDS
        if a_high != b_high:
            return -1 if a_high else 1

        a_secondary = a.name in SECONDARY_PRIORITY_UPGRADE_CARDS
        b_secondary = b.name in SECONDARY_PRIORITY_UPGRADE_CARDS
        if a_secondary != b_secondary:
            return -1 if a_secondary else 1

        if a.level != b.level:
            return a.level - b.level
        if b.achievement_lefts != a.achievement_lefts:
            return b.achievement_lefts - a.achievement_lefts
        if b.elixirs != a.elixirs:
            return b.elixirs - a.elixirs
        return 0

    cards_by_rarity = {}
    for card in selector.cards:
        rarity = card.rarity.name if card.rarity else "COMMON"
        if rarity not in cards_by_rarity:
            cards_by_rarity[rarity] = []
        cards_by_rarity[rarity].append(card)

    result = {}
    for rarity in ["CHAMPION", "LEGENDARY", "EPIC", "RARE", "COMMON"]:
        if rarity in cards_by_rarity:
            cards_by_rarity[rarity].sort(key=cmp_to_key(upgrade_priority_comparator))
            result[rarity] = [card_to_dict(c) for c in cards_by_rarity[rarity]]

    return result


def get_clan_war_custom(selector):
    """Option 12: Clan War 4 decks with specific constraints."""
    MUST_USE_CARDS = ["hogrider", "battleram", "royalhogs", "suspiciousbush", "ramrider"]

    def meets_level_req(card):
        min_lvl = 13 if card.elixirs <= 2 else 14
        effective_lvl = 14 if card.name in selector.config.boosted_cards else card.level
        return effective_lvl >= min_lvl

    eligible_cards = [c for c in selector.cards if meets_level_req(c)]
    big_spells = sorted([c for c in eligible_cards if c.clash_royale_card_type == CRCardType.BIG_SPELL], key=lambda c: -c.achievement_lefts)
    small_spells = sorted([c for c in eligible_cards if c.clash_royale_card_type == CRCardType.SMALL_SPELL], key=lambda c: -c.achievement_lefts)
    tower_defenders = sorted([c for c in eligible_cards if c.clash_royale_card_type == CRCardType.TOWER_DEFENDER], key=lambda c: -c.achievement_lefts)

    must_use_distribution = [[0], [1], [2], [3, 4]]
    decks = [[], [], [], []]
    used_cards = set()

    for deck_idx, card_indices in enumerate(must_use_distribution):
        for idx in card_indices:
            card_name = MUST_USE_CARDS[idx]
            card = selector.card_map.get(card_name)
            if card and meets_level_req(card):
                decks[deck_idx].append(card)
                used_cards.add(card_name)

    for deck_idx in range(4):
        for spell in big_spells:
            if spell.name not in used_cards:
                decks[deck_idx].append(spell)
                used_cards.add(spell.name)
                break
        for spell in small_spells:
            if spell.name not in used_cards:
                decks[deck_idx].append(spell)
                used_cards.add(spell.name)
                break
        for defender in tower_defenders:
            if defender.name not in used_cards:
                decks[deck_idx].append(defender)
                used_cards.add(defender.name)
                break

    remaining = sorted([c for c in eligible_cards if c.name not in used_cards], 
                       key=lambda c: (-c.achievement_lefts, -(c.rarity.value if c.rarity else 0)))

    for deck_idx in range(4):
        while len(decks[deck_idx]) < 8 and remaining:
            current_elixir = sum(c.elixirs for c in decks[deck_idx])
            slots_left = 8 - len(decks[deck_idx])
            min_card_elixir = max(1, 31 - current_elixir - (slots_left - 1) * 9)
            max_card_elixir = min(9, 33 - current_elixir - (slots_left - 1) * 1)
            deck_types = {c.clash_royale_card_type for c in decks[deck_idx] if c.clash_royale_card_type}

            added = False
            for card in remaining:
                if min_card_elixir <= card.elixirs <= max_card_elixir and card.clash_royale_card_type not in deck_types:
                    decks[deck_idx].append(card)
                    remaining.remove(card)
                    used_cards.add(card.name)
                    added = True
                    break

            if not added:
                for card in remaining:
                    if min_card_elixir <= card.elixirs <= max_card_elixir:
                        decks[deck_idx].append(card)
                        remaining.remove(card)
                        used_cards.add(card.name)
                        added = True
                        break

            if not added and remaining:
                card = remaining.pop(0)
                decks[deck_idx].append(card)
                used_cards.add(card.name)

    result = []
    for deck in decks:
        total_elixir = sum(c.elixirs for c in deck)
        avg_elixir = total_elixir / len(deck) if deck else 0
        total_achv = sum(c.achievement_lefts for c in deck)
        result.append({
            "cards": [card_to_dict(c) for c in deck],
            "total_elixir": total_elixir,
            "avg_elixir": round(avg_elixir, 1),
            "total_achievements": total_achv,
        })
    return result


if __name__ == "__main__":
    import uvicorn
    print("Starting local development server...")
    print("API Docs available at: http://localhost:8000/docs")
    uvicorn.run("main_local:app", host="127.0.0.1", port=8000, reload=False)
