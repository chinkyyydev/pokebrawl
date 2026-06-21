// Curated set of competitively-relevant held items.
//
// @pkmn/dex strips item *effect functions* from its data dump, so there is no
// reliable data flag to tell a real battle item (e.g. Heavy-Duty Boots) apart
// from an inert evolution item (e.g. Auspicious Armor) — they have identical
// data shapes. So, exactly like Pokémon Showdown's team builder, we curate the
// general item pool here. Species-exclusive items (Light Ball, Soul Dew, Thick
// Club, …) are handled separately via each item's reliable `itemUser` field and
// do NOT need to be listed here.
export const COMPETITIVE_ITEM_IDS: ReadonlySet<string> = new Set([
  // Choice items
  'choiceband', 'choicespecs', 'choicescarf',
  // Damage boosters
  'lifeorb', 'expertbelt', 'muscleband', 'wiseglasses', 'metronome', 'punchingglove',
  // Recovery / longevity
  'leftovers', 'blacksludge', 'bigroot', 'shellbell',
  // Survivability
  'focussash', 'focusband', 'rockyhelmet', 'assaultvest', 'eviolite', 'heavydutyboots',
  'safetygoggles', 'covertcloak', 'clearamulet', 'protectivepads', 'abilityshield',
  'brightpowder', 'laxincense',
  // Speed / utility
  'quickclaw', 'laggingtail', 'ironball', 'zoomlens', 'widelens', 'scopelens', 'razorclaw',
  'kingsrock', 'bindingband', 'gripclaw', 'shedshell', 'ringtarget', 'loadeddice',
  // Terrain / weather extenders
  'lightclay', 'terrainextender', 'damprock', 'heatrock', 'smoothrock', 'icyrock',
  // Herbs / seeds / one-time effects
  'mentalherb', 'powerherb', 'whiteherb', 'mirrorherb', 'electricseed', 'grassyseed',
  'mistyseed', 'psychicseed', 'roomservice', 'boosterenergy',
  // Reactive items
  'weaknesspolicy', 'blunderpolicy', 'redcard', 'ejectbutton', 'ejectpack', 'throatspray',
  'adrenalineorb', 'snowball', 'luminousmoss', 'cellbattery', 'absorbbulb', 'airballoon',
  // Self-status (intentional)
  'flameorb', 'toxicorb', 'stickybarb',
  // Type-boost items
  'blackbelt', 'blackglasses', 'charcoal', 'dragonfang', 'hardstone', 'magnet',
  'miracleseed', 'mysticwater', 'nevermeltice', 'poisonbarb', 'sharpbeak', 'silkscarf',
  'silverpowder', 'softsand', 'spelltag', 'twistedspoon', 'oddincense', 'rockincense',
  'seaincense', 'waveincense', 'roseincense',
  // Plates (type boost)
  'flameplate', 'splashplate', 'zapplate', 'meadowplate', 'icicleplate', 'fistplate',
  'toxicplate', 'earthplate', 'skyplate', 'mindplate', 'insectplate', 'stoneplate',
  'spookyplate', 'dracoplate', 'dreadplate', 'ironplate', 'pixieplate',
  // Berries — status cure
  'lumberry', 'cheriberry', 'chestoberry', 'pechaberry', 'rawstberry', 'aspearberry',
  'persimberry',
  // Berries — healing
  'sitrusberry', 'oranberry', 'aguavberry', 'figyberry', 'magoberry', 'wikiberry',
  'iapapaberry',
  // Berries — pinch / stat
  'liechiberry', 'salacberry', 'petayaberry', 'apicotberry', 'ganlonberry', 'starfberry',
  'micleberry', 'custapberry', 'lansatberry',
  // Berries — damage reaction
  'enigmaberry', 'jabocaberry', 'rowapberry', 'keeberry', 'marangaberry',
  // Berries — type resist
  'occaberry', 'passhoberry', 'wacanberry', 'rindoberry', 'yacheberry', 'chopleberry',
  'kebiaberry', 'shucaberry', 'cobaberry', 'payapaberry', 'tangaberry', 'chartiberry',
  'kasibberry', 'habanberry', 'colburberry', 'babiriberry', 'chilanberry', 'roseliberry',
]);
