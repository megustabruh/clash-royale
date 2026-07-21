"""
Clash Royale Deck Selector - Python Version
Optimized and cleaned up from ClashRoyale.java
"""

import json
import logging
import urllib.request
from dataclasses import dataclass, replace
from enum import Enum, auto
from functools import cmp_to_key
from typing import Callable, Dict, List, Optional, Set, Tuple

# =============================================================================
# Logging Configuration
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
LOGGER = logging.getLogger(__name__)


# =============================================================================
# Enums
# =============================================================================
class CardType(Enum):
    SPELL = auto()
    SPELL_TROOP = auto()
    BUILDING = auto()
    TROOP = auto()
    BUILDING_TROOP = auto()


class CRCardType(Enum):
    SINGLE_ANTI_AIR = auto()
    SPLASH_ANTI_AIR = auto()
    SMALL_SPELL = auto()
    BIG_SPELL = auto()
    MINI_TANK = auto()
    TANK = auto()            # Big tanks (5+ elixir)
    DISTRACTION = auto()
    TOWER_DESTROYER = auto()
    TOWER_DEFENDER = auto()
    SPELL_TROOP = auto()
    SWARM = auto()           # Multiple units spawned together
    CYCLE = auto()           # Low-cost cycling cards (1-2 elixir)
    BUILDING = auto()        # All buildings/structures
    AIR_TROOP = auto()       # Flying units
    BRIDGE_SPAM = auto()     # Fast pressure cards for bridge spam
    CHAMPION = auto()        # Champion cards
    OTHERS = auto()


class Rarity(Enum):
    COMMON = 0
    RARE = 1
    EPIC = 2
    LEGENDARY = 3
    CHAMPION = 4


# =============================================================================
# Data Classes
# =============================================================================
@dataclass
class Card:
    """Represents a Clash Royale card with its stats and mastery info."""
    name: str
    badge_level: int = 0
    badge_max_level: int = 10
    badge_progress: int = 0
    badge_target: int = 1
    level: int = 0
    temp_level: int = 0
    card_type: Optional[CardType] = None
    clash_royale_card_types: List[CRCardType] = None  # Supports multiple card types
    rarity: Optional[Rarity] = None
    elixirs: int = 0
    has_evolution: bool = False
    count: int = 0
    id: int = 0
    achievement_lefts: int = 0
    is_hero: bool = False

    def __post_init__(self):
        if self.clash_royale_card_types is None:
            self.clash_royale_card_types = []

    def __str__(self) -> str:
        types_str = ','.join(t.name for t in self.clash_royale_card_types) if self.clash_royale_card_types else 'N/A'
        return (
            f"Card[{self.name}, lvl={self.level}, temp={self.temp_level}, "
            f"badge={self.badge_level}, types=[{types_str}], "
            f"achv={self.achievement_lefts}, rarity={self.rarity.name if self.rarity else 'N/A'}, "
            f"elixir={self.elixirs}, evo={self.has_evolution}]"
        )

    def copy(self) -> 'Card':
        """Create a deep copy of this card."""
        return replace(self)


@dataclass
class Config:
    """Configuration settings for deck selection."""
    token: str
    player_tag: str = "U8PVCPV98"
    boosted_cards: Tuple[str, ...] = ("megaminion", "zap", "knight", "giant")
    heroes: Tuple[str, ...] = ("knight", "giant")  # Currently owned heroes
    excluded_cards: Tuple[str, ...] = ()
    minimum_level: int = 13
    max_elixir: int = 33
    min_elixir: int = 31
    is_clan_war: bool = False
    competitive_cap_level: int = 0
    seven_x_elixir: bool = False
    king_level: int = 16  # King Tower level for boosted cards


# =============================================================================
# Card Type Mappings (Using Sets for O(1) Lookup)
# =============================================================================
# Cards can appear in multiple categories based on their abilities
CARD_TYPE_MAPPINGS: Dict[CRCardType, frozenset] = {
    CRCardType.SINGLE_ANTI_AIR: frozenset([
        "flyingmachine", "musketeer", "minions", "dartgoblin", "minionhorde",
        "threemusketeers", "firecracker", "wizard", "archerqueen", "phoenix",
        "goblinstein", "motherwitch", "littleprince", "electrowizard", "archers"
    ]),
    CRCardType.SPLASH_ANTI_AIR: frozenset([
        "babydragon", "princess", "magicarcher", "witch", "megaminion",
        "skeletondragons", "executioner", "firecracker", "wizard", "hunter",
        "goblindemolisher", "sparky", "icewizard", "bowler"
    ]),
    CRCardType.SMALL_SPELL: frozenset([
        "void", "rage", "goblincurse", "giantsnowball", "arrows", "thelog",
        "zap", "barbarianbarrel", "tornado", "royaldelivery", "freeze", "vines"
    ]),
    CRCardType.BIG_SPELL: frozenset([
        "fireball", "lightning", "rocket", "poison", "earthquake"
    ]),
    CRCardType.SPELL_TROOP: frozenset([
        "monk", "healspirit", "electrospirit", "firespirit", "icewizard",
        "graveyard", "electrodragon", "zappies", "electrowizard", "lumberjack",
        "infernodragon", "witch", "nightwitch", "motherwitch", "battlehealer",
        "spiritempress", "electrogiant", "runegiant"
    ]),
    CRCardType.TOWER_DEFENDER: frozenset([
        "cannon", "tesla", "infernotower", "furnace", "tombstone", "goblinhut",
        "barbarianhut", "bombtower", "goblincage", "elitebarbarians", "bowler",
        "pekka", "megaknight", "monk", "fisherman", "executioner", "cannoncart",
         "mortar", "x-bow", "giantskeleton"
    ]),
    CRCardType.TOWER_DESTROYER: frozenset([
        "ramrider", "goblingiant", "balloon", "giant",
        "royalgiant", "electrogiant", "wallbreakers", "hogrider", "golem",
        "battleram", "lavahound", "royalhogs", "elixirgolem",  "goblindrill", "magicarcher", "skeletonbarrel"
    ]),
    CRCardType.DISTRACTION: frozenset([
        # Small cheap units that distract enemies (under 3 elixir typically)
        "skeletons", "bats", "goblins", "speargoblins", "icespirit",
        "electrospirit", "firespirit", "healspirit", "guards", "icegolem",
        "goblinbarrel", "goblindrill"
    ]),
    CRCardType.MINI_TANK: frozenset([
        # Medium-cost tanks (3-5 elixir) that can take hits
        "knight", "valkyrie", "darkprince", "minipekka", "fisherman",
        "lumberjack", "hunter", "battlehealer", "ronin", "prince",
        "cannoncart", "nightwitch", "bowler"
    ]),
    CRCardType.OTHERS: frozenset([
        # Special/unique cards that don't fit other categories
        "mirror", "clone", "graveyard", "elixircollector", "goblinmachine",
        "suspiciousbush", "berserker"
    ]),
    # New card types
    CRCardType.SWARM: frozenset([
        # Multiple units spawned together
        "skeletonarmy", "minionhorde", "goblingang", "barbarians",
        "guards", "rascals", "royalrecruits", "skeletonbarrel",
        "goblins", "speargoblins", "minions", "bats", "skeletons",
        "threemusketeers", "archers", "firecracker"
    ]),
    CRCardType.CYCLE: frozenset([
        # Low-cost cycling cards (1-2 elixir)
        "skeletons", "icespirit", "electrospirit", "firespirit", "healspirit",
        "bats", "goblins", "zap", "thelog", "giantsnowball", "arrows",
        "icegolem", "speargoblins"
    ]),
    CRCardType.BUILDING: frozenset([
        # All buildings/structures
        "cannon", "tesla", "infernotower", "furnace", "tombstone",
        "goblinhut", "barbarianhut", "bombtower", "goblincage",
        "mortar", "x-bow", "elixircollector"
    ]),
    CRCardType.AIR_TROOP: frozenset([
        # Flying units
        "balloon", "lavahound", "babydragon", "megaminion", "minions",
        "minionhorde", "bats", "infernodragon", "flyingmachine",
        "skeletondragons", "electrodragon", "phoenix", "skeletonbarrel",
        "goblinstein"
    ]),
    CRCardType.BRIDGE_SPAM: frozenset([
        # Fast pressure cards for bridge spam
        "bandit", "battleram", "ramrider", "darkprince", "prince",
        "royalghost", "goldenknight", "electrowizard", "lumberjack",
        "minipekka", "miner", "wallbreakers", "goblinbarrel", "hogrider",
        "royalhogs", "elitebarbarians", "ronin", "skeletonking"
    ]),
    CRCardType.TANK: frozenset([
        # Big tanks (5+ elixir) that soak damage
        "megaknight", "pekka", "golem", "giant", "royalgiant",
        "goblingiant", "elixirgolem", "giantskeleton", "runegiant",
        "electrogiant", "lavahound", "sparky"
    ]),
    CRCardType.CHAMPION: frozenset([
        # All champion cards
        "archerqueen", "goldenknight", "skeletonking", "mightyminer",
        "monk", "littleprince"
    ]),
}

# Badge to card name mappings
BADGE_TO_CARD_MAPPINGS: Dict[str, str] = {
    "archer": "archers",
    "icespirits": "icespirit",
    "firespirits": "firespirit",
    "blowdartgoblin": "dartgoblin",
    "barblog": "barbarianbarrel",
    "angrybarbarians": "elitebarbarians",
    "icegolemite": "icegolem",
    "ragebarbarian": "lumberjack",
    "darkwitch": "nightwitch",
    "ghost": "royalghost",
    "elitearcher": "magicarcher",
    "witchmother": "motherwitch",
    "darkmagic": "void",
    "heal": "healspirit",
    "skeletonwarriors": "guards",
    "assassin": "bandit",
    "snowball": "giantsnowball",
    "log": "thelog",
    "skeletonballoon": "skeletonbarrel",
    "zapmachine": "sparky",
    "firespirithut": "furnace",
    "movingcannon": "cannoncart",
    "minisparkys": "zappies",
    "axeman": "executioner",
    "dartbarrell": "flyingmachine",
    "xbow": "x-bow",
    "giantbuffer": "runegiant",
    "mergemaiden": "spiritempress",
    "samurai": "ronin"
}

# Priority cards for upgrade recommendations
HIGH_PRIORITY_UPGRADE_CARDS: Tuple[str, ...] = (
    "musketeer", "megaminion", "fireball", "zap", "miner", 
    "cannon", "thelog", "balloon", "knight", "wallbreakers"
)
SECONDARY_PRIORITY_UPGRADE_CARDS: Tuple[str, ...] = (
    "hogrider", "battleram", "royalhogs", "suspiciousbush", "ramrider"
)

# Cards with 10 achievable mastery levels
TEN_ACHIEVEMENT_CARDS: Dict[Rarity, frozenset] = {
    Rarity.COMMON: frozenset([
        "arrows", "royalgiant", "electrospirit", "firespirit", "firecracker", "mortar"
    ]),
    Rarity.RARE: frozenset([
        "battlehealer", "battleram", "dartgoblin", "earthquake", "flyingmachine",
        "hogrider", "minipekka", "musketeer", "valkyrie", "wizard"
    ]),
    Rarity.EPIC: frozenset([
        "babydragon", "balloon", "bowler", "pekka", "wallbreakers"
    ]),
    Rarity.LEGENDARY: frozenset([
        "electrowizard", "graveyard", "megaknight", "princess", "thelog"
    ]),
}


# =============================================================================
# Helper Functions
# =============================================================================
def get_cr_card_types(name: str) -> List[CRCardType]:
    """Get all CR card types for a card name. Returns list of matching types."""
    types = []
    for card_type, cards in CARD_TYPE_MAPPINGS.items():
        if name in cards:
            types.append(card_type)
    return types


def get_badge_to_card_name(badge_name: str) -> str:
    """Convert badge name to card name."""
    return BADGE_TO_CARD_MAPPINGS.get(badge_name, badge_name)


def calculate_achievement_lefts(card: Card) -> int:
    """Calculate achievements left for a card based on level and rarity."""
    if card.rarity is None:
        return 1

    level = card.level
    badge = card.badge_level
    name = card.name

    # Achievement thresholds by rarity: (level_for_10, level_for_7, level_for_4)
    thresholds = {
        Rarity.COMMON: (14, 10, 7),
        Rarity.RARE: (14, 11, 8),
        Rarity.EPIC: (14, 11, 9),
        Rarity.LEGENDARY: (14, 11, 10),  # Level 11 gets 7 achievements
        Rarity.CHAMPION: (14, 13, 12),
    }

    t = thresholds.get(card.rarity, (14, 14, 14))
    ten_cards = TEN_ACHIEVEMENT_CARDS.get(card.rarity, frozenset())

    if card.rarity == Rarity.CHAMPION:
        # Champions have 7 max achievements
        if level >= t[1]:  # >= 13
            return 7 - badge
        elif level >= t[2]:  # >= 12
            return 4 - badge
    else:
        if level >= t[0] and name in ten_cards:
            return 10 - badge
        elif level >= t[1]:
            return 7 - badge
        elif level >= t[2]:
            return 4 - badge

    return 1


# =============================================================================
# Comparators
# =============================================================================
def create_comparator(priority: str) -> Callable[[Card, Card], int]:
    """
    Factory function to create card comparators.
    
    Args:
        priority: One of 'achievements_rarity_level', 'level_achievements_rarity', 
                  or 'achievements_rarity'
    """
    def compare(a: Card, b: Card) -> int:
        # Evolution always has highest priority
        if b.has_evolution != a.has_evolution:
            return (b.has_evolution > a.has_evolution) - (b.has_evolution < a.has_evolution)

        if priority == 'achievements_rarity_level':
            order = [
                (b.achievement_lefts, a.achievement_lefts),
                (b.rarity.value if b.rarity else 0, a.rarity.value if a.rarity else 0),
                (b.temp_level, a.temp_level),
            ]
        elif priority == 'level_achievements_rarity':
            order = [
                (b.temp_level, a.temp_level),
                (b.achievement_lefts, a.achievement_lefts),
                (b.rarity.value if b.rarity else 0, a.rarity.value if a.rarity else 0),
            ]
        else:  # achievements_rarity
            order = [
                (b.achievement_lefts, a.achievement_lefts),
                (b.rarity.value if b.rarity else 0, a.rarity.value if a.rarity else 0),
            ]

        for b_val, a_val in order:
            if b_val != a_val:
                return b_val - a_val
        return 0

    return compare


# =============================================================================
# Deck Selector Class
# =============================================================================
class DeckSelector:
    """Main class for selecting Clash Royale decks based on mastery achievements."""

    def __init__(self, config: Config):
        self.config = config
        self.cards: List[Card] = []
        self.card_map: Dict[str, Card] = {}
        self.output_log: List[str] = []
        self.player_king_level: int = config.king_level  # Store King Level from API

    def _log(self, message: str) -> None:
        """Log a message and store it in output."""
        LOGGER.info(message)
        self.output_log.append(message)

    def fetch_player_data(self) -> Optional[dict]:
        """Fetch card details from Clash Royale API."""
        try:
            endpoint = f"https://api.clashroyale.com/v1/players/%23{self.config.player_tag}"
            req = urllib.request.Request(endpoint)
            req.add_header("Authorization", f"Bearer {self.config.token}")
            req.add_header("Content-Type", "application/json")

            with urllib.request.urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            self._log(f"HTTP Error: {e.code} - {e.reason}")
        except urllib.error.URLError as e:
            self._log(f"URL Error: {e.reason}")
        except (json.JSONDecodeError, TimeoutError, OSError) as e:
            LOGGER.exception("Unexpected error: %s", e)
        return None

    def load_cards(self) -> bool:
        """Load and parse card data from API."""
        data = self.fetch_player_data()
        if not data:
            self._log("Failed to fetch player data")
            return False

        # Extract King Tower level from API
        if "expLevel" in data:
            self.player_king_level = data["expLevel"]
            self._log(f"King Tower Level: {self.player_king_level}")
        
        self.cards = []
        self.card_map = {}

        # Process badges (mastery info)
        for badge in data.get("badges", []):
            badge_name = badge.get("name", "")
            if "Mastery" not in badge_name:
                continue

            raw_name = badge_name.replace("Mastery", "").replace(" ", "").lower()
            card_name = get_badge_to_card_name(raw_name)
            # Debug log for ronin-related badges
            if "ronin" in raw_name.lower() or "samurai" in raw_name.lower():
                self._log(f"DEBUG Badge: raw={badge_name}, processed={raw_name}, mapped={card_name}, badge_level={badge.get('level', 0)}")
            card = Card(
                name=card_name,
                badge_level=badge.get("level", 0),
                badge_max_level=badge.get("maxLevel", 10),
                badge_progress=badge.get("progress", 0),
                badge_target=badge.get("target", 1),
            )
            self.cards.append(card)
            self.card_map[card_name] = card

        self._log(f"Total badges earned: {len(self.cards)}")

        # Process card details
        for item in data.get("cards", []):
            card_name = item.get("name", "").replace(" ", "").replace(".", "").lower()
            card = self.card_map.get(card_name)

            if card is None:
                card = Card(name=card_name)
                self.cards.append(card)
                self.card_map[card_name] = card

            # Parse rarity and calculate level
            rarity_str = item.get("rarity", "COMMON").upper()
            card.rarity = Rarity[rarity_str] if rarity_str in Rarity.__members__ else Rarity.COMMON

            base_level = item.get("level", 1)
            level_offset = {
                Rarity.CHAMPION: 10,
                Rarity.LEGENDARY: 8,
                Rarity.EPIC: 5,
                Rarity.RARE: 2,
            }.get(card.rarity, 0)
            card.level = base_level + level_offset

            # Handle special elixir costs
            card.elixirs = {"mirror": 4, "elixirgolem": 8}.get(
                card_name, item.get("elixirCost", 0)
            )

            card.count = item.get("count", 0)
            card.id = item.get("id", 0)
            card.has_evolution = item.get("maxEvolutionLevel", 0) == 1
            card.clash_royale_card_types = get_cr_card_types(card_name)

        # Remove excluded cards
        self.cards = [c for c in self.cards if c.name not in self.config.excluded_cards]

        # Calculate achievements
        for card in self.cards:
            card.achievement_lefts = calculate_achievement_lefts(card)
            if card.rarity is None:
                self._log(f"Unknown rarity: {card.name}")
            # Debug logging for Ronin
            if "ronin" in card.name.lower():
                self._log(f"DEBUG Ronin: name={card.name}, level={card.level}, badge_level={card.badge_level}, rarity={card.rarity}, achievement_lefts={card.achievement_lefts}")

        return True

    def _apply_boosted_levels(self) -> None:
        """Apply boosted levels to cards based on King Tower level."""
        for card in self.cards:
            card.temp_level = card.level
            if card.name in self.config.boosted_cards:
                card.temp_level = self.player_king_level

    def _filter_cards(self, cards: List[Card]) -> List[Card]:
        """Apply level filters based on config."""
        result = cards.copy()

        if self.config.competitive_cap_level > 0:
            for card in result:
                if card.level > self.config.competitive_cap_level:
                    card.temp_level = self.config.competitive_cap_level
            result = [c for c in result if c.temp_level >= self.config.competitive_cap_level]

        if self.config.is_clan_war:
            result = [c for c in result if c.temp_level >= self.config.minimum_level]

        return result

    def get_sorted_cards(
        self,
        comparator: Callable[[Card, Card], int],
        include_low_achievements: bool = False
    ) -> List[Card]:
        """Get cards sorted by the given comparator."""
        self._apply_boosted_levels()
        cards = self._filter_cards(self.cards)

        # Split cards by achievement tiers
        high = [c for c in cards if c.achievement_lefts >= 4]
        mid = [c for c in cards if 2 <= c.achievement_lefts < 4]
        low = [c for c in cards if c.achievement_lefts < (1 if self.config.is_clan_war else 2)]

        high.sort(key=cmp_to_key(comparator))
        mid.sort(key=cmp_to_key(comparator))

        result = high + mid
        if include_low_achievements:
            low.sort(key=cmp_to_key(comparator))
            result.extend(low)

        return result

    def generate_elixir_combinations(
        self,
        target_min: int,
        target_max: int,
        card_count: int
    ) -> Set[Tuple[int, ...]]:
        """Generate valid elixir combinations."""
        result: Set[Tuple[int, ...]] = set()

        def helper(current: List[int]) -> None:
            if len(current) == card_count:
                total = sum(current)
                if target_min <= total <= target_max:
                    result.add(tuple(sorted(current)))
                return
            for i in range(1, 10):
                current.append(i)
                helper(current)
                current.pop()

        helper([])
        self._log(f"Elixir range: {target_min}-{target_max}, Cards: {card_count}, Combos: {len(result)}")
        return result

    def select_deck(
        self,
        available_cards: List[Card],
        choices: int
    ) -> List[Card]:
        """Select a deck from available cards."""
        cards = available_cards.copy()
        selected: List[Card] = []
        used_types: Set[CRCardType] = set()

        # Phase 1: Select diverse card types
        for _ in range(choices):
            if not cards:
                break

            # For 7x elixir, prioritize big spells
            card = None
            if self.config.seven_x_elixir:
                for c in cards:
                    if CRCardType.BIG_SPELL in c.clash_royale_card_types:
                        card = c
                        break

            card = card or cards[0]
            selected.append(card)

            if card.clash_royale_card_types:
                used_types.update(card.clash_royale_card_types)

            cards = [c for c in cards if not any(t in used_types for t in c.clash_royale_card_types)]

        # Phase 2: Fill remaining slots with elixir combinations
        total_elixir = sum(c.elixirs for c in selected)
        self._log(f"Selected cards elixir: {total_elixir}")

        remaining_slots = 8 - choices
        combos = self.generate_elixir_combinations(
            self.config.min_elixir - total_elixir,
            self.config.max_elixir - total_elixir,
            remaining_slots
        )

        # Find cards matching the combinations
        for combo in combos:
            temp_cards = cards.copy()
            matched: List[Card] = []

            for elixir in combo:
                for card in temp_cards:
                    if card.elixirs == elixir:
                        temp_cards.remove(card)
                        matched.append(card)
                        break

            if len(matched) == len(combo):
                print(" | ".join(c.name for c in matched))
                selected.extend(matched)
                break

        return selected

    def run(self, deck_type: int = 0) -> str:
        """Main entry point for deck selection."""
        if not self.load_cards():
            return "\n".join(self.output_log)

        # Get user choice
        if deck_type == 0:
            print("\nDeck Selection Options:")
            print("1. Normal          2. Competitive     3. Clan War")
            print("4. Special Event   5. Analysis        6. Locked Troop")
            print("7. 7x Elixir       8. Achievement Analysis")
            print("9. Cards to Upgrade")
            print("10. Upgrade Priority List")
            print("11. Upgrade Priority by Rarity")
            print("12. Clan War 4 Decks (Custom)")
            try:
                deck_type = int(input("\nEnter choice: "))
            except ValueError:
                self._log("Invalid input")
                return "\n".join(self.output_log)

        # Configure based on choice
        num_decks = 1
        choices = 6
        include_low = True
        comparator = create_comparator('achievements_rarity_level')

        if deck_type == 1:
            pass  # Default settings

        elif deck_type == 2:
            try:
                self.config.competitive_cap_level = int(input("Competition level: "))
            except ValueError:
                self.config.competitive_cap_level = 11
            choices = 5
            comparator = create_comparator('level_achievements_rarity')

        elif deck_type == 3:
            num_decks = 4
            choices = 5
            self.config.is_clan_war = True

        elif deck_type == 5:
            for card in self.cards:
                card.level = 14
            print("\nSort options:")
            print("1. Achievements > Rarity > Level")
            print("2. Level > Achievements > Rarity")
            print("3. Achievements > Rarity")
            try:
                sort_type = int(input("Sort type: "))
            except ValueError:
                sort_type = 1

            priorities = {
                1: 'achievements_rarity_level',
                2: 'level_achievements_rarity',
                3: 'achievements_rarity'
            }
            comparator = create_comparator(priorities.get(sort_type, 'achievements_rarity_level'))
            include_low = False

            for card in self.get_sorted_cards(comparator, include_low):
                print(card)
            return "\n".join(self.output_log)

        elif deck_type == 7:
            num_decks = 4
            choices = 5
            self.config.is_clan_war = True
            self.config.max_elixir = 45
            self.config.min_elixir = 33
            self.config.minimum_level = 12
            self.config.seven_x_elixir = True
            self.cards = [c for c in self.cards if c.elixirs >= 3]
            comparator = create_comparator('level_achievements_rarity')

        elif deck_type == 8:
            stats: Dict[CRCardType, int] = {}
            for card in self.cards:
                if card.clash_royale_card_types and card.achievement_lefts > 0:
                    for card_type in card.clash_royale_card_types:
                        stats[card_type] = stats.get(card_type, 0) + card.achievement_lefts

            print("\nAchievements left by card type:")
            for card_type, count in sorted(stats.items(), key=lambda x: -x[1]):
                print(f"  {card_type.name}: {count}")
            return "\n".join(self.output_log)

        elif deck_type == 9:
            comparator = create_comparator('level_achievements_rarity')
            current_cards = self.get_sorted_cards(comparator, include_low_achievements=False)
            current_total = sum(c.achievement_lefts for c in self.cards)
            print(f"\nTotal achievements left (current levels): {current_total}")

            # Calculate with max levels
            max_cards = [c.copy() for c in current_cards]
            for card in max_cards:
                card.level = 14
                card.achievement_lefts = calculate_achievement_lefts(card)

            max_total = sum(c.achievement_lefts for c in max_cards)
            print(f"Total achievements left (maxed levels): {max_total}")

            # Find upgrade candidates
            diff_by_rarity: Dict[Rarity, List[Tuple[str, int, int, int]]] = {}
            current_map = {c.name: c for c in current_cards}

            for max_card in max_cards:
                curr = current_map.get(max_card.name)
                if curr and max_card.rarity:
                    diff = max_card.achievement_lefts - curr.achievement_lefts
                    if diff > 0:
                        if max_card.rarity not in diff_by_rarity:
                            diff_by_rarity[max_card.rarity] = []
                        diff_by_rarity[max_card.rarity].append(
                            (max_card.name, curr.level, diff, max_card.achievement_lefts)
                        )

            for rarity in Rarity:
                cards = diff_by_rarity.get(rarity, [])
                if cards:
                    cards.sort(key=lambda x: (-x[2], -x[3]))
                    print(f"\nTop upgrades for {rarity.name}:")
                    for name, level, diff, badges in cards[:10]:
                        print(f"  {name} | Level: {level} | +{diff} achievements | {badges} badges available")

            return "\n".join(self.output_log)

        elif deck_type == 10:
            # Custom upgrade priority list
            def upgrade_priority_comparator(a: Card, b: Card) -> int:
                # Priority 0: High priority cards first
                a_high = a.name in HIGH_PRIORITY_UPGRADE_CARDS
                b_high = b.name in HIGH_PRIORITY_UPGRADE_CARDS
                if a_high != b_high:
                    return -1 if a_high else 1
                # If both are high priority, sort by their order in the list
                if a_high and b_high:
                    a_idx = HIGH_PRIORITY_UPGRADE_CARDS.index(a.name)
                    b_idx = HIGH_PRIORITY_UPGRADE_CARDS.index(b.name)
                    if a_idx != b_idx:
                        return a_idx - b_idx

                # Priority 0.5: Secondary priority cards (2nd tier high priority)
                a_secondary = a.name in SECONDARY_PRIORITY_UPGRADE_CARDS
                b_secondary = b.name in SECONDARY_PRIORITY_UPGRADE_CARDS
                if a_secondary != b_secondary:
                    return -1 if a_secondary else 1
                # If both are secondary priority, sort by their order in the list
                if a_secondary and b_secondary:
                    a_idx = SECONDARY_PRIORITY_UPGRADE_CARDS.index(a.name)
                    b_idx = SECONDARY_PRIORITY_UPGRADE_CARDS.index(b.name)
                    if a_idx != b_idx:
                        return a_idx - b_idx

                # Priority 1: Low level cards first (easier to upgrade)
                if a.level != b.level:
                    return a.level - b.level

                # Priority 2: Most achievements to unlock (high to low)
                if b.achievement_lefts != a.achievement_lefts:
                    return b.achievement_lefts - a.achievement_lefts

                # Priority 3: Hero (champion) or evolution gets more priority
                a_special = (a.rarity == Rarity.CHAMPION) or a.has_evolution
                b_special = (b.rarity == Rarity.CHAMPION) or b.has_evolution
                if a_special != b_special:
                    return -1 if a_special else 1

                # Priority 4: Rarity (Champion > Legendary > Epic > Rare > Common)
                a_rarity = a.rarity.value if a.rarity else -1
                b_rarity = b.rarity.value if b.rarity else -1
                if b_rarity != a_rarity:
                    return b_rarity - a_rarity

                # Priority 5: Elixirs high to low
                if b.elixirs != a.elixirs:
                    return b.elixirs - a.elixirs

                return 0

            # Sort all cards by upgrade priority
            sorted_cards = sorted(self.cards, key=cmp_to_key(upgrade_priority_comparator))

            print("\n" + "=" * 80)
            print("CARD UPGRADE PRIORITY LIST")
            print("=" * 80)
            print(f"{'#':<4} {'Pri':<4} {'Card':<18} {'Lvl':<5} {'Achv':<6} {'Rarity':<11} {'Elixir':<7} {'Evo'}")
            print("-" * 80)

            for i, card in enumerate(sorted_cards, 1):
                rarity_name = card.rarity.name if card.rarity else "N/A"
                if card.rarity == Rarity.CHAMPION:
                    rarity_name += "[C]"
                evo_mark = "*" if card.has_evolution else ""
                if card.name in HIGH_PRIORITY_UPGRADE_CARDS:
                    priority_mark = ">>"
                elif card.name in SECONDARY_PRIORITY_UPGRADE_CARDS:
                    priority_mark = "> "
                else:
                    priority_mark = ""
                print(f"{i:<4} {priority_mark:<4} {card.name:<18} {card.level:<5} {card.achievement_lefts:<6} {rarity_name:<11} {card.elixirs:<7} {evo_mark}")

            print("\nLegend: >> = High Priority, > = Secondary Priority, [C] = Champion, * = Has Evolution")
            return "\n".join(self.output_log)

        elif deck_type == 11:
            # Upgrade priority list grouped by rarity
            def upgrade_priority_comparator(a: Card, b: Card) -> int:
                # Priority 0: High priority cards first
                a_high = a.name in HIGH_PRIORITY_UPGRADE_CARDS
                b_high = b.name in HIGH_PRIORITY_UPGRADE_CARDS
                if a_high != b_high:
                    return -1 if a_high else 1
                if a_high and b_high:
                    a_idx = HIGH_PRIORITY_UPGRADE_CARDS.index(a.name)
                    b_idx = HIGH_PRIORITY_UPGRADE_CARDS.index(b.name)
                    if a_idx != b_idx:
                        return a_idx - b_idx

                # Priority 0.5: Secondary priority cards
                a_secondary = a.name in SECONDARY_PRIORITY_UPGRADE_CARDS
                b_secondary = b.name in SECONDARY_PRIORITY_UPGRADE_CARDS
                if a_secondary != b_secondary:
                    return -1 if a_secondary else 1
                if a_secondary and b_secondary:
                    a_idx = SECONDARY_PRIORITY_UPGRADE_CARDS.index(a.name)
                    b_idx = SECONDARY_PRIORITY_UPGRADE_CARDS.index(b.name)
                    if a_idx != b_idx:
                        return a_idx - b_idx

                # Priority 1: Low level cards first (easier to upgrade)
                if a.level != b.level:
                    return a.level - b.level

                # Priority 2: Most achievements to unlock
                if b.achievement_lefts != a.achievement_lefts:
                    return b.achievement_lefts - a.achievement_lefts

                # Priority 3: Hero (champion) or evolution
                a_special = (a.rarity == Rarity.CHAMPION) or a.has_evolution
                b_special = (b.rarity == Rarity.CHAMPION) or b.has_evolution
                if a_special != b_special:
                    return -1 if a_special else 1

                # Priority 4: Elixirs high to low
                if b.elixirs != a.elixirs:
                    return b.elixirs - a.elixirs

                return 0

            # Group cards by rarity
            cards_by_rarity: Dict[Rarity, List[Card]] = {}
            for card in self.cards:
                rarity = card.rarity or Rarity.COMMON
                if rarity not in cards_by_rarity:
                    cards_by_rarity[rarity] = []
                cards_by_rarity[rarity].append(card)

            # Sort each rarity group
            for rarity in cards_by_rarity:
                cards_by_rarity[rarity].sort(key=cmp_to_key(upgrade_priority_comparator))

            print("\n" + "=" * 80)
            print("CARD UPGRADE PRIORITY BY RARITY")
            print("=" * 80)

            # Display in order: Champion, Legendary, Epic, Rare, Common
            for rarity in reversed(list(Rarity)):
                cards = cards_by_rarity.get(rarity, [])
                if not cards:
                    continue

                print(f"\n{'-' * 80}")
                print(f"  {rarity.name} ({len(cards)} cards)")
                print(f"{'-' * 80}")
                print(f"  {'#':<4} {'Pri':<4} {'Card':<18} {'Lvl':<5} {'Achv':<6} {'Elixir':<7} {'Evo'}")

                for i, card in enumerate(cards, 1):
                    evo_mark = "*" if card.has_evolution else ""
                    if card.name in HIGH_PRIORITY_UPGRADE_CARDS:
                        priority_mark = ">>"
                    elif card.name in SECONDARY_PRIORITY_UPGRADE_CARDS:
                        priority_mark = "> "
                    else:
                        priority_mark = ""
                    print(f"  {i:<4} {priority_mark:<4} {card.name:<18} {card.level:<5} {card.achievement_lefts:<6} {card.elixirs:<7} {evo_mark}")

            print("\nLegend: >> = High Priority, > = Secondary Priority, * = Has Evolution")
            return "\n".join(self.output_log)

        elif deck_type == 12:
            # Clan War 4 decks with specific constraints
            MUST_USE_CARDS = ["hogrider", "battleram", "royalhogs", "suspiciousbush", "ramrider"]
            
            # Filter cards by level requirement
            def meets_level_req(card: Card) -> bool:
                min_lvl = self.min_lvl if card.elixirs <= 2 else card.level
                # Consider boosted cards at King Tower level
                effective_lvl = self.player_king_level if card.name in self.config.boosted_cards else card.level
                return effective_lvl >= min_lvl

            eligible_cards = [c for c in self.cards if meets_level_req(c)]
            
            # Categorize cards (using multiple types)
            big_spells = [c for c in eligible_cards if CRCardType.BIG_SPELL in c.clash_royale_card_types]
            small_spells = [c for c in eligible_cards if CRCardType.SMALL_SPELL in c.clash_royale_card_types]
            tower_defenders = [c for c in eligible_cards if CRCardType.TOWER_DEFENDER in c.clash_royale_card_types]
            
            # Sort by achievements left (descending)
            big_spells.sort(key=lambda c: -c.achievement_lefts)
            small_spells.sort(key=lambda c: -c.achievement_lefts)
            tower_defenders.sort(key=lambda c: -c.achievement_lefts)
            
            # Must-use cards distribution: 5 cards over 4 decks (1,1,1,2)
            must_use_distribution = [[0], [1], [2], [3, 4]]  # indices into MUST_USE_CARDS
            
            decks: List[List[Card]] = [[], [], [], []]
            used_cards: Set[str] = set()
            
            # Add must-use cards first
            for deck_idx, card_indices in enumerate(must_use_distribution):
                for idx in card_indices:
                    card_name = MUST_USE_CARDS[idx]
                    card = self.card_map.get(card_name)
                    if card and meets_level_req(card):
                        decks[deck_idx].append(card)
                        used_cards.add(card_name)
                    else:
                        self._log(f"Warning: {card_name} not found or doesn't meet level requirement")
            
            # Add 1 big spell, 1 small spell, 1 tower defender to each deck
            for deck_idx in range(4):
                # Big spell
                for spell in big_spells:
                    if spell.name not in used_cards:
                        decks[deck_idx].append(spell)
                        used_cards.add(spell.name)
                        break
                
                # Small spell
                for spell in small_spells:
                    if spell.name not in used_cards:
                        decks[deck_idx].append(spell)
                        used_cards.add(spell.name)
                        break
                
                # Tower defender
                for defender in tower_defenders:
                    if defender.name not in used_cards:
                        decks[deck_idx].append(defender)
                        used_cards.add(defender.name)
                        break
            
            # Fill remaining slots (8 cards per deck)
            # Sort remaining eligible cards by achievements
            remaining = [c for c in eligible_cards if c.name not in used_cards]
            remaining.sort(key=lambda c: (-c.achievement_lefts, -(c.rarity.value if c.rarity else 0)))
            
            # Elixir constraints: avg 3.9-4.1 for 8 cards = total 31.2-32.8
            MIN_TOTAL_ELIXIR = 31  # 3.875 avg
            MAX_TOTAL_ELIXIR = 33  # 4.125 avg (slightly relaxed for flexibility)
            
            for deck_idx in range(4):
                while len(decks[deck_idx]) < 8 and remaining:
                    current_elixir = sum(c.elixirs for c in decks[deck_idx])
                    slots_left = 8 - len(decks[deck_idx])
                    
                    # Calculate elixir bounds for next card
                    # min_needed: current + card + (slots_left-1)*1 >= MIN_TOTAL
                    # max_allowed: current + card + (slots_left-1)*9 <= MAX_TOTAL (relaxed)
                    min_card_elixir = max(1, MIN_TOTAL_ELIXIR - current_elixir - (slots_left - 1) * 9)
                    max_card_elixir = min(9, MAX_TOTAL_ELIXIR - current_elixir - (slots_left - 1) * 1)
                    
                    # Try to add card with different type for diversity
                    deck_types = set()
                    for c in decks[deck_idx]:
                        if c.clash_royale_card_types:
                            deck_types.update(c.clash_royale_card_types)
                    
                    added = False
                    for card in remaining:
                        # Check elixir constraint
                        if not (min_card_elixir <= card.elixirs <= max_card_elixir):
                            continue
                        card_types = set(card.clash_royale_card_types) if card.clash_royale_card_types else set()
                        if not card_types.intersection(deck_types):
                            decks[deck_idx].append(card)
                            remaining.remove(card)
                            used_cards.add(card.name)
                            added = True
                            break
                    
                    # If no diverse card found, try any card within elixir range
                    if not added:
                        for card in remaining:
                            if min_card_elixir <= card.elixirs <= max_card_elixir:
                                decks[deck_idx].append(card)
                                remaining.remove(card)
                                used_cards.add(card.name)
                                added = True
                                break
                    
                    # If still not added (elixir constraints too strict), relax and add any
                    if not added and remaining:
                        card = remaining.pop(0)
                        decks[deck_idx].append(card)
                        used_cards.add(card.name)
            
            # Print results
            print("\n" + "=" * 80)
            print("CLAN WAR 4 DECKS (CUSTOM)")
            print("=" * 80)
            print(f"Level requirement: 14 (or 13 for elixir <= 2)")
            print(f"Target avg elixir: 3.9 - 4.1")
            print(f"Boosted cards: {', '.join(self.config.boosted_cards)}")
            
            for deck_idx, deck in enumerate(decks, 1):
                total_elixir = sum(c.elixirs for c in deck)
                avg_elixir = total_elixir / len(deck) if deck else 0
                total_achv = sum(c.achievement_lefts for c in deck)
                print(f"\n--- Deck {deck_idx} ({len(deck)} cards, avg {avg_elixir:.1f} elixir, {total_achv} achievements) ---")
                print(f"{'#':<3} {'Card':<18} {'Lvl':<5} {'Achv':<6} {'Elixir':<7} {'Type'}")
                for i, card in enumerate(deck, 1):
                    type_names = ','.join(t.name for t in card.clash_royale_card_types) if card.clash_royale_card_types else "OTHER"
                    boosted = "[B]" if card.name in self.config.boosted_cards else ""
                    must_use = "[M]" if card.name in MUST_USE_CARDS else ""
                    print(f"{i:<3} {card.name:<18} {card.level:<5} {card.achievement_lefts:<6} {card.elixirs:<7} {type_names} {boosted}{must_use}")
            
            print("\nLegend: [B] = Boosted, [M] = Must-Use Card")
            return "\n".join(self.output_log)

        else:
            self._log(f"Invalid choice: {deck_type}")
            return "\n".join(self.output_log)

        # Generate decks
        all_selected: List[Card] = []
        for i in range(num_decks):
            sorted_cards = self.get_sorted_cards(comparator, include_low)
            sorted_cards = [c for c in sorted_cards if c not in all_selected]

            deck = self.select_deck(sorted_cards, choices)
            print(f"\nDeck {i + 1}: {' | '.join(c.name for c in deck)}")
            all_selected.extend(deck)
            self._log("=" * 40)

        return "\n".join(self.output_log)


# =============================================================================
# Main Entry Point
# =============================================================================
def main() -> None:
    """Main entry point."""
    config = Config(
        token="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjA4OTRjN2FmLWUwZmYtNDM0Yy04ZGVkLTU3Yjg0Yjk2ZjNkZiIsImlhdCI6MTc3ODQyNDIzNSwic3ViIjoiZGV2ZWxvcGVyL2VhYjQ5OTQ3LWNiYjMtZWJlZC1mNzViLTgzNGFlODliMGFmZiIsInNjb3BlcyI6WyJyb3lhbGUiXSwibGltaXRzIjpbeyJ0aWVyIjoiZGV2ZWxvcGVyL3NpbHZlciIsInR5cGUiOiJ0aHJvdHRsaW5nIn0seyJjaWRycyI6WyIxNS4yMDYuMjkuMTYiXSwidHlwZSI6ImNsaWVudCJ9XX0.FOBrdxHptzi0ol5a3ljawrykFj0ZdEhSJcdhTXJct7XslIRn6Mksi8Ll0032kRuPsenHYAdSCqGnsoKQ4WRRqA",
        boosted_cards=("megaminion", "zap", "knight", "giant"),
    )

    selector = DeckSelector(config)
    selector.run()



# =============================
# FastAPI Backend for Frontend
# =============================
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/data")
def get_clash_royale_data(deck_type: int = 1):
    """Fetch all Clash Royale data and deck selection as JSON."""
    config = Config(
        token="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjA4OTRjN2FmLWUwZmYtNDM0Yy04ZGVkLTU3Yjg0Yjk2ZjNkZiIsImlhdCI6MTc3ODQyNDIzNSwic3ViIjoiZGV2ZWxvcGVyL2VhYjQ5OTQ3LWNiYjMtZWJlZC1mNzViLTgzNGFlODliMGFmZiIsInNjb3BlcyI6WyJyb3lhbGUiXSwibGltaXRzIjpbeyJ0aWVyIjoiZGV2ZWxvcGVyL3NpbHZlciIsInR5cGUiOiJ0aHJvdHRsaW5nIn0seyJjaWRycyI6WyIxNS4yMDYuMjkuMTYiXSwidHlwZSI6ImNsaWVudCJ9XX0.FOBrdxHptzi0ol5a3ljawrykFj0ZdEhSJcdhTXJct7XslIRn6Mksi8Ll0032kRuPsenHYAdSCqGnsoKQ4WRRqA",
        boosted_cards=("megaminion", "zap", "knight", "giant"),
    )
    selector = DeckSelector(config)
    selector.load_cards()
    # Return all cards and deck selection
    cards = [
        {
            "name": c.name,
            "badge_level": c.badge_level,
            "badge_max_level": c.badge_max_level,
            "badge_progress": c.badge_progress,
            "badge_target": c.badge_target,
            "level": c.level,
            "temp_level": c.temp_level,
            "card_type": c.card_type.name if c.card_type else None,
            "cr_card_types": [t.name for t in c.clash_royale_card_types] if c.clash_royale_card_types else [],
            "rarity": c.rarity.name if c.rarity else None,
            "elixirs": c.elixirs,
            "has_evolution": c.has_evolution,
            "count": c.count,
            "id": c.id,
            "achievement_lefts": c.achievement_lefts,
        }
        for c in selector.cards
    ]
    # Example: get a deck (first deck)
    comparator = create_comparator('achievements_rarity_level')
    sorted_cards = selector.get_sorted_cards(comparator, include_low_achievements=True)
    deck = selector.select_deck(sorted_cards, 6)
    deck_data = [c.name for c in deck]
    return JSONResponse({
        "cards": cards,
        "deck": deck_data,
    })

# Optional: run with uvicorn if executed directly
if __name__ == "__main__":
    uvicorn.run("clash_royale:app", host="0.0.0.0", port=8002, reload=True)
